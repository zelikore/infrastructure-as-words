#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const readGitRoot = () => {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return undefined;
  }

  return result.stdout.trim();
};

const gitRoot = readGitRoot();
if (!gitRoot) {
  console.warn("Skipping git hook setup because this directory is not a git checkout.");
  process.exit(0);
}

if (resolve(gitRoot) !== repoRoot) {
  console.warn("Skipping git hook setup because the resolved git root did not match the repo root.");
  process.exit(0);
}

const configureHooks = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (configureHooks.status !== 0) {
  process.exit(configureHooks.status ?? 1);
}

console.log("Configured git hooks at .githooks");
