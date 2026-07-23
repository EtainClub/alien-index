import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || "alien-index";
initializeApp({ projectId });

const snapshot = await getFirestore().doc("admin/config").get();
const config = snapshot.data() ?? {};
console.log(JSON.stringify({
  exists: snapshot.exists,
  imageGenerationEnabled: config.imageGenerationEnabled ?? null,
  imageModel: config.imageModel ?? null,
  imageQuality: config.imageQuality ?? null,
  textModel: config.textModel ?? null,
  visionModel: config.visionModel ?? null,
  dailyImageLimit: config.dailyImageLimit ?? null,
  dailyCostLimitMicros: config.dailyCostLimitMicros ?? null,
}));
