import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, Timestamp } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-alien-index",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "users/alice"), { locale: "ko-KR" });
    await setDoc(doc(database, "users/alice/scans/scan-1"), { status: "ready" });
    await setDoc(doc(database, "shares/active"), {
      score: 77,
      revokedAt: null,
      expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    });
    await setDoc(doc(database, "shares/revoked"), {
      score: 77,
      revokedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    });
    await setDoc(doc(database, "shares/expired"), {
      score: 77,
      revokedAt: null,
      expiresAt: Timestamp.fromMillis(Date.now() - 60_000),
    });
    await setDoc(doc(database, "admin/config"), { quickModeEnabled: true });
  });
});

afterAll(async () => {
  await environment.cleanup();
});

describe("Firestore ownership boundaries", () => {
  it("allows an owner to read a scan but denies another user and unauthenticated access", async () => {
    await assertSucceeds(getDoc(doc(environment.authenticatedContext("alice").firestore(), "users/alice/scans/scan-1")));
    await assertFails(getDoc(doc(environment.authenticatedContext("bob").firestore(), "users/alice/scans/scan-1")));
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), "users/alice/scans/scan-1")));
  });

  it("denies all client writes to server-owned scans", async () => {
    await assertFails(setDoc(
      doc(environment.authenticatedContext("alice").firestore(), "users/alice/scans/client-created"),
      { status: "ready", score: 100 },
    ));
  });

  it("requires a bounded owner query", async () => {
    const database = environment.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(database, "users/alice/scans/scan-1")));
    await assertSucceeds(getDocs(query(collection(database, "users/alice/scans"), limit(50))));
    await assertFails(getDocs(collection(database, "users/alice/scans")));
  });

  it("exposes only active, unexpired share documents", async () => {
    const publicDatabase = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDatabase, "shares/active")));
    await assertFails(getDoc(doc(publicDatabase, "shares/revoked")));
    await assertFails(getDoc(doc(publicDatabase, "shares/expired")));
  });

  it("restricts admin config to an admin custom claim", async () => {
    await assertFails(getDoc(doc(environment.authenticatedContext("alice").firestore(), "admin/config")));
    await assertSucceeds(getDoc(doc(environment.authenticatedContext("admin", { admin: true }).firestore(), "admin/config")));
  });
});
