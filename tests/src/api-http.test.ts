import assert from "node:assert/strict";
import test from "node:test";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { requireAuthenticatedRequest } from "../../services/api/src/http.js";

const createEvent = (
  claims: Record<string, string>
): APIGatewayProxyEventV2WithJWTAuthorizer =>
  ({
    body: undefined,
    cookies: [],
    headers: {},
    isBase64Encoded: false,
    rawPath: "/v1/submissions",
    rawQueryString: "",
    requestContext: {
      accountId: "123456789012",
      apiId: "api",
      authorizer: {
        principalId: "principal",
        integrationLatency: 0,
        jwt: {
          claims,
          scopes: []
        }
      },
      domainName: "api.example.com",
      domainPrefix: "api",
      http: {
        method: "GET",
        path: "/v1/submissions",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test"
      },
      requestId: "request",
      routeKey: "GET /v1/submissions",
      stage: "$default",
      time: "20/Apr/2026:12:00:00 +0000",
      timeEpoch: 1
    },
    routeKey: "GET /v1/submissions",
    version: "2.0"
  }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

void test("authenticated request extracts the Cognito subject and email", () => {
  const request = requireAuthenticatedRequest(
    {
      ...createEvent({
        sub: "user_123",
        email: "architect@example.com"
      }),
      headers: {
        authorization: "Bearer access-token"
      }
    }
  );

  assert.deepEqual(request, {
    sub: "user_123",
    email: "architect@example.com",
    accessToken: "access-token"
  });
});

void test("authenticated request rejects events without a subject claim", () => {
  assert.throws(() => requireAuthenticatedRequest(createEvent({})));
});
