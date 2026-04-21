import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const httpApiModulePath = resolve(
  process.cwd(),
  "infra/modules/http-api-service/main.tf",
);

void test("http api service module exposes the admin observability route and runtime wiring", async () => {
  const file = await readFile(httpApiModulePath, "utf8");

  assert.match(
    file,
    /route_key\s*=\s*"GET \/v1\/admin\/observability"/,
    "The HTTP API module should expose a dedicated admin observability route.",
  );
  assert.match(
    file,
    /OBSERVABILITY_ALARM_NAMES\s*=\s*join\(",",\s*local\.observability_alarm_names\)/,
    "The Lambda runtime should receive the explicit alarm names it is allowed to inspect.",
  );
  assert.match(
    file,
    /OBSERVABILITY_API_ID\s*=\s*aws_apigatewayv2_api\.http\.id/,
    "The Lambda runtime should receive its API identifier for live metric reads.",
  );
  assert.match(
    file,
    /cloudwatch:DescribeAlarms[\s\S]*cloudwatch:GetMetricData/,
    "The Lambda IAM policy should allow read-only CloudWatch alarm and metric access.",
  );
  assert.match(
    file,
    /logs:FilterLogEvents/,
    "The Lambda IAM policy should allow log filtering for the environment log groups.",
  );
  assert.match(
    file,
    /sns:ListSubscriptionsByTopic/,
    "The Lambda IAM policy should allow read-only SNS subscription inspection.",
  );
});
