import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { configuredBasePath } from "./config.mjs";

const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url);
const forwardedArgs = process.argv.slice(2);

const code = await new Promise((resolve, reject) => {
  const child = spawn(
    process.execPath,
    [fileURLToPath(nextBin), "build", "--webpack", ...forwardedArgs],
    { env: process.env, stdio: "inherit" },
  );
  child.on("error", reject);
  child.on("exit", (exitCode, signal) => {
    if (signal) reject(new Error(`빌드가 ${signal} 신호로 종료되었습니다.`));
    else resolve(exitCode ?? 1);
  });
});

if (code !== 0) process.exit(code);

await mkdir(new URL("../.next", import.meta.url), { recursive: true });
await writeFile(
  new URL("../.next/alien-build-meta.json", import.meta.url),
  `${JSON.stringify({ basePath: configuredBasePath, builtAt: new Date().toISOString() }, null, 2)}\n`,
);
