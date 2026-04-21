import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import type { SubmissionAiUsage } from "@infrastructure-as-words/contracts";
import {
  estimateTokenCostUsd,
  roundUsd
} from "./bedrock-pricing.js";

export type BedrockInvocationUsage = {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  totalTokens: number;
  actualCostUsd: number;
};

export const approximateTokenCount = (value: string): number =>
  Math.max(1, Math.ceil(value.length / 3));

export const aggregateAiUsage = (
  usageRecords: BedrockInvocationUsage[],
  reservedCostUsd: number
): SubmissionAiUsage | undefined => {
  if (usageRecords.length === 0) {
    return undefined;
  }

  return {
    modelIds: [...new Set(usageRecords.map((usage) => usage.modelId))],
    attempts: usageRecords.length,
    inputTokens: usageRecords.reduce((sum, usage) => sum + usage.inputTokens, 0),
    outputTokens: usageRecords.reduce((sum, usage) => sum + usage.outputTokens, 0),
    cacheReadInputTokens: usageRecords.reduce(
      (sum, usage) => sum + usage.cacheReadInputTokens,
      0
    ),
    totalTokens: usageRecords.reduce((sum, usage) => sum + usage.totalTokens, 0),
    actualCostUsd: roundUsd(usageRecords.reduce((sum, usage) => sum + usage.actualCostUsd, 0)),
    reservedCostUsd: roundUsd(reservedCostUsd),
    pricedAt: new Date().toISOString()
  };
};

export const readInvocationUsage = (
  response: ConverseCommandOutput,
  modelId: string
): BedrockInvocationUsage => {
  const inputTokens = response.usage?.inputTokens ?? 0;
  const outputTokens = response.usage?.outputTokens ?? 0;
  const cacheReadInputTokens = response.usage?.cacheReadInputTokens ?? 0;
  const totalTokens = response.usage?.totalTokens ?? inputTokens + outputTokens;

  return {
    modelId,
    inputTokens,
    outputTokens,
    cacheReadInputTokens,
    totalTokens,
    actualCostUsd: estimateTokenCostUsd({
      modelId,
      inputTokens,
      outputTokens,
      cacheReadInputTokens
    })
  };
};
