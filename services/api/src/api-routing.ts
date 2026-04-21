import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { ZodError } from "zod";
import { jsonResponse } from "./http.js";

export class BadRequestError extends Error {}

export const notFoundResponse = (): APIGatewayProxyStructuredResultV2 =>
  jsonResponse(404, {
    error: "not_found",
    message: "The requested route does not exist.",
  });

export const forbiddenResponse = (): APIGatewayProxyStructuredResultV2 =>
  jsonResponse(403, {
    error: "forbidden",
    message: "You do not have access to this route.",
  });

export const badRequestResponse = (
  message: string,
): APIGatewayProxyStructuredResultV2 =>
  jsonResponse(400, {
    error: "bad_request",
    message,
  });

export const isApiGatewayEvent = (
  event: unknown,
): event is APIGatewayProxyEventV2WithJWTAuthorizer =>
  typeof event === "object" &&
  event !== null &&
  "requestContext" in event &&
  typeof event["requestContext"] === "object";

export const parseRequestBody = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): unknown => {
  if (!event.body) {
    throw new BadRequestError("Request body is required.");
  }

  return JSON.parse(event.body) as unknown;
};

export const getSubmissionIdFromPath = (path: string): string | undefined => {
  const match = /^\/v1\/submissions\/([^/]+)$/.exec(path);
  return match?.[1];
};

export const readUserSubFromEvent = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): string | undefined => {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const sub = claims?.["sub"];
  return typeof sub === "string" && sub.length > 0 ? sub : undefined;
};

export const toErrorResponse = (
  error: unknown,
): APIGatewayProxyStructuredResultV2 => {
  if (error instanceof BadRequestError) {
    return badRequestResponse(error.message);
  }

  if (error instanceof SyntaxError) {
    return badRequestResponse("Request body must be valid JSON.");
  }

  if (error instanceof ZodError) {
    return badRequestResponse(
      "The request payload did not match the expected shape.",
    );
  }

  if (error instanceof Error) {
    return jsonResponse(500, {
      error: "internal_error",
      message: error.message,
    });
  }

  return jsonResponse(500, {
    error: "internal_error",
    message: "The request failed unexpectedly.",
  });
};
