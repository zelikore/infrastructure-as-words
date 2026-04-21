import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(
  fileURLToPath(new URL("../package.json", import.meta.url))
);
const eslintBinary = process.platform === "win32" ? "eslint.cmd" : "eslint";
const eslintPath = path.resolve(rootDir, "node_modules", ".bin", eslintBinary);

const invocationCwd = process.cwd();
const rawArgs = process.argv.slice(2);
const typedFlagIndex = rawArgs.indexOf("--typed");
const useTypedLint = typedFlagIndex !== -1;
const userArgs = useTypedLint ? rawArgs.filter((arg) => arg !== "--typed") : rawArgs;

const readRootPackageName = () => {
  try {
    const rootPackageJson = path.resolve(rootDir, "package.json");
    const parsed = JSON.parse(readFileSync(rootPackageJson, "utf8"));
    if (typeof parsed?.name === "string" && parsed.name.length > 0) {
      return parsed.name;
    }
  } catch {
    return "infrastructure-as-words";
  }

  return "infrastructure-as-words";
};

const packageName = process.env.npm_package_name ?? readRootPackageName();
const cacheDir = path.resolve(rootDir, ".cache", "eslint");
mkdirSync(cacheDir, { recursive: true });

const sanitizedName = packageName.replace(/[^a-zA-Z0-9._-]/g, "-");
const cacheSuffix = useTypedLint ? "typed" : "untyped";
const cacheLocation = path.resolve(
  cacheDir,
  `${sanitizedName}.${cacheSuffix}.eslintcache`
);

const resolveTarget = (value) => {
  if (value.startsWith("-")) {
    return value;
  }

  const fromInvocation = path.resolve(invocationCwd, value);
  const fromRoot = path.resolve(rootDir, value);
  const resolved = existsSync(fromInvocation)
    ? fromInvocation
    : existsSync(fromRoot)
      ? fromRoot
      : fromInvocation;

  const relative = path.relative(rootDir, resolved);
  return relative.length > 0 ? relative : ".";
};

const args = [
  "--cache",
  `--cache-location=${cacheLocation}`,
  "--max-warnings=0",
  "--config",
  path.resolve(rootDir, "eslint.config.mjs"),
  ...userArgs.map(resolveTarget)
];

const env = { ...process.env };
if (useTypedLint) {
  env.INFRASTRUCTURE_AS_WORDS_ESLINT_TYPED = "1";
}

const child = spawn(eslintPath, args, {
  cwd: rootDir,
  env,
  stdio: "inherit"
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});
