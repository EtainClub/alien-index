import { execFileSync } from "node:child_process";

const projectId = process.env.GCLOUD_PROJECT ?? "alien-index";
const region = process.env.FIREBASE_FUNCTIONS_REGION ?? "asia-northeast3";
const callableFunctions = ["createScan", "retryScan", "createShare"];

for (const functionName of callableFunctions) {
  execFileSync(
    "gcloud",
    [
      "run",
      "services",
      "add-iam-policy-binding",
      functionName.toLowerCase(),
      `--region=${region}`,
      `--project=${projectId}`,
      "--member=allUsers",
      "--role=roles/run.invoker",
      "--quiet",
    ],
    { stdio: "inherit" },
  );
}

console.log(`Ensured public invoker access for ${callableFunctions.length} callable Functions.`);
