import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

export type ReviewSeverity = "critical" | "high" | "medium" | "low";

export type ReviewRequirement = {
  id: string;
  title: string;
  severity: ReviewSeverity;
  instruction: string;
};

export type ReviewConfig = {
  modelId: string;
  commentMarker: string;
  maxDiffCharacters: number;
  failOnSeverities: ReviewSeverity[];
  requirements: ReviewRequirement[];
};

export type ReviewFinding = {
  requirementId: string;
  severity: ReviewSeverity;
  title: string;
  details: string;
  files: string[];
  confidence: "high" | "medium" | "low";
};

export type ReviewResult = {
  summary: string;
  verdict: "pass" | "needs-attention";
  findings: ReviewFinding[];
};

const severityOrder: Record<ReviewSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const ensureString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${label}.`);
  }

  return value.trim();
};

const ensureSeverity = (value: unknown, label: string): ReviewSeverity => {
  if (
    value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
  ) {
    return value;
  }

  throw new Error(`Invalid ${label}.`);
};

export const parseReviewConfig = (value: unknown): ReviewConfig => {
  if (!value || typeof value !== "object") {
    throw new Error("PR review config must be an object.");
  }

  const record = value as Record<string, unknown>;
  if (
    !Array.isArray(record["requirements"]) ||
    record["requirements"].length === 0
  ) {
    throw new Error(
      "PR review config requires a non-empty requirements array.",
    );
  }

  const requirements = record["requirements"].map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Requirement ${index + 1} must be an object.`);
    }

    const requirement = entry as Record<string, unknown>;
    return {
      id: ensureString(requirement["id"], `requirements[${index}].id`),
      title: ensureString(requirement["title"], `requirements[${index}].title`),
      severity: ensureSeverity(
        requirement["severity"],
        `requirements[${index}].severity`,
      ),
      instruction: ensureString(
        requirement["instruction"],
        `requirements[${index}].instruction`,
      ),
    } satisfies ReviewRequirement;
  });

  return {
    modelId: ensureString(record["modelId"], "modelId"),
    commentMarker: ensureString(record["commentMarker"], "commentMarker"),
    maxDiffCharacters:
      typeof record["maxDiffCharacters"] === "number" &&
      record["maxDiffCharacters"] > 0
        ? record["maxDiffCharacters"]
        : 120000,
    failOnSeverities: Array.isArray(record["failOnSeverities"])
      ? record["failOnSeverities"].map((entry, index) =>
          ensureSeverity(entry, `failOnSeverities[${index}]`),
        )
      : ["critical", "high"],
    requirements,
  };
};

export const readJsonFile = <T>(filePath: string): T =>
  JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const runGit = (args: string[]): string => {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed.`);
  }

  return result.stdout.trim();
};

export const resolveBaseSha = (value: string | undefined): string => {
  if (value) {
    return value;
  }

  if (process.env["PR_BASE_SHA"]) {
    return process.env["PR_BASE_SHA"];
  }

  if (process.env["GITHUB_BASE_REF"]) {
    return runGit([
      "merge-base",
      `origin/${process.env["GITHUB_BASE_REF"]}`,
      "HEAD",
    ]);
  }

  throw new Error("Missing PR base SHA.");
};

export const resolveHeadSha = (value: string | undefined): string => {
  if (value) {
    return value;
  }

  if (process.env["PR_HEAD_SHA"]) {
    return process.env["PR_HEAD_SHA"];
  }

  return runGit(["rev-parse", "HEAD"]);
};

export const getChangedFiles = (baseSha: string, headSha: string): string[] =>
  runGit(["diff", "--name-only", `${baseSha}...${headSha}`])
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

export const getDiff = (baseSha: string, headSha: string): string =>
  runGit([
    "diff",
    "--find-renames",
    "--unified=3",
    `${baseSha}...${headSha}`,
    "--",
    ".",
    ":(exclude)package-lock.json",
  ]);

export const truncateDiff = (
  diff: string,
  maxCharacters: number,
): { truncatedDiff: string; truncated: boolean } => {
  if (diff.length <= maxCharacters) {
    return { truncatedDiff: diff, truncated: false };
  }

  return {
    truncatedDiff: `${diff.slice(0, maxCharacters)}\n\n[diff truncated for AI review]\n`,
    truncated: true,
  };
};

const stripMarkdownFence = (value: string): string => {
  if (!value.startsWith("```")) {
    return value;
  }

  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
};

