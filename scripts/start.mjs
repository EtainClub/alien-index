import { access, readFile, readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { configuredBasePath } from "./config.mjs";

const projectRoot = new URL("../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url);
const buildId = new URL("../.next/BUILD_ID", import.meta.url);
const buildMeta = new URL("../.next/alien-build-meta.json", import.meta.url);
const buildScript = new URL("./build.mjs", import.meta.url);

const sourceEntries = [
  "app",
  "components",
  "lib",
  "public",
  "scripts",
  "next.config.mjs",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
];

async function newestModifiedAt(path) {
  const entry = await stat(path);
  if (!entry.isDirectory()) return entry.mtimeMs;

  const children = await readdir(path, { withFileTypes: true });
  const times = await Promise.all(
    children.map((child) => newestModifiedAt(join(path, child.name))),
  );
  return Math.max(entry.mtimeMs, ...times);
}

async function buildReason() {
  try {
    await access(nextBin);
  } catch {
    console.error("Next.js가 설치되어 있지 않습니다. 먼저 `npm ci`를 실행해 주세요.");
    process.exit(1);
  }

  let builtAt;
  try {
    builtAt = (await stat(buildId)).mtimeMs;
  } catch {
    return "프로덕션 빌드가 없습니다";
  }

  try {
    const meta = JSON.parse(await readFile(buildMeta, "utf8"));
    if (meta.basePath !== configuredBasePath) {
      return `배포 경로가 변경되었습니다 (${meta.basePath || "/"} → ${configuredBasePath || "/"})`;
    }
  } catch {
    return "빌드 메타데이터가 없습니다";
  }

  for (const entry of sourceEntries) {
    try {
      const modifiedAt = await newestModifiedAt(join(projectRootPath, entry));
      if (modifiedAt > builtAt) return `${entry}가 마지막 빌드 이후 변경되었습니다`;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  return null;
}

function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(script), ...args], {
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`프로세스가 ${signal} 신호로 종료되었습니다.`));
      else resolve(code ?? 1);
    });
  });
}

const reason = await buildReason();
if (reason) {
  console.log(`[start] ${reason}. 최신 소스로 다시 빌드합니다.`);
  const buildCode = await run(buildScript, []);
  if (buildCode !== 0) process.exit(buildCode);
}

const startCode = await run(nextBin, ["start", ...process.argv.slice(2)]);
process.exit(startCode);
