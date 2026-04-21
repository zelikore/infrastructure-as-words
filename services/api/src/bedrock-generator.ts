import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput
} from "@aws-sdk/client-bedrock-runtime";
import type { GenerationSettings, SubmissionAiUsage, SubmissionDetail } from "@infrastructure-as-words/contracts";
import {
  approximateTokenCount,
  aggregateAiUsage,
  readInvocationUsage,
  type BedrockInvocationUsage
} from "./bedrock-usage.js";
import { estimateTokenCostUsd, roundUsd } from "./bedrock-pricing.js";
import { getEnvironment } from "./environment.js";
import type { GenerationDraft } from "./generation-schema.js";
import { normalizeGenerationDraft } from "./generation-normalizer.js";

const bedrockClient = new BedrockRuntimeClient({});
const MAX_OUTPUT_TOKENS = 10_000;
const MAX_SUCCESSFUL_MODEL_CALLS_PER_REQUEST = 2;
const MODULE_DOC_LIMIT = 320;

type PromptSet = {
  systemPrompt: string;
  userPrompt: string;
};

type DraftTextResponse = {
  modelId: string;
  text: string;
  usage: BedrockInvocationUsage;
};

export class BedrockGenerationError extends Error {
  readonly aiUsage: SubmissionAiUsage | undefined;

  constructor(message: string, aiUsage?: SubmissionAiUsage) {
    super(message);
    this.name = "BedrockGenerationError";
    this.aiUsage = aiUsage;
  }
}

const formatSettings = (settings: GenerationSettings): string =>
  [
    `Organization: ${settings.organizationName}`,
    `Preferred regions: ${settings.preferredRegions.join(", ")}`,
    "Guardrails:",
    ...settings.guardrails.map((rule) => `- ${rule}`),
    "Baseline limitations:",
    ...settings.limitationsTemplate.map((rule) => `- ${rule}`),
    "Prioritized module catalog:",
    ...settings.modules.map(
      (module) =>
        `- ${module.moduleId} | visibility=${module.visibility} | priority=${module.priority} | required=${module.required ? "yes" : "no"} | category=${module.category} | capabilities=${module.capabilities.join(",")} | source=${module.source} | description=${module.description} | docs=${module.documentation.summary} | notes=${module.documentation.howItWorks.slice(0, MODULE_DOC_LIMIT)}`
    ),
    "Additional guidance:",
    settings.guidance
  ].join("\n");

const buildSystemPrompt = (settings: GenerationSettings): string =>
  [
    "You are an AWS platform architect that produces implementation-ready Terraform starter repositories.",
    "Design for AWS only. Prefer managed and serverless primitives when they satisfy the request cleanly.",
    "Follow the organization's guardrails and prioritize modules according to the catalog.",
    "If a catalog module fits the request, use that source in the generated Terraform instead of inventing a new source.",
    "Every catalog module marked required=yes must be included in modules[] and represented in the generated files when technically feasible.",
    "When no listed module is a clean fit, use native AWS resources with the hashicorp/aws provider.",
    "Keep the repository compact, apply-ready, and easy to understand.",
    "Return JSON only. Do not wrap it in markdown or prose.",
    "Return minified JSON on a single line.",
    "The JSON must have: name, summary, explanation[], limitations[], modules[], files[], diagram{nodes[],edges[]}.",
    "Each explanation item must be an object with title and detail.",
    "Each limitation must be a plain string, not an object.",
    "Each module item must be an object with moduleId, label, source, visibility, and reason.",
    "Each file item must include path, language, and content.",
    "Use only these file language values: hcl, md, json, yaml, text. Use md for Markdown files.",
    "Do not include archive files such as .zip, .tar, or other packaged artifacts in files[]. Return source files only.",
    "The files should usually include README.md, versions.tf, providers.tf, main.tf, variables.tf, and outputs.tf unless the request justifies more.",
    "The diagram nodes should capture the major user-facing and infrastructure components only. Do not include coordinates.",
    "Each diagram node must include id, label, and kind. Valid kinds are: client, dns, cdn, auth, network, compute, storage, database, queue, integration, observability.",
    "Each diagram edge must use source and target keys. Do not use from/to.",
    "Keep explanation to at most 4 items, limitations to at most 4 items, modules to at most 6 items, and file contents concise.",
    "Keep README.md brief and avoid unnecessary comments or whitespace in generated files.",
    "Example module item: {\"moduleId\":\"terraform-aws-lambda\",\"label\":\"Lambda Service\",\"source\":\"terraform-aws-modules/lambda/aws\",\"visibility\":\"public\",\"reason\":\"Matched prioritized module catalog entry Lambda Service.\"}"
  ]
    .concat("", formatSettings(settings))
    .join("\n");

const buildUserPrompt = (submission: SubmissionDetail): string =>
  [
    "User request:",
    submission.description,
    "",
    "Generate Terraform for the requested AWS system.",
    "Explain how it works, list the main limitations, and produce a diagram model for a browser-based architecture view.",
    "Keep the output realistic. If some details are ambiguous, make safe assumptions and mention them in the explanation or limitations."
  ].join("\n");

