import { z } from "zod";

const copySchema = z.object({
  oneLiner: z.string().min(1).max(55),
  archetypeDescription: z.string().min(1).max(160),
  strongSignals: z.array(z.object({
    axis: z.enum(["pattern", "dream", "signal", "observer", "shape", "diplomacy"]),
    copy: z.string().min(1).max(70),
  })).min(1).max(3),
  earthSkill: z.string().min(1).max(80),
  playfulCaution: z.string().min(1).max(80),
  imagePrompt: z.object({
    personality: z.array(z.string().min(1).max(40)).min(1).max(3),
    palette: z.array(z.string().min(1).max(40)).min(1).max(3),
    world: z.string().min(1).max(80),
    visualMarks: z.array(z.string().min(1).max(50)).min(1).max(4),
  }),
});

export type AiCopy = z.infer<typeof copySchema>;

const copyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["oneLiner", "archetypeDescription", "strongSignals", "earthSkill", "playfulCaution", "imagePrompt"],
  properties: {
    oneLiner: { type: "string" },
    archetypeDescription: { type: "string" },
    strongSignals: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["axis", "copy"],
        properties: {
          axis: { type: "string", enum: ["pattern", "dream", "signal", "observer", "shape", "diplomacy"] },
          copy: { type: "string" },
        },
      },
    },
    earthSkill: { type: "string" },
    playfulCaution: { type: "string" },
    imagePrompt: {
      type: "object",
      additionalProperties: false,
      required: ["personality", "palette", "world", "visualMarks"],
      properties: {
        personality: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
        palette: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
        world: { type: "string" },
        visualMarks: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
      },
    },
  },
} as const;

type ResultInput = {
  score: number;
  grade: string;
  archetype: string;
  secondaryType: string;
  oneLiner: string;
  earthSkill: string;
  origin: string;
  signals: Array<{ label: string; value: number; detail: string }>;
};

type PhotoInput = {
  score: number;
  confidence: number;
  dominantHue: number;
  contrast: number;
  qualityLabel: string;
} | null;

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") throw new Error("openai-invalid-response");
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) throw new Error("openai-missing-output");
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: unknown }).type === "output_text") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string" && text.length > 0) return text;
      }
    }
  }
  throw new Error("openai-missing-output-text");
}

async function openAiRequest(path: string, apiKey: string, body: unknown): Promise<unknown> {
  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new Error(`openai-http-${response.status}:${detail}`);
  }
  return response.json();
}

export async function generateAiCopy({
  apiKey,
  model,
  result,
  photo,
}: {
  apiKey: string;
  model: string;
  result: ResultInput;
  photo: PhotoInput;
}): Promise<AiCopy> {
  const payload = await openAiRequest("responses", apiKey, {
    model,
    store: false,
    instructions: [
      "You write playful Korean copy for an entertainment alien identity card.",
      "Never infer health, race, gender, intelligence, personality diagnosis, or biology from a photo.",
      "The supplied score and archetype are authoritative; do not change them.",
      "Return warm, concrete, non-medical copy within the schema limits.",
    ].join(" "),
    input: JSON.stringify({ result, allowedPhotoSignals: photo }),
    text: {
      format: {
        type: "json_schema",
        name: "alien_index_result_copy",
        strict: true,
        schema: copyJsonSchema,
      },
    },
  });
  return copySchema.parse(JSON.parse(extractOutputText(payload)));
}

export async function generateAiImage({
  apiKey,
  model,
  prompt,
  quality,
}: {
  apiKey: string;
  model: string;
  prompt: AiCopy["imagePrompt"];
  quality: string;
}): Promise<Buffer> {
  const payload = await openAiRequest("images/generations", apiKey, {
    model,
    prompt: [
      "A whimsical, non-human alien identity-card character for an entertainment app.",
      "No real person, no face likeness, no medical or biological inference, no text or logos.",
      `Personality: ${prompt.personality.join(", ")}.`,
      `Palette: ${prompt.palette.join(", ")}.`,
      `World: ${prompt.world}.`,
      `Visual marks: ${prompt.visualMarks.join(", ")}.`,
    ].join(" "),
    n: 1,
    size: "1024x1024",
    quality: quality === "low" || quality === "high" ? quality : "medium",
    output_format: "webp",
  });
  const image = (payload as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
  if (!image) throw new Error("openai-image-missing-data");
  return Buffer.from(image, "base64");
}
