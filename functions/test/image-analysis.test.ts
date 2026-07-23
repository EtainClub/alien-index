import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { analyzePrivateImage } from "../src/image-analysis";

describe("private image validation", () => {
  it("extracts allowlisted visual features from a decoded image", async () => {
    const image = await sharp({
      create: { width: 100, height: 80, channels: 3, background: { r: 80, g: 160, b: 220 } },
    }).jpeg().toBuffer();
    const signal = await analyzePrivateImage(image);
    expect(signal.score).toBeGreaterThanOrEqual(35);
    expect(signal.score).toBeLessThanOrEqual(92);
    expect(signal.dominantHue).toBeGreaterThanOrEqual(0);
    expect(signal.dominantHue).toBeLessThanOrEqual(360);
    expect(Object.keys(signal).sort()).toEqual([
      "confidence", "contrast", "dominantHue", "qualityLabel", "score",
    ]);
  });

  it("rejects bytes that are not a decodable image", async () => {
    await expect(analyzePrivateImage(Buffer.from("not-an-image"))).rejects.toThrow();
  });
});
