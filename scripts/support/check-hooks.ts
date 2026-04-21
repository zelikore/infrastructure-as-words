import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";

interface HookIssue {
  file: string;
  line: number;
  column: number;
  message: string;
}

const ROOTS = ["web"];
const CONDITIONAL_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.DefaultClause,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
]);

const HOOK_NAME_PATTERN = /^use[A-Z0-9].*/;

const isTestFile = (filePath: string) =>
  filePath.includes(`${path.sep}__tests__${path.sep}`) ||
  filePath.endsWith(".test.ts") ||
  filePath.endsWith(".test.tsx") ||
  filePath.endsWith(".spec.ts") ||
  filePath.endsWith(".spec.tsx");

const collectFiles = (root: string): string[] => {
  const files: string[] = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  }

  return files;
};

const buildParentMap = (source: ts.SourceFile) => {
  const parent = new Map<ts.Node, ts.Node>();

  const visit = (node: ts.Node) => {
    node.forEachChild((child) => {
      parent.set(child, node);
      visit(child);
    });
  };

  visit(source);
  return parent;
};

const getHookName = (
  call: ts.CallExpression,
  source: ts.SourceFile,
): string => {
  const expr = call.expression;
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }

  if (ts.isPropertyAccessExpression(expr)) {
    return expr.name.text;
  }

  return call.getText(source);
};

const isHookCall = (node: ts.Node): node is ts.CallExpression => {
  if (!ts.isCallExpression(node)) {
    return false;
  }

  const expr = node.expression;
  if (ts.isIdentifier(expr)) {
    return HOOK_NAME_PATTERN.test(expr.text);
  }

  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
    return HOOK_NAME_PATTERN.test(expr.name.text);
  }

  return false;
};

const getEnclosingFunction = (
  node: ts.Node,
  parent: Map<ts.Node, ts.Node>,
): ts.FunctionLikeDeclaration | undefined => {
  let current: ts.Node | undefined = node;

  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current)
    ) {
      return current;
    }

    current = parent.get(current);
  }

  return undefined;
};

const getFunctionName = (
  fn: ts.FunctionLikeDeclaration,
  parent: Map<ts.Node, ts.Node>,
): string | null => {
  if (fn.name && ts.isIdentifier(fn.name)) {
    return fn.name.text;
  }

  const fnParent = parent.get(fn);
  if (
    fnParent &&
    ts.isVariableDeclaration(fnParent) &&
    ts.isIdentifier(fnParent.name)
  ) {
    return fnParent.name.text;
  }

  return null;
};

const isWrappedComponent = (
  fn: ts.FunctionLikeDeclaration,
  parent: Map<ts.Node, ts.Node>,
): boolean => {
  let current: ts.Node | undefined = fn;

  while (current) {
    const maybeCall = parent.get(current);
    if (!maybeCall || !ts.isCallExpression(maybeCall)) {
      return false;
    }

    const callee = maybeCall.expression;
    let calleeName: string | null = null;
    if (ts.isIdentifier(callee)) {
      calleeName = callee.text;
    } else if (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.name)
    ) {
      calleeName = callee.name.text;
    }

    if (calleeName && (calleeName === "memo" || calleeName === "forwardRef")) {
      return true;
    }

    current = maybeCall;
  }

  return false;
};

const isComponentLike = (
  fn: ts.FunctionLikeDeclaration,
  parent: Map<ts.Node, ts.Node>,
): boolean => {
  const name = getFunctionName(fn, parent);
  if (name && (/^[A-Z]/.test(name) || HOOK_NAME_PATTERN.test(name))) {
    return true;
  }

  return isWrappedComponent(fn, parent);
};

const containsHookCall = (node: ts.Node): boolean => {
  let found = false;

  const visit = (child: ts.Node) => {
    if (found) {
      return;
    }

    if (ts.isFunctionLike(child) && child !== node) {
      return;
    }

    if (isHookCall(child)) {
      found = true;
      return;
    }

    child.forEachChild(visit);
  };

  node.forEachChild(visit);
  return found;
};

const statementContainsReturn = (node: ts.Statement): boolean => {
  let found = false;

  const visit = (child: ts.Node) => {
    if (found) {
      return;
    }

    if (ts.isReturnStatement(child)) {
      found = true;
      return;
    }

    child.forEachChild(visit);
  };

  node.forEachChild(visit);
  return found;
};

const findProblematicAncestor = (
  node: ts.Node,
  fn: ts.FunctionLikeDeclaration,
  parent: Map<ts.Node, ts.Node>,
): ts.Node | undefined => {
  let current = parent.get(node);

  while (current && current !== fn) {
    if (CONDITIONAL_KINDS.has(current.kind)) {
      return current;
    }

    current = parent.get(current);
  }

  return undefined;
};

