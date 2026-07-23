import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { describe, expect, it } from "vitest";
import { questions } from "../../lib/scoring";

const projectId = "demo-alien-index";
const app = initializeApp({
  apiKey: "demo-key",
  authDomain: "localhost",
  projectId,
  appId: "1:123:web:test",
}, "functions-integration");
const auth = getAuth(app);
const functions = getFunctions(app, "asia-northeast3");
const firestore = getFirestore(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFunctionsEmulator(functions, "127.0.0.1", 5001);
connectFirestoreEmulator(firestore, "127.0.0.1", 8080);

const validInput = {
  mode: "quick" as const,
  inputVersion: "quick-v1" as const,
  answers: Object.fromEntries(questions.map((question) => [question.id, 2])),
  gameSignals: { patternChoice: 1 },
  photoKinds: [] as Array<"eye">,
  consentVersion: "privacy-2026-07" as const,
};

async function waitForReady(uid: string, scanId: string) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const snapshot = await getDoc(doc(firestore, "users", uid, "scans", scanId));
    if (snapshot.data()?.status === "ready") return snapshot.data();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("scan did not become ready");
}

describe("callable API integration", () => {
  it("rejects createScan without Firebase Authentication", async () => {
    const createScan = httpsCallable(functions, "createScan");
    await expect(createScan(validInput)).rejects.toMatchObject({ code: "functions/unauthenticated" });
  });

  it("creates a server-owned quick-v1 scan for an anonymous user", async () => {
    await signInAnonymously(auth);
    const createScan = httpsCallable<typeof validInput, { scanId: string; status: string; scoringVersion: string }>(functions, "createScan");
    const response = await createScan(validInput);
    expect(response.data.status).toBe("draft");
    expect(response.data.scoringVersion).toBe("score-v1");
    expect(response.data.scanId.length).toBeGreaterThan(8);
    await auth.signOut();
  });

  it("allows only ten daily scans under concurrent requests", async () => {
    await signInAnonymously(auth);
    const createScan = httpsCallable(functions, "createScan");
    const outcomes = await Promise.allSettled(Array.from({ length: 12 }, () => createScan(validInput)));
    const accepted = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(accepted).toHaveLength(10);
    expect(rejected).toHaveLength(2);
    for (const outcome of rejected) {
      if (outcome.status === "rejected") {
        expect(outcome.reason).toMatchObject({ code: "functions/resource-exhausted" });
      }
    }
    await auth.signOut();
  }, 15_000);

  it("finalizes idempotently, runs the task worker, and publishes an allowlisted share", async () => {
    const user = (await signInAnonymously(auth)).user;
    const createScan = httpsCallable<typeof validInput, { scanId: string }>(functions, "createScan");
    const finalizeScan = httpsCallable<{ scanId: string; idempotencyKey: string }, { status: string }>(functions, "finalizeScan");
    const createShare = httpsCallable<{ scanId: string }, { shareId: string }>(functions, "createShare");
    const revokeShare = httpsCallable<{ shareId: string }, { status: string }>(functions, "revokeShare");
    const { scanId } = (await createScan(validInput)).data;
    const idempotencyKey = "integration-idempotency-001";

    const finalized = await Promise.all([
      finalizeScan({ scanId, idempotencyKey }),
      finalizeScan({ scanId, idempotencyKey }),
    ]);
    expect(finalized.map((response) => response.data.status)).toEqual(["queued", "queued"]);

    const ready = await waitForReady(user.uid, scanId);
    expect(ready).toBeDefined();
    if (!ready) throw new Error("Ready scan data was missing");
    expect(ready.scoringVersion).toBe("score-v1");
    expect(ready.generationMode).toBe("rules-fallback");
    expect(ready.result.score).toBeTypeOf("number");

    const { shareId } = (await createShare({ scanId })).data;
    const shared = (await getDoc(doc(firestore, "shares", shareId))).data();
    expect(shared).toBeDefined();
    expect(Object.keys(shared!).sort()).toEqual([
      "archetype", "createdAt", "crestSeed", "expiresAt", "grade", "oneLiner",
      "ownerUidHash", "revokedAt", "scanIdHash", "score",
    ]);
    expect(shared).not.toHaveProperty("answers");
    expect(shared).not.toHaveProperty("confidence");
    expect(shared).not.toHaveProperty("uid");

    await revokeShare({ shareId });
    await expect(getDoc(doc(firestore, "shares", shareId))).rejects.toMatchObject({ code: "permission-denied" });
    await auth.signOut();
  }, 20_000);
});
