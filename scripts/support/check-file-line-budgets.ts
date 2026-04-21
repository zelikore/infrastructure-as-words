import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type BudgetConfig = {
  threshold?: number;
  thresholdsByPath?: Record<string, number>;
  budgets?: Record<string, number>;
};

type BudgetTarget = {
  root: string;
  config?: string;
};

type ResolvedBudgetTarget = {
  root: string;
  config: string;
};

type BudgetTargetsConfig = {
  defaultConfig?: string;
  targets: BudgetTarget[];
};

type FileStat = {
  relativePath: string;
  lines: number;
  threshold: number;
};

const DEFAULT_THRESHOLD = 1000;

const parseArgs = () => {
  const args = process.argv.slice(2);
  let root = ".";
  let config = "tools/file-line-budgets-default.json";
  let targets: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root") {
      root = args[index + 1] ?? root;
      index += 1;
    } else if (arg === "--config") {
      config = args[index + 1] ?? config;
      index += 1;
    } else if (arg === "--targets") {
      targets = args[index + 1] ?? targets;
      index += 1;
    }
  }

  return { root, config, targets };
};

const normalizePath = (value: string): string => value.split(path.sep).join("/");

const hasWorkspacePackageJson = (candidateDir: string): boolean => {
  const packageJsonPath = path.join(candidateDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
    return Array.isArray(parsed["workspaces"]);
  } catch {
    return false;
  }
};

const findRepoRoot = (startPath: string): string => {
  let current = path.resolve(startPath);
  let previous = "";

  while (current !== previous) {
    if (hasWorkspacePackageJson(current) || fs.existsSync(path.join(current, ".git"))) {
      return current;
    }

    previous = current;
    current = path.dirname(current);
  }

  return path.resolve(startPath);
};

const resolveFilePath = (candidate: string, repoRoot: string): string => {
  const direct = path.resolve(process.cwd(), candidate);
  if (fs.existsSync(direct)) {
    return direct;
  }

  const fromRepo = path.resolve(repoRoot, candidate);
  if (fs.existsSync(fromRepo)) {
    return fromRepo;
  }

  return direct;
};

const collectSourceFiles = (rootPath: string): string[] => {
  const output: string[] = [];

  const walk = (current: string) => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === ".next" ||
          entry.name === ".terraform"
        ) {
          continue;
        }
        walk(path.join(current, entry.name));
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (!/\.(ts|tsx|tf)$/u.test(entry.name) || entry.name.endsWith(".d.ts")) {
        continue;
      }
      output.push(path.join(current, entry.name));
    }
  };

  walk(rootPath);
  return output;
};

const countLines = (value: string): number => {
  if (value.length === 0) {
    return 0;
  }
  const newlineCount = (value.match(/\n/g) ?? []).length;
  return value.endsWith("\n") ? newlineCount : newlineCount + 1;
};

const normalizeThresholdPrefixes = (
  raw: Record<string, number> | undefined
): Array<{ prefix: string; threshold: number }> => {
  if (!raw) {
    return [];
  }

  return Object.entries(raw)
    .filter(([, threshold]) => Number.isFinite(threshold) && threshold > 0)
    .map(([prefix, threshold]) => {
      const normalized = normalizePath(prefix).replace(/^\.\//u, "").replace(/\/+$/u, "");
      return {
        prefix: normalized,
        threshold
      };
    })
    .sort((left, right) => right.prefix.length - left.prefix.length);
};

const resolveThresholdForFile = (
  relativePath: string,
  defaultThreshold: number,
  thresholdsByPath: Array<{ prefix: string; threshold: number }>
): number => {
  for (const entry of thresholdsByPath) {
    if (relativePath === entry.prefix || relativePath.startsWith(`${entry.prefix}/`)) {
      return entry.threshold;
    }
  }
  return defaultThreshold;
};

const parseTargetsConfig = (
  value: unknown,
  sourcePath: string
): { defaultConfig?: string; targets: BudgetTarget[] } => {
  if (!value || typeof value !== "object" || !("targets" in value)) {
    throw new Error(
      `[file-line-budgets] Invalid targets config: ${sourcePath} (expected { targets: [...] }).`
    );
  }

  const targetsValue = (value as BudgetTargetsConfig).targets;
  if (!Array.isArray(targetsValue) || targetsValue.length === 0) {
    throw new Error(
      `[file-line-budgets] Invalid targets config: ${sourcePath} (targets must be a non-empty array).`
    );
  }

  const targets: BudgetTarget[] = [];
  for (const entry of targetsValue) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as BudgetTarget).root !== "string" ||
      ("config" in entry && typeof (entry as BudgetTarget).config !== "string")
    ) {
      throw new Error(
        `[file-line-budgets] Invalid target entry in ${sourcePath}; each target requires string root and optional string config fields.`
      );
    }

    const target = entry as BudgetTarget;
    targets.push(
      typeof target.config === "string"
        ? { root: target.root, config: target.config }
        : { root: target.root }
    );
  }

  const defaultConfigValue =
    "defaultConfig" in value ? (value as BudgetTargetsConfig).defaultConfig : undefined;

  if (defaultConfigValue !== undefined && typeof defaultConfigValue !== "string") {
    throw new Error(
      `[file-line-budgets] Invalid targets config: ${sourcePath} (defaultConfig must be a string when provided).`
    );
  }

  return {
    ...(defaultConfigValue ? { defaultConfig: defaultConfigValue } : {}),
    targets
  };
};

