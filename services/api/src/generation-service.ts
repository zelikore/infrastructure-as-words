import { Buffer } from "node:buffer";

import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import {
  generatedArchitectureSchema,
  type SubmissionAiUsage,
} from "@infrastructure-as-words/contracts";
import { uploadTerraformArtifact } from "./artifact-storage.js";
import {
  BedrockGenerationError,
  estimateTerraformGenerationReservationUsd,
  generateTerraformSubmission,
} from "./bedrock-generator.js";
import { buildSubmissionDiagram } from "./diagram-layout.js";
import { getEnvironment } from "./environment.js";
import {
  releaseGenerationBudgetReservation,
  reserveGenerationBudget,
  settleGenerationBudgetReservation,
} from "./generation-budget.js";
import { logStructuredEvent } from "./observability.js";
import {
  completeSubmissionGeneration,
  failSubmissionGeneration,
  getGenerationSettings,
  getSubmissionForGeneration,
  setSubmissionBudgetReservation,
} from "./submission-repository.js";

const lambdaClient = new LambdaClient({});

type GenerateSubmissionEvent = {
  type: "generate-submission";
  submissionId: string;
};

const truncateFailureMessage = (value: unknown): string => {
  const message =
    value instanceof Error ? value.message : "Generation failed unexpectedly.";
  return message.slice(0, 320);
};

export const isGenerateSubmissionEvent = (
  value: unknown,
): value is GenerateSubmissionEvent => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record["type"] === "generate-submission" &&
    typeof record["submissionId"] === "string" &&
    record["submissionId"].length > 0
  );
};

export const queueSubmissionGeneration = async (
  submissionId: string,
): Promise<void> => {
  const environment = getEnvironment();
  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: environment.CURRENT_FUNCTION_NAME,
      InvocationType: "Event",
      Payload: Buffer.from(
        JSON.stringify({
          type: "generate-submission",
          submissionId,
        } satisfies GenerateSubmissionEvent),
      ),
    }),
  );
};

export const runSubmissionGeneration = async (
  submissionId: string,
  requestId?: string,
): Promise<void> => {
  const startedAt = Date.now();
  let submission = await getSubmissionForGeneration(submissionId);
  if (!submission) {
    logStructuredEvent({
      level: "ERROR",
      eventType: "generation_run",
      requestId: requestId ?? `missing:${submissionId}`,
      route: "async:generate-submission",
      submissionId,
      status: "missing",
      latencyMs: Date.now() - startedAt,
      errorMessage: `Submission ${submissionId} was not found.`,
    });
    throw new Error(`Submission ${submissionId} was not found.`);
  }

  if (submission.status !== "pending") {
    logStructuredEvent({
      eventType: "generation_run",
      requestId: requestId ?? `skip:${submissionId}`,
      route: "async:generate-submission",
      userSub: submission.userSub,
      submissionId,
      status: submission.status,
      latencyMs: Date.now() - startedAt,
    });
    return;
  }

  let reservedBudgetUsd = submission.budgetReservationUsd;
  let reservedBudgetPeriodKey = submission.budgetReservationPeriodKey;
  let capturedAiUsage: SubmissionAiUsage | undefined;

  try {
    const settings = await getGenerationSettings();
    const reservationUsd =
      reservedBudgetUsd ??
      estimateTerraformGenerationReservationUsd({
        submission,
        settings,
        modelIds: getEnvironment().BEDROCK_MODEL_IDS,
      });

    if (
      !submission.budgetReservationUsd ||
      !submission.budgetReservationPeriodKey
    ) {
      const budget = await reserveGenerationBudget({
        monthlyLimitUsd: settings.budgetPolicy.monthlyLimitUsd,
        reservationUsd,
      });
      reservedBudgetUsd = reservationUsd;
      reservedBudgetPeriodKey = budget.periodKey;

      submission = await setSubmissionBudgetReservation({
        submissionId,
        reservationUsd,
        periodKey: budget.periodKey,
      });
    }

    const result = await generateTerraformSubmission({
      submission,
      settings,
      reservedCostUsd: reservationUsd,
    });
    capturedAiUsage = result.aiUsage;
    const { artifact, manifest } = await uploadTerraformArtifact({
      submissionId,
      name: result.draft.name,
      files: result.draft.files,
    });

    const architecture = generatedArchitectureSchema.parse({
      name: result.draft.name,
      summary: result.draft.summary,
      explanation: result.draft.explanation,
      limitations: result.draft.limitations,
      modules: result.draft.modules,
      files: manifest,
      diagram: buildSubmissionDiagram(result.draft.diagram),
    });

    await settleGenerationBudgetReservation({
      monthlyLimitUsd: settings.budgetPolicy.monthlyLimitUsd,
      reservationUsd,
      actualCostUsd: result.aiUsage.actualCostUsd,
      ...(reservedBudgetPeriodKey
        ? { periodKey: reservedBudgetPeriodKey }
        : {}),
    });

    await completeSubmissionGeneration({
      submissionId,
      architecture,
      artifact,
      aiUsage: result.aiUsage,
    });

    logStructuredEvent({
      eventType: "generation_run",
      requestId: requestId ?? `generation:${submissionId}`,
      route: "async:generate-submission",
      userSub: submission.userSub,
      submissionId,
      status: "completed",
      latencyMs: Date.now() - startedAt,
      costUsd: result.aiUsage.actualCostUsd,
    });
  } catch (error) {
    const failureUsage =
      capturedAiUsage ??
      (error instanceof BedrockGenerationError ? error.aiUsage : undefined);

    if (reservedBudgetUsd) {
      const settings = await getGenerationSettings();
      if (failureUsage) {
        await settleGenerationBudgetReservation({
          monthlyLimitUsd: settings.budgetPolicy.monthlyLimitUsd,
          reservationUsd: reservedBudgetUsd,
          actualCostUsd: failureUsage.actualCostUsd,
          ...(reservedBudgetPeriodKey
            ? { periodKey: reservedBudgetPeriodKey }
            : {}),
        });
      } else {
        await releaseGenerationBudgetReservation({
          monthlyLimitUsd: settings.budgetPolicy.monthlyLimitUsd,
          reservationUsd: reservedBudgetUsd,
          ...(reservedBudgetPeriodKey
            ? { periodKey: reservedBudgetPeriodKey }
            : {}),
        });
      }
    }

    await failSubmissionGeneration({
      submissionId,
      failureMessage: truncateFailureMessage(error),
      ...(failureUsage ? { aiUsage: failureUsage } : {}),
    });

    logStructuredEvent({
      level: "ERROR",
      eventType: "generation_run",
      requestId: requestId ?? `generation:${submissionId}`,
      route: "async:generate-submission",
      userSub: submission.userSub,
      submissionId,
      status: "failed",
      latencyMs: Date.now() - startedAt,
      ...(failureUsage ? { costUsd: failureUsage.actualCostUsd } : {}),
      errorMessage: truncateFailureMessage(error),
    });
  }
};
