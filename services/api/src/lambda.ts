import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import {
  adminObservabilityResponseSchema,
  generationSettingsInputSchema,
  generationSettingsResponseSchema,
  submissionDetailResponseSchema,
  submissionInputSchema,
  submissionsResponseSchema,
  workspaceProfileResponseSchema,
} from "@infrastructure-as-words/contracts";
import {
  forbiddenResponse,
  getSubmissionIdFromPath,
  isApiGatewayEvent,
  notFoundResponse,
  parseRequestBody,
  readUserSubFromEvent,
  toErrorResponse,
} from "./api-routing.js";
import { createArtifactDownloadUrl } from "./artifact-storage.js";
import { isAdminRequest } from "./admin-auth.js";
import { loadAdminObservabilitySnapshot } from "./admin-observability.js";
import { getEnvironment } from "./environment.js";
import { getGenerationBudgetStatus } from "./generation-budget.js";
import {
  isGenerateSubmissionEvent,
  queueSubmissionGeneration,
  runSubmissionGeneration,
} from "./generation-service.js";
import {
  buildObservabilityConsoleLinks,
  logStructuredEvent,
} from "./observability.js";
import { jsonResponse, requireAuthenticatedRequest } from "./http.js";
import {
  createSubmission,
  failSubmissionGeneration,
  getGenerationSettings,
  getSubmissionForUser,
  listSubmissions,
  saveGenerationSettings,
} from "./submission-repository.js";

const withDownloadUrl = async (
  submission: Awaited<ReturnType<typeof getSubmissionForUser>>,
) => {
  if (!submission || !submission.artifact) {
    return submission;
  }

  return {
    ...submission,
    artifact: await createArtifactDownloadUrl({
      submissionId: submission.submissionId,
      artifact: submission.artifact,
    }),
  };
};

type ApiRequestResult = {
  response: APIGatewayProxyStructuredResultV2;
  userSub?: string;
  submissionId?: string;
};

