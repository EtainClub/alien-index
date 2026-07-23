import { execFileSync } from "node:child_process";

const projectId = process.env.GCLOUD_PROJECT ?? "alien-index";
const serviceName = (process.argv[2] ?? "createscan").toLowerCase();
const since = process.env.LOG_SINCE ?? "2026-07-22T23:00:00Z";
const limit = process.env.LOG_LIMIT ?? "30";
const filter = [
  'resource.type="cloud_run_revision"',
  `resource.labels.service_name="${serviceName}"`,
  `timestamp >= "${since}"`,
  ...(process.env.LOG_STATUS ? [`httpRequest.status=${process.env.LOG_STATUS}`] : []),
  ...(process.env.LOG_MESSAGE ? [`jsonPayload.message="${process.env.LOG_MESSAGE}"`] : []),
].join(" AND ");

const output = execFileSync(
  "gcloud",
  ["logging", "read", filter, `--project=${projectId}`, `--limit=${limit}`, process.env.LOG_JSON === "1" ? "--format=json" : process.env.LOG_AI === "1" ? "--format=value(timestamp,jsonPayload.message,jsonPayload.textModel,jsonPayload.imageModel,jsonPayload.promptVersion,jsonPayload.scanIdHash)" : "--format=value(timestamp,severity,httpRequest.status,httpRequest.requestMethod,httpRequest.requestUrl,jsonPayload.message,textPayload)"],
  { encoding: "utf8" },
);
console.log(output);