const buildPrompts = (input: {
  submission: SubmissionDetail;
  settings: GenerationSettings;
}): PromptSet => ({
  systemPrompt: buildSystemPrompt(input.settings),
  userPrompt: buildUserPrompt(input.submission)
});

const readTextFromResponse = (response: ConverseCommandOutput): string => {
  const blocks = response.output?.message?.content ?? [];
  return blocks
    .flatMap((block) => ("text" in block && typeof block.text === "string" ? [block.text] : []))
    .join("\n")
    .trim();
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
    throw new Error("Bedrock did not return a JSON object.");
  }

  return trimmed.slice(start, end + 1);
};

const parseDraft = (value: string, settings: GenerationSettings): GenerationDraft => {
  const parsed = JSON.parse(extractJson(value)) as unknown;
  return normalizeGenerationDraft(parsed, settings);
};

const shouldRetryParse = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /unterminated|unexpected end|json|invalid/i.test(error.message);
};

const shouldTryNextModel = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /permission_error|accessdenied|access denied|subscription|marketplace/i.test(error.message);
};

const requestDraftText = async (input: {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
}): Promise<DraftTextResponse> => {
  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId: input.modelId,
      system: [
        {
          text: input.systemPrompt
        }
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              text: input.userPrompt
            }
          ]
        }
      ],
      inferenceConfig: {
        maxTokens: input.maxTokens
      }
    })
  );

  const text = readTextFromResponse(response);
  if (!text) {
    throw new Error("Bedrock returned an empty response.");
  }

  return {
    modelId: input.modelId,
    text,
    usage: readInvocationUsage(response, input.modelId)
  };
};

const requestDraftTextFromAnyModel = async (input: {
  modelIds: string[];
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
}): Promise<DraftTextResponse> => {
  let lastError: unknown;

  for (const modelId of input.modelIds) {
    try {
      return await requestDraftText({
        modelId,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        maxTokens: input.maxTokens
      });
    } catch (error) {
      lastError = error;
      if (!shouldTryNextModel(error)) {
        throw error;
      }

      console.warn(`Bedrock model ${modelId} unavailable, trying next candidate.`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No Bedrock model candidates were usable.");
};

export const estimateTerraformGenerationReservationUsd = (input: {
  submission: SubmissionDetail;
  settings: GenerationSettings;
  modelIds: string[];
}): number => {
  const prompts = buildPrompts(input);
  const inputTokenEstimate =
    approximateTokenCount(prompts.systemPrompt) + approximateTokenCount(prompts.userPrompt);
  const worstCaseSingleCallUsd = input.modelIds.reduce((highestCostUsd, modelId) => {
    const estimatedCostUsd = estimateTokenCostUsd({
      modelId,
      inputTokens: inputTokenEstimate,
      outputTokens: MAX_OUTPUT_TOKENS
    });

    return Math.max(highestCostUsd, estimatedCostUsd);
  }, 0);

  return roundUsd(worstCaseSingleCallUsd * MAX_SUCCESSFUL_MODEL_CALLS_PER_REQUEST);
};

export const generateTerraformSubmission = async (input: {
  submission: SubmissionDetail;
  settings: GenerationSettings;
  reservedCostUsd: number;
}): Promise<{
  draft: GenerationDraft;
  aiUsage: SubmissionAiUsage;
}> => {
  const environment = getEnvironment();
  const prompts = buildPrompts(input);
  const initial = await requestDraftTextFromAnyModel({
    modelIds: environment.BEDROCK_MODEL_IDS,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    maxTokens: MAX_OUTPUT_TOKENS
  });

  try {
    const aiUsage = aggregateAiUsage([initial.usage], input.reservedCostUsd);
    if (!aiUsage) {
      throw new Error("Expected AI usage for a successful generation.");
    }

    return {
      draft: parseDraft(initial.text, input.settings),
      aiUsage
    };
  } catch (error) {
    if (!shouldRetryParse(error)) {
      throw new BedrockGenerationError(
        error instanceof Error ? error.message : "Generation failed unexpectedly.",
        aggregateAiUsage([initial.usage], input.reservedCostUsd)
      );
    }
  }

  const retry = await requestDraftText({
    modelId: initial.modelId,
    systemPrompt: `${prompts.systemPrompt}\nThe previous response was invalid or truncated. Retry from scratch with a smaller, more compact payload.`,
    userPrompt: `${prompts.userPrompt}\nRetry from scratch. Keep the repository minimal and the JSON compact.`,
    maxTokens: MAX_OUTPUT_TOKENS
  });

  try {
    const aiUsage = aggregateAiUsage([initial.usage, retry.usage], input.reservedCostUsd);
    if (!aiUsage) {
      throw new Error("Expected AI usage for a successful generation.");
    }

    return {
      draft: parseDraft(retry.text, input.settings),
      aiUsage
    };
  } catch (error) {
    throw new BedrockGenerationError(
      error instanceof Error ? error.message : "Generation failed unexpectedly.",
      aggregateAiUsage([initial.usage, retry.usage], input.reservedCostUsd)
    );
  }
};