const handleApiRequest = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<ApiRequestResult> => {
  const routeKey = `${event.requestContext.http.method} ${event.rawPath}`;

  if (routeKey === "GET /health") {
    const environment = getEnvironment();
    return {
      response: jsonResponse(200, {
        ok: true,
        environment: environment.DEPLOY_ENV,
      }),
    };
  }

  if (routeKey === "GET /v1/submissions") {
    const request = requireAuthenticatedRequest(event);
    const submissions = await listSubmissions(request.sub);
    return {
      userSub: request.sub,
      response: jsonResponse(
        200,
        submissionsResponseSchema.parse({
          submissions,
        }),
      ),
    };
  }

  if (routeKey === "GET /v1/workspace") {
    const request = requireAuthenticatedRequest(event);
    const settings = await getGenerationSettings();
    return {
      userSub: request.sub,
      response: jsonResponse(
        200,
        workspaceProfileResponseSchema.parse({
          profile: {
            organizationName: settings.organizationName,
            governedModuleCount: settings.modules.length,
            canManageGovernance: await isAdminRequest(request),
          },
        }),
      ),
    };
  }

  if (routeKey === "POST /v1/submissions") {
    const request = requireAuthenticatedRequest(event);
    const payload = submissionInputSchema.parse(parseRequestBody(event));
    const submission = await createSubmission({
      userSub: request.sub,
      ...(request.email ? { userEmail: request.email } : {}),
      payload,
    });

    try {
      await queueSubmissionGeneration(submission.submissionId);
    } catch (error) {
      await failSubmissionGeneration({
        submissionId: submission.submissionId,
        failureMessage:
          error instanceof Error
            ? error.message
            : "Failed to start generation.",
      });
      throw error;
    }

    return {
      userSub: request.sub,
      submissionId: submission.submissionId,
      response: jsonResponse(201, submission),
    };
  }

  if (event.requestContext.http.method === "GET") {
    const submissionId = getSubmissionIdFromPath(event.rawPath);
    if (submissionId) {
      const request = requireAuthenticatedRequest(event);
      const submission = await withDownloadUrl(
        await getSubmissionForUser({
          submissionId,
          userSub: request.sub,
        }),
      );

      if (!submission) {
        return {
          userSub: request.sub,
          submissionId,
          response: notFoundResponse(),
        };
      }

      return {
        userSub: request.sub,
        submissionId,
        response: jsonResponse(
          200,
          submissionDetailResponseSchema.parse({
            submission,
          }),
        ),
      };
    }
  }

  if (routeKey === "GET /v1/admin/settings") {
    const request = requireAuthenticatedRequest(event);
    if (!(await isAdminRequest(request))) {
      return {
        userSub: request.sub,
        response: forbiddenResponse(),
      };
    }

    const settings = await getGenerationSettings();
    const budget = await getGenerationBudgetStatus(
      settings.budgetPolicy.monthlyLimitUsd,
    );
    return {
      userSub: request.sub,
      response: jsonResponse(
        200,
        generationSettingsResponseSchema.parse({
          settings,
          budget,
          observability: buildObservabilityConsoleLinks(),
        }),
      ),
    };
  }

  if (routeKey === "GET /v1/admin/observability") {
    const request = requireAuthenticatedRequest(event);
    if (!(await isAdminRequest(request))) {
      return {
        userSub: request.sub,
        response: forbiddenResponse(),
      };
    }

    return {
      userSub: request.sub,
      response: jsonResponse(
        200,
        adminObservabilityResponseSchema.parse(
          await loadAdminObservabilitySnapshot(),
        ),
      ),
    };
  }

  if (routeKey === "PUT /v1/admin/settings") {
    const request = requireAuthenticatedRequest(event);
    if (!(await isAdminRequest(request))) {
      return {
        userSub: request.sub,
        response: forbiddenResponse(),
      };
    }

    const payload = generationSettingsInputSchema.parse(
      parseRequestBody(event),
    );
    const settings = await saveGenerationSettings({
      settings: payload,
      updatedBy: request.email ?? request.sub,
    });
    const budget = await getGenerationBudgetStatus(
      settings.budgetPolicy.monthlyLimitUsd,
    );

    return {
      userSub: request.sub,
      response: jsonResponse(
        200,
        generationSettingsResponseSchema.parse({
          settings,
          budget,
          observability: buildObservabilityConsoleLinks(),
        }),
      ),
    };
  }

  return {
    response: notFoundResponse(),
  };
};

export const handler = async (
  event:
    | APIGatewayProxyEventV2WithJWTAuthorizer
    | { type: string; submissionId: string },
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2 | undefined> => {
  if (isGenerateSubmissionEvent(event)) {
    await runSubmissionGeneration(event.submissionId, context.awsRequestId);
    return undefined;
  }

  if (!isApiGatewayEvent(event)) {
    return notFoundResponse();
  }

  const startedAt = Date.now();
  const route = `${event.requestContext.http.method} ${event.rawPath}`;
  let response: APIGatewayProxyStructuredResultV2;
  let userSub = readUserSubFromEvent(event);
  let submissionId = getSubmissionIdFromPath(event.rawPath);
  let errorMessage: string | undefined;

  try {
    const result = await handleApiRequest(event);
    response = result.response;
    userSub = result.userSub ?? userSub;
    submissionId = result.submissionId ?? submissionId;
  } catch (error) {
    response = toErrorResponse(error);
    errorMessage =
      error instanceof Error
        ? error.message
        : "The request failed unexpectedly.";
  }

  const responseStatus = response.statusCode ?? 500;

  logStructuredEvent({
    level: responseStatus >= 500 ? "ERROR" : "INFO",
    eventType: "http_request",
    requestId: event.requestContext.requestId,
    route,
    userSub,
    submissionId,
    status: responseStatus,
    latencyMs: Date.now() - startedAt,
    errorMessage,
  });

  return response;
};
