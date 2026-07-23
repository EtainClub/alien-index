import { execFileSync } from "node:child_process";

const projectId = process.env.GCLOUD_PROJECT ?? "alien-index";
const services = [
  "cloudfunctions.googleapis.com",
  "cloudbuild.googleapis.com",
  "artifactregistry.googleapis.com",
  "run.googleapis.com",
  "eventarc.googleapis.com",
  "pubsub.googleapis.com",
  "cloudtasks.googleapis.com",
  "secretmanager.googleapis.com",
];

execFileSync("gcloud", ["components", "install", "beta", "--quiet"], { stdio: "inherit" });

for (const service of services) {
  execFileSync("gcloud", ["beta", "services", "identity", "create", `--service=${service}`, `--project=${projectId}`, "--quiet"], {
    stdio: "inherit",
  });
}

console.log(`Ensured Google service identities for ${projectId}.`);
