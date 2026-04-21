#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const gateListPath = resolve(repoRoot, "tests/critical-test-gate.txt");
const runnerPath = resolve(repoRoot, "tests/run-node-tests.mjs");

const suites = readFileSync(gateListPath, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));

for (const suite of suites) {
  console.log(`[critical] ${suite}`);
  const result = spawnSync(process.execPath, [runnerPath, suite], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