const runBudgetCheck = (target: ResolvedBudgetTarget): boolean => {
  const { root, config } = target;
  const cwdRepoRoot = findRepoRoot(process.cwd());
  const resolvedRoot = resolveFilePath(root, cwdRepoRoot);
  const resolvedConfig = resolveFilePath(config, cwdRepoRoot);
  const repoRoot = findRepoRoot(resolvedRoot);

  if (!fs.existsSync(resolvedRoot)) {
    console.error(`[file-line-budgets] Root not found: ${resolvedRoot}`);
    return false;
  }

  if (!fs.existsSync(resolvedConfig)) {
    console.error(`[file-line-budgets] Config not found: ${resolvedConfig}`);
    return false;
  }

  const rawConfig = fs.readFileSync(resolvedConfig, "utf8");
  const parsedConfig = JSON.parse(rawConfig) as BudgetConfig;
  const defaultThreshold =
    typeof parsedConfig.threshold === "number" && parsedConfig.threshold > 0
      ? parsedConfig.threshold
      : DEFAULT_THRESHOLD;
  const thresholdsByPath = normalizeThresholdPrefixes(parsedConfig.thresholdsByPath);
  const budgets = parsedConfig.budgets ?? {};

  const fileStats: FileStat[] = collectSourceFiles(resolvedRoot).map((filePath) => {
    const relativePath = normalizePath(path.relative(repoRoot, filePath));
    const sourceText = fs.readFileSync(filePath, "utf8");
    return {
      relativePath,
      lines: countLines(sourceText),
      threshold: resolveThresholdForFile(relativePath, defaultThreshold, thresholdsByPath)
    };
  });

  const failures: FileStat[] = [];
  for (const fileStat of fileStats) {
    const explicitBudget = budgets[fileStat.relativePath];
    const maxLines =
      typeof explicitBudget === "number" && explicitBudget > 0 ? explicitBudget : fileStat.threshold;

    if (fileStat.lines > maxLines) {
      failures.push({ ...fileStat, threshold: maxLines });
    }
  }

  if (failures.length === 0) {
    console.log(`[file-line-budgets] OK ${root}`);
    return true;
  }

  console.error(`[file-line-budgets] Failed ${root}`);
  for (const failure of failures.sort((left, right) => right.lines - left.lines)) {
    console.error(
      `[file-line-budgets] ${failure.relativePath} has ${failure.lines} lines (budget ${failure.threshold}).`
    );
  }
  return false;
};

const main = () => {
  const { root, config, targets } = parseArgs();
  const repoRoot = findRepoRoot(process.cwd());

  const resolvedTargets: ResolvedBudgetTarget[] = [];
  if (targets) {
    const targetsPath = resolveFilePath(targets, repoRoot);
    const parsed = parseTargetsConfig(
      JSON.parse(fs.readFileSync(targetsPath, "utf8")),
      targetsPath
    );
    for (const target of parsed.targets) {
      resolvedTargets.push({
        root: target.root,
        config: target.config ?? parsed.defaultConfig ?? config
      });
    }
  } else {
    resolvedTargets.push({ root, config });
  }

  let ok = true;
  for (const target of resolvedTargets) {
    ok = runBudgetCheck(target) && ok;
  }

  if (!ok) {
    process.exit(1);
  }
};

main();

