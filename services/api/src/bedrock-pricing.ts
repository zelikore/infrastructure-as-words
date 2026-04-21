export type BedrockPricing = {
  modelId: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  cacheReadPerMillionUsd: number;
  priceScope: "geo-in-region-cross-region";
  pricedAt: string;
};

const pricingByModelId: Record<string, BedrockPricing> = {
  "us.anthropic.claude-opus-4-7": {
    modelId: "us.anthropic.claude-opus-4-7",
    inputPerMillionUsd: 5.5,
    outputPerMillionUsd: 27.5,
    cacheReadPerMillionUsd: 0.55,
    priceScope: "geo-in-region-cross-region",
    pricedAt: "2026-04-20T00:00:00.000Z"
  },
  "us.anthropic.claude-opus-4-6-v1": {
    modelId: "us.anthropic.claude-opus-4-6-v1",
    inputPerMillionUsd: 5.5,
    outputPerMillionUsd: 27.5,
    cacheReadPerMillionUsd: 0.55,
    priceScope: "geo-in-region-cross-region",
    pricedAt: "2026-04-20T00:00:00.000Z"
  }
};

export const roundUsd = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

export const getBedrockPricing = (modelId: string): BedrockPricing => {
  const pricing = pricingByModelId[modelId];
  if (!pricing) {
    throw new Error(`No pricing metadata is configured for model ${modelId}.`);
  }

  return pricing;
};

export const estimateTokenCostUsd = (input: {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
}): number => {
  const pricing = getBedrockPricing(input.modelId);
  const cacheReadInputTokens = input.cacheReadInputTokens ?? 0;

  return roundUsd(
    (input.inputTokens / 1_000_000) * pricing.inputPerMillionUsd +
      (input.outputTokens / 1_000_000) * pricing.outputPerMillionUsd +
      (cacheReadInputTokens / 1_000_000) * pricing.cacheReadPerMillionUsd
  );
};
