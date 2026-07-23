import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-alien-index",
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});

beforeEach(async () => {
  await environment.clearStorage();
});

afterAll(async () => {
  await environment.cleanup();
});

const validMetadata = {
  contentType: "image/jpeg",
  customMetadata: { scanId: "scan-1", kind: "eye", schemaVersion: "photo-v1" },
};

describe("Storage private image rules", () => {
  it("allows only the owner to upload a valid source image", async () => {
    const owner = environment.authenticatedContext("alice").storage();
    await assertSucceeds(uploadBytes(
      ref(owner, "private/alice/scans/scan-1/source/eye.jpg"),
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      validMetadata,
    ));
    const other = environment.authenticatedContext("bob").storage();
    await assertFails(uploadBytes(
      ref(other, "private/alice/scans/scan-1/source/eye.jpg"),
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      validMetadata,
    ));
  });

  it("accepts the HEIF MIME type used by current phone cameras", async () => {
    const owner = environment.authenticatedContext("alice").storage();
    await assertSucceeds(uploadBytes(
      ref(owner, "private/alice/scans/scan-1/source/eye.heic"),
      new Uint8Array([0, 0, 0, 24]),
      { ...validMetadata, contentType: "image/heif" },
    ));
  });

  it("rejects invalid MIME and unexpected metadata", async () => {
    const owner = environment.authenticatedContext("alice").storage();
    await assertFails(uploadBytes(
      ref(owner, "private/alice/scans/scan-1/source/eye.jpg"),
      new Uint8Array([1, 2, 3]),
      { contentType: "text/plain", customMetadata: validMetadata.customMetadata },
    ));
    await assertFails(uploadBytes(
      ref(owner, "private/alice/scans/scan-1/source/eye.jpg"),
      new Uint8Array([1, 2, 3]),
      { ...validMetadata, customMetadata: { ...validMetadata.customMetadata, owner: "alice" } },
    ));
  });

  it("denies source downloads but allows owner deletion", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(
        ref(context.storage(), "private/alice/scans/scan-1/source/eye.jpg"),
        new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
        validMetadata,
      );
    });
    const ownerRef = ref(environment.authenticatedContext("alice").storage(), "private/alice/scans/scan-1/source/eye.jpg");
    await assertFails(getBytes(ownerRef));
    await assertSucceeds(deleteObject(ownerRef));
  });
});
