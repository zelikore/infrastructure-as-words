import assert from "node:assert/strict";
import test from "node:test";
import type { ApiEnvironment } from "../../services/api/src/environment.js";
import { buildObservabilityConsoleLinks } from "../../services/api/src/observability.js";

const environment: ApiEnvironment = {
  AWS_REGION: "us-west-2",
  DEPLOY_ENV: "prod",
  SUBMISSIONS_TABLE_NAME: "iaw-prod-submissions",
  ARTIFACTS_BUCKET_NAME: "iaw-prod-artifacts",
  AUTH_DOMAIN: "auth.infrastructure-as-words.com",
  BEDROCK_MODEL_IDS: ["us.anthropic.claude-opus-4-1-20250805-v1:0"],
  CURRENT_FUNCTION_NAME: "iaw-prod-api",
  ADMIN_EMAIL_ALLOWLIST: "architect@example.com",
  ADMIN_EMAIL_PARAMETER_NAME: "/infrastructure-as-words/admin-email",
  OBSERVABILITY_DASHBOARD_NAME: "infrastructure-as-words-prod-observability",
  OBSERVABILITY_ALERTS_TOPIC_ARN:
    "arn:aws:sns:us-west-2:123456789012:infrastructure-as-words-prod-alerts",
  OBSERVABILITY_LAMBDA_LOG_GROUP_NAME: "/aws/lambda/iaw-prod-api",
  OBSERVABILITY_API_LOG_GROUP_NAME:
    "/aws/apigateway/prod-infrastructure-as-words",
  ARTIFACT_DOWNLOAD_TTL_SECONDS: 3600,
};

void test("observability console links target the environment dashboard, logs, and alerts", () => {
  const links = buildObservabilityConsoleLinks(environment);

  assert.equal(
    links.dashboardUrl,
    "https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards/dashboard/infrastructure-as-words-prod-observability",
  );
  assert.equal(
    links.alarmsUrl,
    "https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#alarmsV2:",
  );
  assert.match(links.lambdaLogsUrl, /\$252Faws\$252Flambda\$252Fiaw-prod-api$/);
  assert.match(
    links.apiLogsUrl,
    /\$252Faws\$252Fapigateway\$252Fprod-infrastructure-as-words$/,
  );
  assert.equal(
    links.notificationsUrl,
    "https://us-west-2.console.aws.amazon.com/sns/v3/home?region=us-west-2#/topic/arn%3Aaws%3Asns%3Aus-west-2%3A123456789012%3Ainfrastructure-as-words-prod-alerts",
  );
});
