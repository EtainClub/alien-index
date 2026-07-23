import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const candidateNames = ["OPENAI_API_KEY", "OPENAPI_API_KEY", "OPENAPI_KEY"];
const candidate = candidateNames
  .map((name) => ({ name, match: envText.match(new RegExp(`^${name}=(.*)$`, "m")) }))
  .find(({ match }) => match?.[1]?.trim());

if (!candidate?.match) {
  throw new Error(".env.local에 OPENAI_API_KEY를 추가하세요. 값은 NEXT_PUBLIC_ 접두사를 사용하지 않습니다.");
}

if (process.argv.includes("--check")) {
  console.log(`${candidate.name}=set`);
  process.exit(0);
}

const value = candidate.match[1].trim().replace(/^['"]|['"]$/g, "");
const child = spawn("firebase", ["functions:secrets:set", "OPENAI_API_KEY", "--project", "alien-index"], {
  stdio: ["pipe", "inherit", "inherit"],
});
child.stdin.end(`${value}\n`);
child.on("exit", (code) => process.exit(code ?? 1));
