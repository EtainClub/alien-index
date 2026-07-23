import { describe, expect, it } from "vitest";
import { createScanSchema, questionIds } from "../src/contracts";

function validInput() {
  return {
    mode: "quick",
    inputVersion: "quick-v1",
    answers: Object.fromEntries(questionIds.map((id) => [id, 2])),
    gameSignals: { patternChoice: 1 },
    photoKinds: ["eye"],
    consentVersion: "privacy-2026-07",
  };
}

describe("createScan contract", () => {
  it("accepts the complete quick-v1 schema", () => {
    expect(createScanSchema.safeParse(validInput()).success).toBe(true);
  });

  it("rejects missing answers and out-of-range values", () => {
    const input = validInput();
    delete input.answers[questionIds[0]];
    input.answers[questionIds[1]] = 5;
    expect(createScanSchema.safeParse(input).success).toBe(false);
  });

  it("rejects duplicate photo kinds and unknown fields", () => {
    expect(createScanSchema.safeParse({
      ...validInput(),
      photoKinds: ["eye", "eye"],
      uid: "client-controlled",
    }).success).toBe(false);
  });
});
