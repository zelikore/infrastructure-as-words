import assert from "node:assert/strict";
import test from "node:test";
import { estimateTokenCostUsd } from "../../services/api/src/bedrock-pricing.js";

void test("bedrock pricing matches the configured Opus 4.7 token rates", () => {
  const cost = estimateTokenCostUsd({
    modelId: "us.anthropic.claude-opus-4-7",
    inputTokens: 100_000,
    outputTokens: 2_000
  });

  assert.equal(cost, 0.605);
});

void test("bedrock pricing includes cache read cost when present", () => {
  const cost = estimateTokenCostUsd({
    modelId: "us.anthropic.claude-opus-4-6-v1",
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 100_000
  });

  assert.equal(cost, 0.055);
});
