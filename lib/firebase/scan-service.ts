"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { AlienResult } from "@/lib/scoring";
import { ensureAnonymousUser, firebaseConfigured, getFirebaseServices } from "./client";

type RemoteScanStatus = "draft" | "uploaded" | "queued" | "analyzing" | "generating" | "ready" | "failed";

type CreateScanResponse = {
  scanId: string;
  status: "draft";
  uploadPaths: Partial<Record<"eye" | "hand", string>>;
  scoringVersion: "score-v1";
};

type FinalizeScanResponse = {
  scanId: string;
  status: RemoteScanStatus;
};

export type RunRemoteScanInput = {
  answers: Record<string, number>;
  gameChoice: number;
  photoFile: File | null;
  onStatus?: (status: RemoteScanStatus) => void;
};

export class RemoteScanError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "RemoteScanError";
  }
}

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic" || file.type === "image/heif") return "heic";
  return "jpg";
}

function waitForResult(uid: string, scanId: string, onStatus?: (status: RemoteScanStatus) => void) {
  const { auth, firestore, storage } = getFirebaseServices();
  return new Promise<AlienResult>((resolve, reject) => {
    let settled = false;
    let unsubscribe: () => void = () => {};
    const timeout = window.setTimeout(() => {
      settled = true;
      unsubscribe();
      reject(new RemoteScanError("서버 분석이 예상보다 오래 걸리고 있습니다.", "scan-timeout"));
    }, 120_000);

    unsubscribe = onSnapshot(
      doc(firestore, "users", uid, "scans", scanId),
      (snapshot) => {
        if (settled || !snapshot.exists()) return;
        const data = snapshot.data();
        const status = data.status as RemoteScanStatus;
        onStatus?.(status);
        if (status === "ready" && data.result) {
          settled = true;
          window.clearTimeout(timeout);
          unsubscribe();
          void (async () => {
            const generatedAssetPath = typeof data.generatedAssetPath === "string" ? data.generatedAssetPath : null;
            let generatedImageUrl: string | undefined;
            if (generatedAssetPath && auth.currentUser && !auth.currentUser.isAnonymous) {
              try {
                generatedImageUrl = await getDownloadURL(ref(storage, generatedAssetPath));
              } catch {
                // A missing/expired generated asset should not block the rules-based result.
              }
            }
            resolve({ ...(data.result as AlienResult), ...(generatedImageUrl ? { generatedImageUrl } : {}) });
          })();
        } else if (status === "failed") {
          settled = true;
          window.clearTimeout(timeout);
          unsubscribe();
          reject(new RemoteScanError(
            "서버 분석에 실패했습니다. 규칙 기반 결과로 계속합니다.",
            String(data.failure?.code ?? "scan-failed"),
            data.failure?.retryable !== false,
          ));
        }
      },
      (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new RemoteScanError(error.message, error.code));
      },
    );
  });
}

export async function runRemoteScan({ answers, gameChoice, photoFile, onStatus }: RunRemoteScanInput) {
  if (!firebaseConfigured) throw new RemoteScanError("Firebase 설정이 없습니다.", "firebase-not-configured", false);
  const user = await ensureAnonymousUser();
  const { functions, storage } = getFirebaseServices();
  const createScan = httpsCallable<{
    mode: "quick";
    inputVersion: "quick-v1";
    answers: Record<string, number>;
    gameSignals: { patternChoice: number };
    photoKinds: Array<"eye">;
    consentVersion: "privacy-2026-07";
  }, CreateScanResponse>(functions, "createScan");
  const finalizeScan = httpsCallable<{ scanId: string; idempotencyKey: string }, FinalizeScanResponse>(functions, "finalizeScan");

  const created = await createScan({
    mode: "quick",
    inputVersion: "quick-v1",
    answers,
    gameSignals: { patternChoice: gameChoice },
    photoKinds: photoFile ? ["eye"] : [],
    consentVersion: "privacy-2026-07",
  });
  const { scanId, uploadPaths } = created.data;
  onStatus?.("draft");

  if (photoFile) {
    const prefix = uploadPaths.eye;
    if (!prefix) throw new RemoteScanError("사진 업로드 경로가 없습니다.", "missing-upload-path", false);
    await uploadBytes(ref(storage, `${prefix}.${extensionFor(photoFile)}`), photoFile, {
      contentType: photoFile.type || "image/jpeg",
      customMetadata: {
        scanId,
        kind: "eye",
        schemaVersion: "photo-v1",
      },
    });
    onStatus?.("uploaded");
  }

  await finalizeScan({ scanId, idempotencyKey: crypto.randomUUID() });
  onStatus?.("queued");
  return { scanId, result: await waitForResult(user.uid, scanId, onStatus) };
}

export async function requestRemoteDataDeletion() {
  if (!firebaseConfigured) return { status: "local-only" as const };
  await ensureAnonymousUser();
  const { functions } = getFirebaseServices();
  const deleteMyData = httpsCallable<{ confirmation: "DELETE_MY_DATA" }, { requestId: string; status: "queued" }>(
    functions,
    "deleteMyData",
  );
  return (await deleteMyData({ confirmation: "DELETE_MY_DATA" })).data;
}
