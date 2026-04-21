import path from "node:path";
import {
  getChangedFiles,
  getDiff,
  hasBlockingFindings,
  parseReviewConfig,
  readJsonFile,
  renderReviewMarkdown,
  requestReview,
  resolveBaseSha,
  resolveHeadSha,
  truncateDiff,
  writeOptionalFile,
  type ReviewResult,
} from "./pr-review-core.ts";
import {
  appendStepSummary,
  syncPullRequestComment,
} from "./pr-review-github.ts";

type ParsedArgs = {
  configPath: string;
  baseSha: string | undefined;
  headSha: string | undefined;
  outputJsonPath: string | undefined;
  outputMarkdownPath: string | undefined;
  mockResponsePath: string | undefined;
};

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);
  let configPath = "tools/pr-review-requirements.json";
  let baseSha: string | undefined;
  let headSha: string | undefined;
  let outputJsonPath: string | undefined;
  let outputMarkdownPath: string | undefined;
  let mockResponsePath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--config") {
      configPath = next ?? configPath;
      index += 1;
      continue;
    }
    if (arg === "--base") {
      baseSha = next ?? baseSha;
      index += 1;
      continue;
    }
    if (arg === "--head") {
      headSha = next ?? headSha;
      index += 1;
      continue;
    }
    if (arg === "--output-json") {
      outputJsonPath = next ?? outputJsonPath;
      index += 1;
      continue;
    }
    if (arg === "--output-markdown") {
      outputMarkdownPath = next ?? outputMarkdownPath;
      index += 1;
      continue;
    }
    if (arg === "--mock-response") {
      mockResponsePath = next ?? mockResponsePath;
      index += 1;
    }
  }

  return {
    configPath,
    baseSha,
    headSha,
    outputJsonPath,
    outputMarkdownPath,
    mockResponsePath,
  };
};

const main = async () => {
  const args = parseArgs();
  const config = parseReviewConfig(
    readJsonFile<unknown>(path.resolve(args.configPath)),
  );
  const baseSha = resolveBaseSha(args.baseSha);
  const headSha = resolveHeadSha(args.headSha);
  const changedFiles = getChangedFiles(baseSha, headSha);
  const diff = getDiff(baseSha, headSha);
  const { truncatedDiff, truncated } = truncateDiff(
    diff,
    config.maxDiffCharacters,
  );

  const result: ReviewResult =
    changedFiles.length === 0
      ? {
          summary: "No changed files were detected between the provided SHAs.",
          verdict: "pass",
          findings: [],
        }
      : await requestReview({
          config,
          baseSha,
          headSha,
          changedFiles,
          diff: truncatedDiff,
          truncated,
          mockResponsePath: args.mockResponsePath,
        });

  const markdown = renderReviewMarkdown({
    config,
    baseSha,
    headSha,
    changedFiles,
    truncated,
    result,
  });

  writeOptionalFile(args.outputMarkdownPath, markdown);
  writeOptionalFile(args.outputJsonPath, JSON.stringify(result, null, 2));
  appendStepSummary(markdown);
  await syncPullRequestComment(markdown, config.commentMarker);
  console.log(markdown);

  if (hasBlockingFindings(result, config)) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
