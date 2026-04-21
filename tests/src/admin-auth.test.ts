import assert from "node:assert/strict";
import test from "node:test";
import { isAdminRequest } from "../../services/api/src/admin-auth.js";

void test("admin auth resolves the allowlisted email from Cognito userinfo", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;

  process.env = {
    ...originalEnv,
    DEPLOY_ENV: "dev",
    SUBMISSIONS_TABLE_NAME: "submissions",
    ARTIFACTS_BUCKET_NAME: "artifacts",
    AUTH_DOMAIN: "auth.infrastructure-as-words.com",
    BEDROCK_MODEL_IDS: "us.anthropic.claude-opus-4-7",
    CURRENT_FUNCTION_NAME: "function",
    ADMIN_EMAIL_ALLOWLIST: "architect@example.com"
  };

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        sub: "user-123",
        email: "architect@example.com"
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );

  await assert.doesNotReject(async () => {
    const isAdmin = await isAdminRequest({
      sub: "user-123",
      accessToken: "token"
    });
    assert.equal(isAdmin, true);
  });

  globalThis.fetch = originalFetch;
  process.env = originalEnv;
});

void test("admin auth rejects userinfo responses for a different subject", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;

  process.env = {
    ...originalEnv,
    DEPLOY_ENV: "dev",
    SUBMISSIONS_TABLE_NAME: "submissions",
    ARTIFACTS_BUCKET_NAME: "artifacts",
    AUTH_DOMAIN: "auth.infrastructure-as-words.com",
    BEDROCK_MODEL_IDS: "us.anthropic.claude-opus-4-7",
    CURRENT_FUNCTION_NAME: "function",
    ADMIN_EMAIL_ALLOWLIST: "architect@example.com"
  };

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        sub: "different-user",
        email: "architect@example.com"
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );

  await assert.rejects(() =>
    isAdminRequest({
      sub: "user-123",
      accessToken: "token"
    })
  );

  globalThis.fetch = originalFetch;
  process.env = originalEnv;
});