const extractJson = (value: string): string => {
  const trimmed = stripMarkdownFence(value.trim());
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("AI review did not return a JSON object.");
  }

  return trimmed.slice(start, end + 1);
};

const normalizeFiles = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];

const normalizeConfidence = (value: unknown): ReviewFinding["confidence"] =>
  value === "high" || value === "medium" || value === "low" ? value : "medium";

const normalizeReviewResult = (value: unknown): ReviewResult => {
  if (!value || typeof value !== "object") {
    return {
      summary: "AI review returned an invalid payload.",
      verdict: "needs-attention",
      findings: [
        {
          requirementId: "ai-review",
          severity: "high",
          title: "AI review payload was invalid",
          details:
            "The PR review job could not parse the AI response into the expected schema.",
          files: [],
          confidence: "high",
        },
      ],
    };
  }

  const record = value as Record<string, unknown>;
  const rawFindings = Array.isArray(record["findings"])
    ? record["findings"]
    : [];

  const findings = rawFindings
    .map((entry): ReviewFinding | undefined => {
      if (!entry || typeof entry !== "object") {
        return undefined;
      }

      const finding = entry as Record<string, unknown>;
      try {
        return {
          requirementId:
            typeof finding["requirementId"] === "string" &&
            finding["requirementId"].trim().length > 0
              ? finding["requirementId"].trim()
              : "unspecified",
          severity: ensureSeverity(finding["severity"], "finding.severity"),
          title: ensureString(finding["title"], "finding.title"),
          details: ensureString(finding["details"], "finding.details"),
          files: normalizeFiles(finding["files"]),
          confidence: normalizeConfidence(finding["confidence"]),
        };
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is ReviewFinding => Boolean(entry))
    .sort(
      (left, right) =>
        severityOrder[left.severity] - severityOrder[right.severity],
    );

  const verdict =
    record["verdict"] === "pass" || record["verdict"] === "needs-attention"
      ? record["verdict"]
      : findings.length > 0
        ? "needs-attention"
        : "pass";

  return {
    summary:
      typeof record["summary"] === "string" &&
      record["summary"].trim().length > 0
        ? record["summary"].trim()
        : findings.length > 0
          ? "AI review found issues that need attention."
          : "AI review did not find concrete issues against the configured requirements.",
    verdict,
    findings,
  };
};

const buildPrompts = (input: {
  config: ReviewConfig;
  baseSha: string;
  headSha: string;
  changedFiles: string[];
  diff: string;
  truncated: boolean;
}) => {
  const systemPrompt = [
    "You are a senior platform engineering reviewer.",
    "Review the pull request diff against the configured repository requirements.",
    "Only report concrete, material issues visible in the diff.",
    "Ignore style nits, speculative concerns, and anything not supported by the changed code.",
    "Return JSON only.",
    "Return an object with keys: summary, verdict, findings.",
    'verdict must be "pass" or "needs-attention".',
    "findings must be an array of objects with keys: requirementId, severity, title, details, files, confidence.",
    "severity must be one of: critical, high, medium, low.",
    "confidence must be one of: high, medium, low.",
    "If there are no real issues, return an empty findings array and verdict=pass.",
  ].join("\n");

  const userPrompt = [
    `Base SHA: ${input.baseSha}`,
    `Head SHA: ${input.headSha}`,
    `Changed files (${input.changedFiles.length}):`,
    ...input.changedFiles.map((filePath) => `- ${filePath}`),
    "",
    "Review requirements:",
    ...input.config.requirements.map(
      (requirement) =>
        `- ${requirement.id} | severity=${requirement.severity} | ${requirement.title} | ${requirement.instruction}`,
    ),
    "",
    input.truncated
      ? "The diff was truncated to fit the review budget. Focus on the provided diff only."
      : "Full diff follows.",
    "",
    "Diff:",
    input.diff,
  ].join("\n");

  return { systemPrompt, userPrompt };
};

const readTextFromResponse = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    return "";
  }

  const output = (value as Record<string, unknown>)["output"];
  if (!output || typeof output !== "object") {
    return "";
  }

  const message = (output as Record<string, unknown>)["message"];
  if (!message || typeof message !== "object") {
    return "";
  }

  const content = (message as Record<string, unknown>)["content"];
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .flatMap((block) => {
      if (!block || typeof block !== "object") {
        return [];
      }

      const text = (block as Record<string, unknown>)["text"];
      return typeof text === "string" && text.trim().length > 0 ? [text] : [];
    })
    .join("\n")
    .trim();
};

