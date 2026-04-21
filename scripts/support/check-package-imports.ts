import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

type PackageImportContractsConfig = {
  packages: Record<
    string,
    {
      allowWorkspaceImports?: string[];
      allowWorkspaceImportsInTests?: string[];
    }
  >;
};

type ImportHit = {
  specifier: string;
  line: number;
  column: number;
};

type WorkspacePackageInfo = {
  name: string;
  packageRoot: string;
};

const DEFAULT_ROOTS = ["packages", "services", "infra", "web", "scripts", "tests"];
const DEFAULT_CONTRACTS = "tools/package-import-contracts.json";
const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".next",
  ".cache",
  ".terraform",
  "coverage",
  "out"
]);
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

const parseArgs = () => {
  const args = process.argv.slice(2);
  let roots = DEFAULT_ROOTS;
  let contracts = DEFAULT_CONTRACTS;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--roots") {
      const raw = args[index + 1] ?? "";
      roots = raw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      index += 1;
      continue;
    }

    if (args[index] === "--contracts") {
      contracts = args[index + 1] ?? contracts;
      index += 1;
    }
  }

  return { roots, contracts };
};

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

const walkFiles = (rootPath: string): string[] => {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const output: string[] = [];

  const walk = (currentPath: string) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || IGNORE_DIRS.has(entry.name)) {
        continue;
      }

      const nextPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(nextPath);
        continue;
      }

      if (!entry.isFile() || entry.name.endsWith(".d.ts")) {
        continue;
      }

      if (SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
        output.push(nextPath);
      }
    }
  };

  walk(rootPath);
  return output;
};

const scriptKindForPath = (filePath: string): ts.ScriptKind => {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }

  if (filePath.endsWith(".ts")) {
    return ts.ScriptKind.TS;
  }

  return ts.ScriptKind.JS;
};

const collectImportsFromFile = (filePath: string): ImportHit[] => {
  const content = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(filePath)
  );
  const hits: ImportHit[] = [];

  const pushHit = (specifier: string, position: number) => {
    const location = sourceFile.getLineAndCharacterOfPosition(position);
    hits.push({
      specifier,
      line: location.line + 1,
      column: location.character + 1
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      pushHit(node.moduleSpecifier.text, node.moduleSpecifier.getStart(sourceFile));
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      pushHit(node.moduleSpecifier.text, node.moduleSpecifier.getStart(sourceFile));
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const [firstArgument] = node.arguments;

      if (firstArgument && ts.isStringLiteralLike(firstArgument)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          pushHit(firstArgument.text, firstArgument.getStart(sourceFile));
        } else if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
          pushHit(firstArgument.text, firstArgument.getStart(sourceFile));
        }
      }
    }

    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);
  return hits;
};

const isTestFile = (filePath: string): boolean =>
  filePath.includes(`${path.sep}tests${path.sep}`) ||
  filePath.endsWith(".test.ts") ||
  filePath.endsWith(".test.tsx") ||
  filePath.endsWith(".spec.ts") ||
  filePath.endsWith(".spec.tsx");

const collectWorkspacePackages = (repoRoot: string): WorkspacePackageInfo[] => {
  const manifests: string[] = [];

  const packagesRoot = path.join(repoRoot, "packages");
  if (fs.existsSync(packagesRoot)) {
    for (const entry of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }

      const manifestPath = path.join(packagesRoot, entry.name, "package.json");
      if (fs.existsSync(manifestPath)) {
        manifests.push(manifestPath);
      }
    }
  }

  const infraConfigManifest = path.join(repoRoot, "infra", "config", "package.json");
  if (fs.existsSync(infraConfigManifest)) {
    manifests.push(infraConfigManifest);
  }

  return manifests.map((manifestPath) => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { name: string };
    return {
      name: manifest.name,
      packageRoot: path.dirname(manifestPath)
    };
  });
};

const findOwningPackage = (
  filePath: string,
  workspacePackages: WorkspacePackageInfo[]
): WorkspacePackageInfo | undefined =>
  workspacePackages.find((pkg) => filePath.startsWith(`${pkg.packageRoot}${path.sep}`));

const readContracts = (repoRoot: string, contractsPath: string): PackageImportContractsConfig =>
  JSON.parse(fs.readFileSync(path.resolve(repoRoot, contractsPath), "utf8")) as PackageImportContractsConfig;

const run = () => {
  const { roots, contracts } = parseArgs();
  const repoRoot = findRepoRoot(process.cwd());
  const workspacePackages = collectWorkspacePackages(repoRoot);
  const localPackageNames = new Set(workspacePackages.map((pkg) => pkg.name));
  const contractsConfig = readContracts(repoRoot, contracts);
  const violations: string[] = [];
  const files = roots.flatMap((root) => walkFiles(path.join(repoRoot, root)));

  for (const filePath of files) {
    const owningPackage = findOwningPackage(filePath, workspacePackages);
    const contract = owningPackage ? contractsConfig.packages[owningPackage.name] : undefined;
    const allowedImports = new Set(contract?.allowWorkspaceImports ?? []);
    const allowedTestImports = new Set(contract?.allowWorkspaceImportsInTests ?? []);

    for (const hit of collectImportsFromFile(filePath)) {
      const matchedPackage = [...localPackageNames].find(
        (packageName) => hit.specifier === packageName || hit.specifier.startsWith(`${packageName}/`)
      );

      if (!matchedPackage) {
        continue;
      }

      if (
        hit.specifier.includes("/src/") ||
        hit.specifier.endsWith("/src") ||
        hit.specifier.includes("/dist/") ||
        hit.specifier.endsWith("/dist")
      ) {
        violations.push(
          `${path.relative(repoRoot, filePath)}:${hit.line}:${hit.column} imports private workspace path ${hit.specifier}.`
        );
        continue;
      }

      if (!owningPackage || matchedPackage === owningPackage.name) {
        continue;
      }

      const isAllowed = allowedImports.has(matchedPackage);
      const isAllowedInTests = isTestFile(filePath) && allowedTestImports.has(matchedPackage);

      if (!isAllowed && !isAllowedInTests) {
        violations.push(
          `${path.relative(repoRoot, filePath)}:${hit.line}:${hit.column} imports ${matchedPackage} without a contract entry.`
        );
      }
    }
  }

  if (violations.length === 0) {
    console.log("[package-imports] OK");
    return;
  }

  console.error("[package-imports] Failed.");
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
};

run();
