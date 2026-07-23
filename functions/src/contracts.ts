import { z } from "zod";

export const questionIds = [
  "hidden-links",
  "dream-places",
  "small-signals",
  "watch-first",
  "new-angle",
  "vivid-world",
  "unspoken-rules",
  "atmosphere",
  "solo-flow",
  "odd-customs",
  "first-contact",
  "translate",
] as const;

const answersSchema = z.record(
  z.enum(questionIds),
  z.number().int().min(0).max(4),
).superRefine((answers, context) => {
  for (const questionId of questionIds) {
    if (answers[questionId] === undefined) {
      context.addIssue({
        code: "custom",
        message: `Missing answer: ${questionId}`,
        path: [questionId],
      });
    }
  }
});

export const createScanSchema = z.object({
  mode: z.literal("quick"),
  inputVersion: z.literal("quick-v1"),
  answers: answersSchema,
  gameSignals: z.object({
    patternChoice: z.number().int().min(0).max(3),
  }).strict(),
  photoKinds: z.array(z.enum(["eye", "hand"])).max(2)
    .refine((kinds) => new Set(kinds).size === kinds.length, "Duplicate photo kind"),
  consentVersion: z.literal("privacy-2026-07"),
}).strict();

export const finalizeScanSchema = z.object({
  scanId: z.string().min(8).max(128),
  idempotencyKey: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export const retryScanSchema = z.object({
  scanId: z.string().min(8).max(128),
}).strict();

export const createShareSchema = z.object({
  scanId: z.string().min(8).max(128),
}).strict();

export const revokeShareSchema = z.object({
  shareId: z.string().min(12).max(128),
}).strict();

export const deleteMyDataSchema = z.object({
  confirmation: z.literal("DELETE_MY_DATA"),
}).strict();

export type CreateScanInput = z.infer<typeof createScanSchema>;
export type PhotoKind = CreateScanInput["photoKinds"][number];
