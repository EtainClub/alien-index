import { execFileSync } from "node:child_process";

const projectId = process.env.GCLOUD_PROJECT ?? "alien-index";
const region = process.env.FIREBASE_FUNCTIONS_REGION ?? "asia-northeast3";
const functionName = process.argv[2] ?? "createScan";
const extraArgs = process.argv.slice(3);

const output = execFileSync(
  "gcloud",
  ["functions", "logs", "read", functionName, "--gen2", `--region=${region}`, `--project=${projectId}`, "--limit=30", ...extraArgs],
  { encoding: "utf8" },
);
console.log(output);
