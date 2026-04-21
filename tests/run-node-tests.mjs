#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const tsconfigPath = resolve(repoRoot, "tests", "tsconfig.json");
const forwardedArgs = process.argv.slice(2);
const nodeArgs = [];
const targetArgs = [];

for (const arg of forwardedArgs) {
  if (arg.startsWith("--")) {
    nodeArgs.push(arg);
    continue;
  }

  targetArgs.push(arg);
}

if (targetArgs.length === 0) {
  console.error(
    "Usage: node tests/run-node-tests.mjs <test-file-or-directory>",
  );
  process.exit(1);
}

const testFileExtensions = new Set([
  ".test.ts",
  ".test.tsx",
  ".spec.ts",
  ".spec.tsx",
]);

const collectTestFiles = (entryPath) => {
  if (!existsSync(entryPath)) {
    throw new Error(`Test target not found: ${entryPath}`);
  }

  const stats = statSync(entryPath);

  if (stats.isDirectory()) {
    if (basename(entryPath) === "e2e") {
      return [];
    }

    return readdirSync(entryPath)
      .flatMap((child) => collectTestFiles(join(entryPath, child)))
      .filter(Boolean);
  }

  const matched = Array.from(testFileExtensions).some((suffix) =>
    entryPath.endsWith(suffix),
  );

  return matched ? [entryPath] : [];
};

const resolvedTargets = targetArgs
  .flatMap((entry) => collectTestFiles(resolve(process.cwd(), entry)))
  .sort((left, right) => left.localeCompare(right));

if (resolvedTargets.length === 0) {
  console.error("No test files matched the provided inputs.");
  process.exit(1);
}

const testTargets = resolvedTargets.map((filePath) =>
  relative(repoRoot, filePath),
);

const child = spawn(
  process.execPath,
  ["--import", "tsx", ...nodeArgs, "--test", ...testTargets],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: tsconfigPath,
    },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
