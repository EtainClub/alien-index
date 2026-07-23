import { execFileSync } from "node:child_process";

const projectId = process.env.GCLOUD_PROJECT ?? "alien-index";
const location = process.env.FIREBASE_STORAGE_LOCATION ?? "asia-northeast3";

const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const response = await fetch(`https://firebasestorage.googleapis.com/v1alpha/projects/${projectId}/defaultBucket`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ location }),
});

const payload = await response.json();
if (!response.ok) {
  throw new Error(`Firebase Storage provisioning failed (${response.status}): ${payload.error?.message ?? "unknown error"}`);
}

console.log(`Firebase Storage default bucket ready: ${payload.bucket?.name ?? payload.name ?? "created"}`);
