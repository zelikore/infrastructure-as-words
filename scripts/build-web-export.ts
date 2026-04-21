import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.resolve(rootDir, "web");
const outputRoot = path.resolve(webRoot, "out");
const cacheRoot = path.resolve(rootDir, ".cache", "web-build", "final");

const parseEnvironment = (): "dev" | "prod" => {
  const envIndex = process.argv.indexOf("--env");
  const value = envIndex >= 0 ? process.argv[envIndex + 1] : process.env["DEPLOY_ENV"];
  if (value === "dev" || value === "prod") {
    return value;
  }
  throw new Error('Missing --env <dev|prod> for the web export build.');
};

const deployEnv = parseEnvironment();
const stagedOutputDir = path.resolve(cacheRoot, deployEnv);

const runCommand = (command: string, args: string[], cwd: string) => {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      DEPLOY_ENV: deployEnv
    },
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")} (exit ${result.status ?? "unknown"})`
    );
  }
};

rmSync(path.resolve(webRoot, ".next"), { force: true, recursive: true });
rmSync(path.resolve(webRoot, "out"), { force: true, recursive: true });

runCommand(
  path.resolve(rootDir, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next"),
  ["build"],
  webRoot
);

if (!existsSync(path.resolve(webRoot, "out", "index.html"))) {
  throw new Error("Next.js export did not produce an index.html file.");
}

rmSync(stagedOutputDir, { force: true, recursive: true });
mkdirSync(cacheRoot, { recursive: true });
cpSync(path.resolve(webRoot, "out"), stagedOutputDir, { recursive: true });

rmSync(outputRoot, { force: true, recursive: true });
mkdirSync(outputRoot, { recursive: true });

for (const entry of ["dev", "prod"] as const) {
  const sourceDir = path.resolve(cacheRoot, entry);
  if (!existsSync(sourceDir)) {
    continue;
  }
  cpSync(sourceDir, path.resolve(outputRoot, entry), { recursive: true });
}
