import { createHash, randomBytes, randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFunctions } from "firebase-admin/functions";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import type { z } from "zod";
import {
  createScanSchema,
  createShareSchema,
  deleteMyDataSchema,
  finalizeScanSchema,
  retryScanSchema,
  revokeShareSchema,
  type PhotoKind,
} from "./contracts";
import { analyzePrivateImage } from "./image-analysis";
import { generateAiCopy, generateAiImage, type AiCopy } from "./openai";
import { calculateServerResult, type PhotoSignal } from "./scoring";

initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 20 });

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const bucket = getStorage().bucket();
const region = "asia-northeast3";
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const callableOptions = {
  region,
  enforceAppCheck: false,
  cors: true,
  timeoutSeconds: 60,
  memory: "256MiB" as const,
};
const taskOptions = {
  region,
  retryConfig: {
    maxAttempts: 3,
    minBackoffSeconds: 30,
    maxBackoffSeconds: 300,
    maxDoublings: 3,
  },
  rateLimits: {
    maxConcurrentDispatches: 3,
    maxDispatchesPerSecond: 1,
  },
  timeoutSeconds: 540,
  memory: "1GiB" as const,
};
const processScanOptions = process.env.FUNCTIONS_EMULATOR === "true"
  || process.env.GCLOUD_PROJECT?.startsWith("demo-")
  ? taskOptions
  : { ...taskOptions, secrets: [openAiApiKey] };

const retentionMonitorOptions = {
  region,
  schedule: "every day 03:00",
  timeZone: "Asia/Seoul",
  timeoutSeconds: 300,
  memory: "256MiB" as const,
};

const defaultConfig = {
  quickModeEnabled: true,
  precisionModeEnabled: false,
  imageGenerationEnabled: false,
  dailyScanLimit: 10,
  dailyImageLimit: 3,
  dailyCostLimitMicros: 1_000_000,
  textModel: "disabled",
  visionModel: "disabled",
  imageModel: "disabled",
  imageQuality: "standard",
  activePromptVersions: { result: "result-v1" },
  aiTextCostEstimateMicros: 5_000,
  aiImageCostEstimateMicros: 50_000,
};

type ScanTaskPayload = { uid: string; scanId: string; jobId: string; traceId: string };
type DeleteTaskPayload = { uid: string; jobId: string; traceId: string };

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.warn("Callable input validation failed", {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })),
    });
    throw new HttpsError("invalid-argument", "요청 형식이 올바르지 않습니다.", {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })),
    });
  }
  return parsed.data;
}

function requireUid(request: { auth?: { uid: string } }): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "익명 인증 또는 연결된 계정이 필요합니다.");
  }
  return request.auth.uid;
}

function isLinkedAuth(request: { auth?: { token?: { firebase?: unknown } } }): boolean {
  const firebaseToken = request.auth?.token?.firebase;
  if (!firebaseToken || typeof firebaseToken !== "object") return false;
  const token = firebaseToken as { sign_in_provider?: unknown; identities?: unknown };
  const identities = token.identities && typeof token.identities === "object"
    ? Object.keys(token.identities as Record<string, unknown>)
    : [];
  return token.sign_in_provider !== "anonymous" || identities.some((provider) => provider !== "anonymous");
}

function hashId(value: string): string {
  return createHash("sha256").update(`alien-index-v1:${value}`).digest("hex");
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function expiresInDays(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);
}

function sourcePrefix(uid: string, scanId: string, kind: PhotoKind): string {
  return `private/${uid}/scans/${scanId}/source/${kind}`;
}

async function loadAdminConfig() {
  const snapshot = await db.doc("admin/config").get();
  return { ...defaultConfig, ...(snapshot.exists ? snapshot.data() : {}) };
}