export const requestReview = async (input: {
  config: ReviewConfig;
  baseSha: string;
  headSha: string;
  changedFiles: string[];
  diff: string;
  truncated: boolean;
  mockResponsePath: string | undefined;
}): Promise<ReviewResult> => {
  if (input.mockResponsePath) {
    return normalizeReviewResult(readJsonFile<unknown>(input.mockResponsePath));
  }

  const { systemPrompt, userPrompt } = buildPrompts(input);
  const client = new BedrockRuntimeClient({
    region: process.env["AWS_REGION"] ?? "us-west-2",
  });

  const response = await client.send(
    new ConverseCommand({
      modelId: input.config.modelId,
      system: [{ text: systemPrompt }],
      messages: [
        {
          role: "user",
          content: [{ text: userPrompt }],
        },
      ],
      inferenceConfig: { maxTokens: 2500 },
    }),
  );

  const text = readTextFromResponse(response);
  if (!text) {
    throw new Error("AI review returned an empty response.");
  }

  return normalizeReviewResult(JSON.parse(extractJson(text)) as unknown);
};

export const renderReviewMarkdown = (input: {
  config: ReviewConfig;
  baseSha: string;
  headSha: string;
  changedFiles: string[];
  truncated: boolean;
  result: ReviewResult;
}): string => {
  const findingsSection =
    input.result.findings.length === 0
      ? "No concrete issues were found against the configured review requirements."
      : input.result.findings
          .map((finding) => {
            const files =
              finding.files.length > 0
                ? `\nFiles: ${finding.files.join(", ")}`
                : "";
            return [
              `### ${finding.severity.toUpperCase()} · ${finding.title}`,
              `Requirement: \`${finding.requirementId}\``,
              `Confidence: ${finding.confidence}`,
              `${finding.details}${files}`,
            ].join("\n");
          })
          .join("\n\n");

  return [
    input.config.commentMarker,
    "## AI PR Review",
    "",
    `Verdict: **${input.result.verdict === "pass" ? "No blocking issues found" : "Needs attention"}**`,
    "",
    input.result.summary,
    "",
    `Model: \`${input.config.modelId}\``,
    `Base: \`${input.baseSha.slice(0, 12)}\``,
    `Head: \`${input.headSha.slice(0, 12)}\``,
    `Changed files: ${input.changedFiles.length}`,
    `Diff truncated: ${input.truncated ? "yes" : "no"}`,
    "",
    findingsSection,
  ].join("\n");
};

export const writeOptionalFile = (
  filePath: string | undefined,
  value: string,
): void => {
  if (!filePath) {
    return;
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, value);
};

export const hasBlockingFindings = (
  result: ReviewResult,
  config: ReviewConfig,
): boolean => {
  const failingSeverities = new Set(config.failOnSeverities);
  return result.findings.some((finding) =>
    failingSeverities.has(finding.severity),
  );
};
