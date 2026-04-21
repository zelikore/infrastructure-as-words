import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const UNUSED_DIAGNOSTIC_PATTERN = /error TS(6133|6138|6192|6196):/;

const resolveRepoRoot = (): string =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const listWorkspaceTsconfigs = (repoRoot: string): string[] => {
  const configs = new Set<string>();

  const collectFromDir = (dir: string) => {
    const absolute = path.join(repoRoot, dir);
    if (!fs.existsSync(absolute)) {
      return;
    }

    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }

      const candidate = path.join(dir, entry.name, "tsconfig.json");
      if (fs.existsSync(path.join(repoRoot, candidate))) {
        configs.add(candidate);
      }
    }
  };

  collectFromDir("packages");
  collectFromDir("services");
  collectFromDir("infra");

  for (const candidate of [
    "web/tsconfig.json",
    "scripts/tsconfig.json",
    "tests/tsconfig.json"
  ]) {
    if (fs.existsSync(path.join(repoRoot, candidate))) {
      configs.add(candidate);
    }
  }

  return [...configs].sort();
};

const runCheck = (
  repoRoot: string,
  configPath: string
): { ok: boolean; unusedDiagnostics: string[]; otherOutput: string[] } => {
  const tscBin = path.join(
    repoRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsc.cmd" : "tsc"
  );

  const result = spawnSync(tscBin, ["-p", configPath, "--noEmit", "--pretty", "false"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env
  });

  const mergedOutput = [result.stdout, result.stderr]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");

  const lines = mergedOutput
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  const unusedDiagnostics = lines.filter((line) => UNUSED_DIAGNOSTIC_PATTERN.test(line));
  const otherOutput = lines.filter((line) => !UNUSED_DIAGNOSTIC_PATTERN.test(line));

  if (unusedDiagnostics.length > 0) {
    return { ok: false, unusedDiagnostics, otherOutput };
  }

  if ((result.status ?? 1) !== 0) {
    return { ok: false, unusedDiagnostics: [], otherOutput };
  }

  return { ok: true, unusedDiagnostics: [], otherOutput: [] };
};

const main = () => {
  const repoRoot = resolveRepoRoot();
  const configs = listWorkspaceTsconfigs(repoRoot);

  if (configs.length === 0) {
    console.error("[lint:unused] No workspace tsconfig.json files found.");
    process.exit(1);
  }

  const failures: Array<{
    config: string;
    unusedDiagnostics: string[];
    otherOutput: string[];
  }> = [];

  for (const [index, config] of configs.entries()) {
    console.log(`[lint:unused] Running ${index + 1}/${configs.length}: ${config}`);
    const result = runCheck(repoRoot, config);
    if (!result.ok) {
      failures.push({
        config,
        unusedDiagnostics: result.unusedDiagnostics,
        otherOutput: result.otherOutput
      });
    }
  }

  if (failures.length === 0) {
    console.log(`[lint:unused] OK (${configs.length} workspace tsconfig files checked).`);
    return;
  }

  console.error("[lint:unused] Failed.");
  for (const failure of failures) {
    console.error(`\n[lint:unused] ${failure.config}`);
    if (failure.unusedDiagnostics.length > 0) {
      for (const line of failure.unusedDiagnostics) {
        console.error(line);
      }
      continue;
    }

    const preview = failure.otherOutput.slice(0, 20);
    for (const line of preview) {
      console.error(line);
    }
    if (failure.otherOutput.length > preview.length) {
      console.error(
        `[lint:unused] ... ${failure.otherOutput.length - preview.length} more lines omitted`
      );
    }
  }

  process.exit(1);
};

main();

