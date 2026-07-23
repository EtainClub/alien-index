import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const projectId = process.env.FIREBASE_PROJECT_ID || "alien-index";
const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
  || envText.match(/^NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=(.+)$/m)?.[1]?.trim();

if (!storageBucket) {
  throw new Error("FIREBASE_STORAGE_BUCKET 또는 NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET이 필요합니다.");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("gcloud", [
  "storage", "buckets", "update", `gs://${storageBucket}`,
  "--lifecycle-file=storage-lifecycle.json",
  `--project=${projectId}`,
]);

for (const collectionGroup of ["scans", "jobs", "shares"]) {
  run("gcloud", [
    "firestore", "fields", "ttls", "update", "expiresAt",
    `--collection-group=${collectionGroup}`,
    "--enable-ttl",
    "--database=(default)",
    `--project=${projectId}`,
    "--async",
  ]);
}

run("gcloud", [
  "firestore", "fields", "ttls", "list",
  "--database=(default)",
  `--project=${projectId}`,
]);

run(process.execPath, ["functions/scripts/seed-admin-config.mjs"], {
  env: { ...process.env, FIREBASE_PROJECT_ID: projectId },
});