async function reserveAiBudget(uid: string, config: Record<string, unknown>, imageRequested: boolean): Promise<boolean> {
  const estimate = Number(config[imageRequested ? "aiImageCostEstimateMicros" : "aiTextCostEstimateMicros"] ?? 0);
  const usageRef = db.doc(`users/${uid}/usage/${utcDay()}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const data = snapshot.data() ?? {};
    const imagesGenerated = Number(data.imagesGenerated ?? 0);
    const estimatedCostMicros = Number(data.estimatedCostMicros ?? 0);
    if (imageRequested && imagesGenerated >= Number(config.dailyImageLimit ?? 0)) return false;
    if (estimatedCostMicros + estimate > Number(config.dailyCostLimitMicros ?? 0)) return false;
    transaction.set(usageRef, {
      scansStarted: Number(data.scansStarted ?? 0),
      imagesGenerated: FieldValue.increment(imageRequested ? 1 : 0),
      estimatedCostMicros: FieldValue.increment(estimate),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

async function runAiEnhancement(
  uid: string,
  scanId: string,
  result: Awaited<ReturnType<typeof calculateServerResult>>,
  photo: PhotoSignal | null,
  config: Record<string, unknown>,
): Promise<{ patch: Record<string, unknown>; generatedAssetPath?: string } | null> {
  const textModel = String(config.textModel ?? "disabled");
  const imageModel = String(config.imageModel ?? "disabled");
  const imageRequested = config.imageGenerationEnabled === true && imageModel !== "disabled";
  if (textModel === "disabled" && !imageRequested) return null;

  let apiKey = "";
  try {
    apiKey = openAiApiKey.value();
  } catch {
    apiKey = process.env.OPENAI_API_KEY ?? "";
  }
  if (!apiKey) {
    logger.warn("ai-skipped-missing-secret", { scanIdHash: hashId(scanId) });
    return null;
  }

  if (!(await reserveAiBudget(uid, config, imageRequested))) {
    logger.warn("ai-skipped-budget-limit", { scanIdHash: hashId(scanId), imageRequested });
    return null;
  }

  let copy: AiCopy | null = null;
  try {
    if (textModel !== "disabled") {
      copy = await generateAiCopy({ apiKey, model: textModel, result, photo });
    }
  } catch (error) {
    logger.warn("ai-copy-failed-fallback", {
      scanIdHash: hashId(scanId),
      model: textModel,
      code: error instanceof Error ? error.message.slice(0, 120) : "ai-copy-failed",
    });
  }

  let generatedAssetPath: string | undefined;
  if (imageRequested) {
    try {
      const prompt = copy?.imagePrompt ?? {
        personality: [result.archetype],
        palette: ["ion-blue", "alien-lime"],
        world: result.origin,
        visualMarks: [result.secondaryType],
      };
      const image = await generateAiImage({
        apiKey,
        model: imageModel,
        prompt,
        quality: String(config.imageQuality ?? "medium"),
      });
      generatedAssetPath = `private/${uid}/scans/${scanId}/generated/alien.webp`;
      await bucket.file(generatedAssetPath).save(image, {
        resumable: false,
        metadata: {
          contentType: "image/webp",
          metadata: { scanId, kind: "generated", schemaVersion: "asset-v1" },
        },
      });
    } catch (error) {
      logger.warn("ai-image-failed-fallback", {
        scanIdHash: hashId(scanId),
        model: imageModel,
        code: error instanceof Error ? error.message.slice(0, 120) : "ai-image-failed",
      });
    }
  }

  if (!copy && !generatedAssetPath) return null;
  logger.info("ai-enhancement-complete", {
    scanIdHash: hashId(scanId),
    textModel: copy ? textModel : "fallback",
    imageModel: generatedAssetPath ? imageModel : "fallback",
    promptVersion: String((config.activePromptVersions as { result?: unknown } | undefined)?.result ?? "result-v1"),
  });
  return {
    patch: {
      ...(copy ? {
        oneLiner: copy.oneLiner,
        earthSkill: copy.earthSkill,
        explanation: {
          archetypeDescription: copy.archetypeDescription,
          strongSignals: copy.strongSignals,
          playfulCaution: copy.playfulCaution,
        },
      } : {}),
      ...(generatedAssetPath ? { generatedAssetPath } : {}),
      aiMetadata: {
        textModel: copy ? textModel : "fallback",
        imageModel: generatedAssetPath ? imageModel : "fallback",
        promptVersion: String((config.activePromptVersions as { result?: unknown } | undefined)?.result ?? "result-v1"),
      },
    },
    generatedAssetPath,
  };
}

async function enqueueScanTask(payload: ScanTaskPayload) {
  await getFunctions()
    .taskQueue<ScanTaskPayload>(`locations/${region}/functions/processScan`)
    .enqueue(payload);
}

async function enqueueDeleteTask(payload: DeleteTaskPayload) {
  await getFunctions()
    .taskQueue<DeleteTaskPayload>(`locations/${region}/functions/processDeletion`)
    .enqueue(payload);
}

async function sourceFiles(uid: string, scanId: string, kinds: PhotoKind[]) {
  const files = [];
  for (const kind of kinds) {
    const [matches] = await bucket.getFiles({ prefix: sourcePrefix(uid, scanId, kind) });
    const exact = matches.filter((file) => {
      const suffix = file.name.slice(sourcePrefix(uid, scanId, kind).length);
      return /^\.(jpg|jpeg|png|webp|heic)$/i.test(suffix);
    });
    if (exact.length !== 1) throw new Error(`missing-source-${kind}`);
    files.push({ kind, file: exact[0] });
  }
  return files;
}

async function analyzeSources(uid: string, scanId: string, kinds: PhotoKind[]) {
  if (kinds.length === 0) return { signal: null, files: [] };
  const files = await sourceFiles(uid, scanId, kinds);
  const signals: PhotoSignal[] = [];

  for (const { kind, file } of files) {
    const [metadata] = await file.getMetadata();
    const custom = metadata.metadata ?? {};
    if (custom.scanId !== scanId || custom.kind !== kind || custom.schemaVersion !== "photo-v1") {
      throw new Error(`invalid-source-metadata-${kind}`);
    }
    if (!metadata.size || Number(metadata.size) > 15 * 1024 * 1024) {
      throw new Error(`source-size-limit-${kind}`);
    }
    await file.setMetadata({ customTime: new Date().toISOString() });
    const [buffer] = await file.download();
    signals.push(await analyzePrivateImage(buffer));
  }

  const signal = signals.length === 1 ? signals[0] : {
    score: Math.round(signals.reduce((sum, item) => sum + item.score, 0) / signals.length),
    confidence: signals.reduce((sum, item) => sum + item.confidence, 0) / signals.length,
    dominantHue: Math.round(signals.reduce((sum, item) => sum + item.dominantHue, 0) / signals.length),
    contrast: Math.round(signals.reduce((sum, item) => sum + item.contrast, 0) / signals.length),
    qualityLabel: signals[0].qualityLabel,
  };
  return { signal, files };
}

export const createScan = onCall(callableOptions, async (request) => {
  const uid = requireUid(request);
  const input = parse(createScanSchema, request.data);
  const config = await loadAdminConfig();
  if (!config.quickModeEnabled) {
    throw new HttpsError("failed-precondition", "빠른 감별이 잠시 중단되었습니다.");
  }

  const scanRef = db.collection("users").doc(uid).collection("scans").doc();
  const userRef = db.collection("users").doc(uid);
  const usageRef = userRef.collection("usage").doc(utcDay());
  const now = Timestamp.now();
  const traceId = randomUUID();

  await db.runTransaction(async (transaction) => {
    const usageSnapshot = await transaction.get(usageRef);
    const scansStarted = Number(usageSnapshot.data()?.scansStarted ?? 0);
    if (scansStarted >= Number(config.dailyScanLimit)) {
      throw new HttpsError("resource-exhausted", "오늘의 빠른 감별 한도에 도달했습니다.", {
        code: "daily-scan-limit",
      });
    }

    transaction.set(userRef, {
      createdAt: FieldValue.serverTimestamp(),
      authMode: isLinkedAuth(request) ? "linked" : "anonymous",
      locale: "ko-KR",
      consentVersion: input.consentVersion,
    }, { merge: true });
    transaction.set(usageRef, {
      scansStarted: FieldValue.increment(1),
      imagesGenerated: usageSnapshot.data()?.imagesGenerated ?? 0,
      estimatedCostMicros: usageSnapshot.data()?.estimatedCostMicros ?? 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.create(scanRef, {
      mode: input.mode,
      status: "draft",
      inputVersion: input.inputVersion,
      scoringVersion: "score-v1",
      promptVersion: "result-v1",
      answers: input.answers,
      gameSignals: input.gameSignals,
      photoKinds: input.photoKinds,
      consentVersion: input.consentVersion,
      traceId,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresInDays(30),
    });
  });

  const uploadPaths = Object.fromEntries(
    input.photoKinds.map((kind) => [kind, sourcePrefix(uid, scanRef.id, kind)]),
  );
  logger.info("scan-created", { traceId, scanIdHash: hashId(scanRef.id), photoCount: input.photoKinds.length });
  return { scanId: scanRef.id, status: "draft", uploadPaths, scoringVersion: "score-v1" };
});

export const finalizeScan = onCall(callableOptions, async (request) => {
  const uid = requireUid(request);
  const input = parse(finalizeScanSchema, request.data);
  const scanRef = db.doc(`users/${uid}/scans/${input.scanId}`);
  const initial = await scanRef.get();
  if (!initial.exists) throw new HttpsError("not-found", "감별 기록을 찾을 수 없습니다.");
  const initialData = initial.data()!;

  if (initialData.finalizeIdempotencyKey === input.idempotencyKey && ["queued", "analyzing", "generating", "ready"].includes(initialData.status)) {
    return {
      scanId: input.scanId,
      status: initialData.status,
      result: initialData.result ?? null,
      generatedAssetPath: typeof initialData.generatedAssetPath === "string" ? initialData.generatedAssetPath : null,
      failure: initialData.failure ?? null,
    };
  }
  if (initialData.status !== "draft") {
    throw new HttpsError("failed-precondition", "현재 상태에서는 감별을 시작할 수 없습니다.");
  }

  const photoKinds = (initialData.photoKinds ?? []) as PhotoKind[];
  try {
    await sourceFiles(uid, input.scanId, photoKinds);
  } catch {
    if (photoKinds.length > 0) {
      throw new HttpsError("failed-precondition", "사진 업로드가 완료되지 않았습니다.", { code: "photo-not-uploaded" });
    }
  }

  const jobRef = db.collection("jobs").doc();
  const traceId = String(initialData.traceId ?? randomUUID());
  const transition = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(scanRef);
    const data = current.data();
    if (!data) throw new HttpsError("not-found", "감별 기록을 찾을 수 없습니다.");
    if (data.finalizeIdempotencyKey === input.idempotencyKey && data.status !== "draft") {
      return { enqueue: false, status: String(data.status) };
    }
    if (data.status !== "draft") throw new HttpsError("failed-precondition", "이미 처리 중인 감별입니다.");

    transaction.update(scanRef, {
      status: "queued",
      finalizeIdempotencyKey: input.idempotencyKey,
      jobId: jobRef.id,
      uploadedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(jobRef, {
      uid,
      scanId: input.scanId,
      kind: "analyze-and-generate",
      status: "queued",
      attempt: 0,
      idempotencyKey: input.idempotencyKey,
      traceId,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresInDays(7),
    });
    return { enqueue: true, status: "queued" };
  });

  if (!transition.enqueue) {
  return { scanId: input.scanId, status: transition.status, result: null, generatedAssetPath: null, failure: null };
  }

  try {
    await enqueueScanTask({ uid, scanId: input.scanId, jobId: jobRef.id, traceId });
  } catch (error) {
    logger.error("scan-enqueue-failed", { traceId, scanIdHash: hashId(input.scanId), error });
    await Promise.all([
      scanRef.update({ status: "failed", failure: { code: "queue-unavailable", retryable: true }, updatedAt: FieldValue.serverTimestamp() }),
      jobRef.update({ status: "failed", failureCode: "queue-unavailable", updatedAt: FieldValue.serverTimestamp() }),
    ]);
    throw new HttpsError("unavailable", "감별 대기열 연결에 실패했습니다. 다시 시도해주세요.");
  }

  return { scanId: input.scanId, status: "queued", result: null, generatedAssetPath: null, failure: null };
});

export const retryScan = onCall(callableOptions, async (request) => {
  const uid = requireUid(request);
  const input = parse(retryScanSchema, request.data);
  const scanRef = db.doc(`users/${uid}/scans/${input.scanId}`);
  const scan = await scanRef.get();
  const data = scan.data();
  if (!data) throw new HttpsError("not-found", "감별 기록을 찾을 수 없습니다.");
  if (data.status !== "failed" || data.failure?.retryable !== true) {
    throw new HttpsError("failed-precondition", "재시도할 수 없는 감별입니다.");
  }

  let photoKinds = (data.photoKinds ?? []) as PhotoKind[];
  try {
    await sourceFiles(uid, input.scanId, photoKinds);
  } catch {
    photoKinds = [];
  }

  const jobRef = db.collection("jobs").doc();
  const traceId = randomUUID();
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(scanRef);
    if (current.data()?.status !== "failed") throw new HttpsError("aborted", "감별 상태가 변경되었습니다.");
    transaction.update(scanRef, {
      status: "queued",
      photoKinds,
      failure: FieldValue.delete(),
      jobId: jobRef.id,
      traceId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(jobRef, {
      uid,
      scanId: input.scanId,
      kind: "analyze-and-generate",
      status: "queued",
      attempt: 0,
      idempotencyKey: `retry-${randomUUID()}`,
      traceId,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresInDays(7),
    });
  });
  await enqueueScanTask({ uid, scanId: input.scanId, jobId: jobRef.id, traceId });
  return { scanId: input.scanId, status: "queued", photoRequired: photoKinds.length > 0 };
});

export const processScan = onTaskDispatched<ScanTaskPayload>(processScanOptions, async (request) => {
  const { uid, scanId, jobId, traceId } = request.data;
  const scanRef = db.doc(`users/${uid}/scans/${scanId}`);
  const jobRef = db.doc(`jobs/${jobId}`);
  const leaseUntil = Timestamp.fromMillis(Date.now() + 8 * 60 * 1000);

  const claimed = await db.runTransaction(async (transaction) => {
    const [jobSnapshot, scanSnapshot] = await Promise.all([
      transaction.get(jobRef),
      transaction.get(scanRef),
    ]);
    const job = jobSnapshot.data();
    const scan = scanSnapshot.data();
    if (!job || !scan || scan.status === "ready") return false;
    const activeLease = job.leaseUntil instanceof Timestamp && job.leaseUntil.toMillis() > Date.now();
    if (job.status === "analyzing" && activeLease) return false;
    if (!["queued", "failed", "analyzing"].includes(job.status)) return false;

    transaction.update(jobRef, {
      status: "analyzing",
      attempt: FieldValue.increment(1),
      leaseUntil,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(scanRef, { status: "analyzing", updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) return;

  let processedFiles: Awaited<ReturnType<typeof sourceFiles>> = [];
  try {
    const scanSnapshot = await scanRef.get();
    const scan = scanSnapshot.data();
    if (!scan) throw new Error("scan-missing");
    const photoKinds = (scan.photoKinds ?? []) as PhotoKind[];
    const analyzed = await analyzeSources(uid, scanId, photoKinds);
    processedFiles = analyzed.files;
    const result = calculateServerResult(
      scan.answers as Record<string, number>,
      Number(scan.gameSignals?.patternChoice ?? 0),
      analyzed.signal,
    );

    const config = await loadAdminConfig();
    const authMode = scan.authMode === "linked" ? "linked" : "anonymous";
    let aiEnhancement: Awaited<ReturnType<typeof runAiEnhancement>> = null;
    if (authMode === "linked") {
      try {
        aiEnhancement = await runAiEnhancement(uid, scanId, result, analyzed.signal, config);
      } catch (error) {
        logger.warn("ai-enhancement-failed-fallback", {
          traceId,
          scanIdHash: hashId(scanId),
          code: error instanceof Error ? error.message.slice(0, 120) : "ai-enhancement-failed",
        });
      }
    } else if (config.imageGenerationEnabled === true || config.textModel !== "disabled") {
      logger.info("ai-skipped-auth-required", { traceId, scanIdHash: hashId(scanId) });
    }

    const aiResult = {
      ...result,
      ...(typeof aiEnhancement?.patch.oneLiner === "string" ? { oneLiner: aiEnhancement.patch.oneLiner } : {}),
      ...(typeof aiEnhancement?.patch.earthSkill === "string" ? { earthSkill: aiEnhancement.patch.earthSkill } : {}),
      ...(aiEnhancement?.patch.explanation ? { explanation: aiEnhancement.patch.explanation } : {}),
    };

    await scanRef.update({
      status: "generating",
      photoFeatures: analyzed.signal,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(scanRef);
      if (current.data()?.status === "ready") return;
      transaction.update(scanRef, {
        status: "ready",
        ...result,
        ...(aiEnhancement?.patch ?? {}),
        result: aiResult,
        generationMode: aiEnhancement ? "openai" : "rules-fallback",
        scoringVersion: "score-v1",
        promptVersion: String((config.activePromptVersions as { result?: unknown } | undefined)?.result ?? "result-v1"),
        readyAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(jobRef, {
        status: "ready",
        leaseUntil: FieldValue.delete(),
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const deletionResults = await Promise.allSettled(
      processedFiles.map(({ file }) => file.delete({ ignoreNotFound: true })),
    );
    const deletionFailures = deletionResults.filter((item) => item.status === "rejected").length;
    const [sourceDeletionWrite] = await Promise.allSettled([scanRef.set({
      sourceDeletion: {
        status: deletionFailures === 0 ? "complete" : "pending-lifecycle",
        expected: processedFiles.length,
        failed: deletionFailures,
        attemptedAt: FieldValue.serverTimestamp(),
      },
    }, { merge: true })]);
    const deletionMetadataFailed = sourceDeletionWrite.status === "rejected";
    if (deletionFailures === 0 && !deletionMetadataFailed) {
      logger.info("source-delete-complete", {
        traceId,
        scanIdHash: hashId(scanId),
        deletedCount: processedFiles.length,
      });
    } else {
      logger.error("source-delete-pending-lifecycle", {
        traceId,
        scanIdHash: hashId(scanId),
        expectedCount: processedFiles.length,
        failureCount: deletionFailures,
        metadataWriteFailed: deletionMetadataFailed,
      });
    }
    logger.info("scan-ready", { traceId, scanIdHash: hashId(scanId), generationMode: aiEnhancement ? "openai" : "rules-fallback" });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : "worker-failed";
    logger.error("scan-worker-failed", { traceId, scanIdHash: hashId(scanId), code });
    await Promise.allSettled([
      scanRef.update({ status: "failed", failure: { code, retryable: true }, updatedAt: FieldValue.serverTimestamp() }),
      jobRef.update({ status: "failed", failureCode: code, leaseUntil: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }),
    ]);
    throw error;
  }
});

export const createShare = onCall(callableOptions, async (request) => {
  const uid = requireUid(request);
  const input = parse(createShareSchema, request.data);
  const scan = await db.doc(`users/${uid}/scans/${input.scanId}`).get();
  const data = scan.data();
  if (!data || data.status !== "ready" || !data.result) {
    throw new HttpsError("failed-precondition", "완료된 감별만 공유할 수 있습니다.");
  }

  const shareId = randomBytes(18).toString("base64url");
  const result = data.result as Record<string, unknown>;
  const share = {
    ownerUidHash: hashId(uid),
    scanIdHash: hashId(input.scanId),
    score: result.score,
    grade: result.grade,
    archetype: result.archetype,
    oneLiner: result.oneLiner,
    crestSeed: hashId(`${input.scanId}:${String(result.archetypeKey)}`).slice(0, 24),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: expiresInDays(90),
    revokedAt: null,
  };
  await db.doc(`shares/${shareId}`).create(share);
  return { shareId, expiresAt: share.expiresAt.toDate().toISOString() };
});

export const revokeShare = onCall(callableOptions, async (request) => {
  const uid = requireUid(request);
  const input = parse(revokeShareSchema, request.data);
  const shareRef = db.doc(`shares/${input.shareId}`);
  const share = await shareRef.get();
  if (!share.exists) return { shareId: input.shareId, status: "revoked" };
  if (share.data()?.ownerUidHash !== hashId(uid)) {
    throw new HttpsError("permission-denied", "이 공유를 철회할 권한이 없습니다.");
  }
  await Promise.all([
    shareRef.update({ revokedAt: FieldValue.serverTimestamp() }),
    bucket.deleteFiles({ prefix: `public/shares/${input.shareId}/`, force: true }),
  ]);
  return { shareId: input.shareId, status: "revoked" };
});

export const deleteMyData = onCall(callableOptions, async (request) => {
  const uid = requireUid(request);
  parse(deleteMyDataSchema, request.data);
  const jobRef = db.collection("jobs").doc();
  const traceId = randomUUID();
  await Promise.all([
    db.doc(`users/${uid}`).set({ deleteRequestedAt: FieldValue.serverTimestamp() }, { merge: true }),
    jobRef.create({
      uid,
      kind: "delete-user-data",
      status: "queued",
      attempt: 0,
      traceId,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresInDays(7),
    }),
  ]);
  await enqueueDeleteTask({ uid, jobId: jobRef.id, traceId });
  return { requestId: jobRef.id, status: "queued" };
});

export const processDeletion = onTaskDispatched<DeleteTaskPayload>(taskOptions, async (request) => {
  const { uid, jobId, traceId } = request.data;
  const jobRef = db.doc(`jobs/${jobId}`);
  await jobRef.update({ status: "analyzing", attempt: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  try {
    const shares = await db.collection("shares").where("ownerUidHash", "==", hashId(uid)).get();
    await Promise.all(shares.docs.map(async (share) => {
      await Promise.all([
        share.ref.update({ revokedAt: FieldValue.serverTimestamp() }),
        bucket.deleteFiles({ prefix: `public/shares/${share.id}/`, force: true }),
      ]);
    }));
    await bucket.deleteFiles({ prefix: `private/${uid}/`, force: true });
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await jobRef.update({ status: "ready", completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    logger.info("user-data-deleted", { traceId, uidHash: hashId(uid) });
  } catch (error) {
    logger.error("user-data-delete-failed", { traceId, uidHash: hashId(uid), error });
    await jobRef.update({ status: "failed", failureCode: "delete-failed", updatedAt: FieldValue.serverTimestamp() });
    throw error;
  }
});

export const monitorRetention = onSchedule(retentionMonitorOptions, async () => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const [files] = await bucket.getFiles({
    prefix: "private/",
    maxResults: 5000,
  });
  const staleObjects: string[] = [];

  for (const file of files) {
    const createdAt = Date.parse(String(file.metadata.timeCreated ?? ""));
    if (Number.isFinite(createdAt) && createdAt < cutoff) {
      staleObjects.push(hashId(file.name));
    }
  }

  const payload = {
    inspectedCount: files.length,
    staleCount: staleObjects.length,
    staleObjectHashes: staleObjects.slice(0, 20),
    truncated: files.length === 5000,
  };
  if (staleObjects.length > 0) {
    logger.error("retention-stale-private-objects", payload);
  } else {
    logger.info("retention-private-objects-ok", payload);
  }
});
