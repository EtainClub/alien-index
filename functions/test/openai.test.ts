import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAiCopy, generateAiImage } from "../src/openai";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAI server adapters", () => {
  it("parses Responses API structured output and keeps only the allowlisted schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [{
          content: [{
            type: "output_text",
            text: JSON.stringify({
              oneLiner: "먼 은하의 신호를 발견하는 여행자입니다.",
              archetypeDescription: "익숙한 장면에서 새로운 연결을 찾습니다.",
              strongSignals: [{ axis: "pattern", copy: "숨은 규칙을 항로처럼 읽어요" }],
              earthSkill: "복잡한 상황을 빠르게 구조화하는 능력",
              playfulCaution: "가끔 너무 멀리 있는 신호까지 줍습니다.",
              imagePrompt: {
                personality: ["curious"],
                palette: ["ion-blue"],
                world: "blue-ice",
                visualMarks: ["curved-spiral"],
              },
            }),
          }],
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const copy = await generateAiCopy({
      apiKey: "test-key",
      model: "gpt-test",
      result: {
        score: 80,
        grade: "은하 시민",
        archetype: "패턴 항해자",
        secondaryType: "꿈의 지도 제작자",
        oneLiner: "fallback",
        earthSkill: "fallback",
        origin: "격자 성운",
        signals: [],
      },
      photo: null,
    });

    expect(copy.oneLiner).toContain("은하");
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer test-key" }),
    }));
  });

  it("decodes Image API base64 output into a Storage-ready buffer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: Buffer.from("webp").toString("base64") }] }),
    }));

    const image = await generateAiImage({
      apiKey: "test-key",
      model: "gpt-image-test",
      prompt: { personality: ["gentle"], palette: ["lime"], world: "ice", visualMarks: ["spiral"] },
      quality: "medium",
    });
    expect(image.toString()).toBe("webp");
  });
});