const analyzeFunctionForEarlyReturns = (
  fn: ts.FunctionLikeDeclaration,
  source: ts.SourceFile,
  parent: Map<ts.Node, ts.Node>,
): HookIssue[] => {
  const issues: HookIssue[] = [];
  if (!isComponentLike(fn, parent)) {
    return issues;
  }

  if (!fn.body || !ts.isBlock(fn.body)) {
    return issues;
  }

  const statements = Array.from(fn.body.statements);
  let firstHookIndex = -1;
  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index];
    if (!statement) {
      continue;
    }

    if (containsHookCall(statement)) {
      firstHookIndex = index;
      break;
    }
  }

  if (firstHookIndex === -1) {
    return issues;
  }

  for (let index = 0; index < firstHookIndex; index += 1) {
    const statement = statements[index];
    if (!statement) {
      continue;
    }

    if (ts.isReturnStatement(statement)) {
      const { line, character } = source.getLineAndCharacterOfPosition(
        statement.getStart(),
      );
      issues.push({
        file: source.fileName,
        line: line + 1,
        column: character + 1,
        message:
          "Return before first hook. Move conditional returns below hook declarations.",
      });
      continue;
    }

    if (
      (ts.isIfStatement(statement) || ts.isSwitchStatement(statement)) &&
      statementContainsReturn(statement)
    ) {
      const { line, character } = source.getLineAndCharacterOfPosition(
        statement.getStart(),
      );
      issues.push({
        file: source.fileName,
        line: line + 1,
        column: character + 1,
        message:
          "Conditional return before first hook. Move hooks above control flow guards.",
      });
    }
  }

  return issues;
};

const analyzeFile = (filePath: string): HookIssue[] => {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const parent = buildParentMap(source);
  const issues: HookIssue[] = [];

  const visit = (node: ts.Node) => {
    if (isHookCall(node)) {
      const fn = getEnclosingFunction(node, parent);
      const hookName = getHookName(node, source);
      if (!fn) {
        const { line, character } = source.getLineAndCharacterOfPosition(
          node.getStart(),
        );
        issues.push({
          file: filePath,
          line: line + 1,
          column: character + 1,
          message: `Hook ${hookName} must be called from a React function component or custom hook.`,
        });
      } else if (!isComponentLike(fn, parent)) {
        const { line, character } = source.getLineAndCharacterOfPosition(
          node.getStart(),
        );
        issues.push({
          file: filePath,
          line: line + 1,
          column: character + 1,
          message: `Hook ${hookName} is invoked inside non-component function '${getFunctionName(fn, parent) ?? "<anonymous>"}'. Extract a custom hook or move it to the component body.`,
        });
      } else if (findProblematicAncestor(node, fn, parent)) {
        const { line, character } = source.getLineAndCharacterOfPosition(
          node.getStart(),
        );
        issues.push({
          file: filePath,
          line: line + 1,
          column: character + 1,
          message: `Hook ${hookName} is called inside a conditional or loop. Move it to the top level of the component.`,
        });
      }
    }

    node.forEachChild(visit);
  };

  visit(source);

  const functionIssues: HookIssue[] = [];
  const collectFunctions = (node: ts.Node) => {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      functionIssues.push(
        ...analyzeFunctionForEarlyReturns(node, source, parent),
      );
    }

    node.forEachChild(collectFunctions);
  };

  collectFunctions(source);

  return [...issues, ...functionIssues];
};

export const checkHooks = (roots: string[] = ROOTS): HookIssue[] => {
  const allIssues: HookIssue[] = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue;
    }

    const files = collectFiles(root);
    for (const file of files) {
      if (isTestFile(file)) {
        continue;
      }

      const issues = analyzeFile(file);
      allIssues.push(...issues);
    }
  }

  return allIssues;
};

const main = () => {
  const issues = checkHooks();
  if (issues.length === 0) {
    return;
  }

  const relativeIssues = issues
    .sort(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        left.column - right.column,
    )
    .map((issue) => ({
      ...issue,
      file: path.relative(process.cwd(), issue.file),
    }));

  for (const issue of relativeIssues) {
    console.error(
      `${issue.file}:${issue.line}:${issue.column} ${issue.message}`,
    );
  }

  process.exitCode = 1;
};

const cliEntry = pathToFileURL(process.argv[1] ?? "").href;
if (import.meta.url === cliEntry) {
  main();
}
