import type { PhotoSignal } from "./scoring";

export async function analyzePhoto(file: File): Promise<PhotoSignal> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("이미지를 읽을 수 없습니다.");
  context.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();

  const { data } = context.getImageData(0, 0, size, size);
  let red = 0;
  let green = 0;
  let blue = 0;
  let luminanceTotal = 0;
  const luminances: number[] = [];

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    red += r;
    green += g;
    blue += b;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminanceTotal += luminance;
    luminances.push(luminance);
  }

  const pixels = luminances.length;
  red /= pixels;
  green /= pixels;
  blue /= pixels;
  const mean = luminanceTotal / pixels;
  const deviation = Math.sqrt(luminances.reduce((sum, value) => sum + (value - mean) ** 2, 0) / pixels);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 210;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const saturation = max === 0 ? 0 : delta / max;
  const contrast = Math.min(100, Math.round((deviation / 64) * 100));
  const score = Math.round(Math.max(35, Math.min(92, 48 + saturation * 25 + contrast * 0.22)));
  const dimensionConfidence = Math.min(1, Math.sqrt((file.size || 1) / 300_000));
  const lightConfidence = mean < 25 || mean > 238 ? 0.72 : 1;
  const confidence = Math.max(0.55, Math.min(1, dimensionConfidence * lightConfidence));
  const qualityLabel = mean < 25 ? "빛이 적은 심우주 톤" : mean > 238 ? "밝은 광자 톤" : contrast > 55 ? "선명한 이온 대비" : "차분한 성운 톤";

  return { score, confidence, dominantHue: Math.round(hue), contrast, qualityLabel };
}
