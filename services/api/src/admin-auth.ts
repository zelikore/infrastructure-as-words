import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { z } from "zod";
import type { AuthenticatedRequest } from "./http.js";
import { getEnvironment } from "./environment.js";

const userInfoSchema = z.object({
  sub: z.string().min(1),
  email: z.email().optional(),
});

const ssmClient = new SSMClient({});
let cachedAdminEmails: string[] | undefined;

const normalizeAllowlist = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

const resolveRequestEmail = async (
  request: AuthenticatedRequest,
): Promise<string | undefined> => {
  if (request.email) {
    return request.email.toLowerCase();
  }

  if (!request.accessToken) {
    return undefined;
  }

  const environment = getEnvironment();
  const response = await fetch(
    `https://${environment.AUTH_DOMAIN}/oauth2/userInfo`,
    {
      headers: {
        Authorization: `Bearer ${request.accessToken}`,
      },
    },
  );

  if (!response.ok) {
    return undefined;
  }

  const parsed = userInfoSchema.parse(await response.json());
  if (parsed.sub !== request.sub) {
    throw new Error(
      "The Cognito userinfo response did not match the authenticated subject.",
    );
  }

  return parsed.email?.toLowerCase();
};

const resolveConfiguredAdminEmails = async (): Promise<string[]> => {
  if (cachedAdminEmails) {
    return cachedAdminEmails;
  }

  const environment = getEnvironment();
  const envAllowlist = normalizeAllowlist(environment.ADMIN_EMAIL_ALLOWLIST);
  if (envAllowlist.length > 0) {
    cachedAdminEmails = envAllowlist;
    return envAllowlist;
  }

  if (!environment.ADMIN_EMAIL_PARAMETER_NAME) {
    cachedAdminEmails = [];
    return cachedAdminEmails;
  }

  const result = await ssmClient.send(
    new GetParameterCommand({
      Name: environment.ADMIN_EMAIL_PARAMETER_NAME,
    }),
  );
  cachedAdminEmails = normalizeAllowlist(result.Parameter?.Value ?? "");
  return cachedAdminEmails;
};

export const isAdminRequest = async (
  request: AuthenticatedRequest,
): Promise<boolean> => {
  const allowlist = await resolveConfiguredAdminEmails();
  if (allowlist.length === 0) {
    return false;
  }

  const email = await resolveRequestEmail(request);
  return typeof email === "string" && allowlist.includes(email);
};
