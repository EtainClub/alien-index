import { execFileSync } from "node:child_process";

const projectId = process.env.GCLOUD_PROJECT ?? "alien-index";

function run(args) {
  return execFileSync("firebase", args, { encoding: "utf8" });
}

const functions = JSON.parse(run(["functions:list", "--project", projectId, "--json"]));
const deployed = (functions.result ?? functions).map((entry) => entry.id ?? entry.name).filter(Boolean);
const expected = [
  "createScan",
  "finalizeScan",
  "retryScan",
  "processScan",
  "createShare",
  "revokeShare",
  "deleteMyData",
  "processDeletion",
  "monitorRetention",
];
const missing = expected.filter((name) => !deployed.some((id) => id.includes(name)));
if (missing.length) throw new Error(`Missing deployed functions: ${missing.join(", ")}`);

console.log(`Verified ${expected.length} Firebase Functions in ${projectId}: ${expected.join(", ")}`);
