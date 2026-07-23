import { describe, expect, it } from "vitest";
import { calculateResult as calculateClientResult, questions } from "../../lib/scoring";
import { calculateServerResult, type PhotoSignal } from "../src/scoring";

const photo: PhotoSignal = {
  score: 73,
  confidence: 0.88,
  dominantHue: 187,
  contrast: 41,
  qualityLabel: "차분한 성운 톤",
};

describe("score-v1 golden parity", () => {
  const cases = [
    { name: "minimum", value: 0, gameChoice: 0, photo: null },
    { name: "middle with photo", value: 2, gameChoice: 2, photo },
    { name: "maximum", value: 4, gameChoice: 1, photo },
  ];

  it.each(cases)("matches the client engine for $name", ({ value, gameChoice, photo: signal }) => {
    const answers = Object.fromEntries(questions.map((question) => [question.id, value]));
    expect(calculateServerResult(answers, gameChoice, signal)).toEqual(
      calculateClientResult(answers, gameChoice, signal),
    );
  });
});
