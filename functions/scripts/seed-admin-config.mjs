import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || "alien-index";
initializeApp({ projectId });

await getFirestore().doc("admin/config").set({
  quickModeEnabled: true,
  precisionModeEnabled: false,
  imageGenerationEnabled: false,
  dailyScanLimit: 10,
  dailyImageLimit: 3,
  dailyCostLimitMicros: 1_000_000,
  textModel: "disabled",
  visionModel: "disabled",
  imageModel: "disabled",
  imageQuality: "standard",
  activePromptVersions: { result: "result-v1" },
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

console.log(`Seeded admin/config for ${projectId}`);
