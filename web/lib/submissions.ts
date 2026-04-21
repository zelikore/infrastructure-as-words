import {
  generationSettingsInputSchema,
  generationSettingsResponseSchema,
  submissionDetailResponseSchema,
  submissionInputSchema,
  submissionSchema,
  submissionsResponseSchema,
  type GenerationSettingsResponse,
  type GenerationSettingsInput,
  type SubmissionDetail,
  type SubmissionInput,
  type SubmissionSummary,
  type WorkspaceProfile,
  workspaceProfileResponseSchema
} from "@infrastructure-as-words/contracts";
import { clearSession, getSession } from "./auth";
import { getRuntimeConfig } from "./runtime";

const createAuthorizedRequest = async (
  input: RequestInit
): Promise<{
  urlPrefix: string;
  request: RequestInit;
}> => {
  const runtimeConfig = await getRuntimeConfig();
  const session = await getSession();

  if (!session) {
    throw new Error("You must sign in before calling the API.");
  }

  return {
    urlPrefix: runtimeConfig.apiBaseUrl,
    request: {
      ...input,
      headers: {
        ...(input.headers ? input.headers : {}),
        authorization: `Bearer ${session.accessToken}`
      }
    }
  };
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
};

const handleApiFailure = async (response: Response): Promise<never> => {
  if (response.status === 401) {
    clearSession();
    throw new Error("Your session expired. Sign in again to continue.");
  }

  const payload = await parseJson(response);
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload["message"] === "string"
  ) {
    throw new Error(payload["message"]);
  }

  throw new Error("The API request failed.");
};

export const fetchSubmissionHistory = async (): Promise<SubmissionSummary[]> => {
  const { urlPrefix, request } = await createAuthorizedRequest({
    method: "GET"
  });
  const response = await fetch(`${urlPrefix}/v1/submissions`, request);
  if (!response.ok) {
    return handleApiFailure(response);
  }

  return submissionsResponseSchema.parse(await response.json()).submissions;
};

export const fetchWorkspaceProfile = async (): Promise<WorkspaceProfile> => {
  const { urlPrefix, request } = await createAuthorizedRequest({
    method: "GET"
  });
  const response = await fetch(`${urlPrefix}/v1/workspace`, request);
  if (!response.ok) {
    return handleApiFailure(response);
  }

  return workspaceProfileResponseSchema.parse(await response.json()).profile;
};

export const fetchSubmissionDetail = async (submissionId: string): Promise<SubmissionDetail> => {
  const { urlPrefix, request } = await createAuthorizedRequest({
    method: "GET"
  });
  const response = await fetch(`${urlPrefix}/v1/submissions/${submissionId}`, request);
  if (!response.ok) {
    return handleApiFailure(response);
  }

  return submissionDetailResponseSchema.parse(await response.json()).submission;
};

export const createSubmission = async (input: SubmissionInput): Promise<SubmissionSummary> => {
  const payload = submissionInputSchema.parse(input);
  const { urlPrefix, request } = await createAuthorizedRequest({
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const response = await fetch(`${urlPrefix}/v1/submissions`, request);
  if (!response.ok) {
    return handleApiFailure(response);
  }

  return submissionSchema.parse(await response.json());
};

export const fetchGenerationSettings = async (): Promise<GenerationSettingsResponse> => {
  const { urlPrefix, request } = await createAuthorizedRequest({
    method: "GET"
  });
  const response = await fetch(`${urlPrefix}/v1/admin/settings`, request);
  if (!response.ok) {
    return handleApiFailure(response);
  }

  return generationSettingsResponseSchema.parse(await response.json());
};

export const updateGenerationSettings = async (
  input: GenerationSettingsInput
): Promise<GenerationSettingsResponse> => {
  const payload = generationSettingsInputSchema.parse(input);
  const { urlPrefix, request } = await createAuthorizedRequest({
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const response = await fetch(`${urlPrefix}/v1/admin/settings`, request);
  if (!response.ok) {
    return handleApiFailure(response);
  }

  return generationSettingsResponseSchema.parse(await response.json());
};
