import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2
} from "aws-lambda";

export type AuthenticatedRequest = {
  sub: string;
  email?: string;
  accessToken?: string;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
} as const;

export const jsonResponse = (
  statusCode: number,
  body: unknown
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(body)
});

export const noContentResponse = (): APIGatewayProxyStructuredResultV2 => ({
  statusCode: 204
});

const readClaim = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  key: string
): string | undefined => {
  const claims = event.requestContext.authorizer.jwt.claims;
  const value = claims[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const readAccessToken = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): string | undefined => {
  const authorizationHeader = event.headers["authorization"] ?? event.headers["Authorization"];
  if (!authorizationHeader) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match?.[1];
};

export const requireAuthenticatedRequest = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): AuthenticatedRequest => {
  const sub = readClaim(event, "sub");
  const email = readClaim(event, "email");
  const accessToken = readAccessToken(event);

  if (!sub) {
    throw new Error("Authenticated route is missing a Cognito subject claim.");
  }

  return {
    sub,
    ...(email ? { email } : {}),
    ...(accessToken ? { accessToken } : {})
  };
};
