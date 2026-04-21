import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

type ReviewConfig = {
  modelId: string;
  commentMarker: string;
  maxDiffCharacters: number;
  failOnSeverities: string[];
  requirements: Array<{
    id: string;
    title: string;
    severity: string;
    instruction: string;
  }>;
};

const configPath = path.resolve(
  process.cwd(),
  "tools",
  "pr-review-requirements.json",
);

void test("PR review config defines a model, marker, and unique requirements", () => {
  const config = JSON.parse(
    fs.readFileSync(configPath, "utf8"),
  ) as ReviewConfig;

  assert.match(config.modelId, /claude-opus/i);
  assert.equal(config.commentMarker.includes("iaw-pr-ai-review"), true);
  assert.equal(config.maxDiffCharacters > 0, true);
  assert.deepEqual(config.failOnSeverities, ["critical", "high"]);
  assert.equal(config.requirements.length >= 5, true);

  const ids = config.requirements.map((requirement) => requirement.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    config.requirements.every(
      (requirement) =>
        requirement.title.length > 0 &&
        requirement.instruction.length > 0 &&
        ["critical", "high", "medium", "low"].includes(requirement.severity),
    ),
    true,
  );
});
