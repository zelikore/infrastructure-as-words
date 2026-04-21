import assert from "node:assert/strict";
import test from "node:test";
import type { ApiEnvironment } from "../../services/api/src/environment.js";
import { isInterestingLogEvent } from "../../services/api/src/admin-observability-shared.js";
import { loadAdminObservabilitySnapshot } from "../../services/api/src/admin-observability.js";

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
  OBSERVABILITY_ALARM_NAMES: [
    "infrastructure-as-words-prod-lambda-errors",
    "infrastructure-as-words-prod-api-5xx",
  ],
  OBSERVABILITY_ALERTS_TOPIC_ARN:
    "arn:aws:sns:us-west-2:123456789012:infrastructure-as-words-prod-alerts",
  OBSERVABILITY_API_ID: "a1b2c3d4",
  OBSERVABILITY_API_STAGE_NAME: "$default",
  OBSERVABILITY_LAMBDA_LOG_GROUP_NAME: "/aws/lambda/iaw-prod-api",
  OBSERVABILITY_API_LOG_GROUP_NAME:
    "/aws/apigateway/prod-infrastructure-as-words",
  ARTIFACT_DOWNLOAD_TTL_SECONDS: 3600,
};

void test("admin observability snapshot combines metrics, alarms, subscriptions, and recent events", async () => {
  const snapshot = await loadAdminObservabilitySnapshot({
    environment,
    bypassCache: true,
    clients: {
      cloudWatch: {
        send: async (command) => {
          switch (command.constructor.name) {
            case "GetMetricDataCommand":
              return {
                MetricDataResults: [
                  { Id: "lambdaInvocations", Values: [42] },
                  { Id: "lambdaErrors", Values: [2] },
                  { Id: "lambdaThrottles", Values: [1] },
                  { Id: "lambdaDurationP95", Values: [1850] },
                  { Id: "apiRequests", Values: [118] },
                  { Id: "api4xx", Values: [6] },
                  { Id: "api5xx", Values: [3] },
                  { Id: "apiLatencyP95", Values: [940] },
                  { Id: "ddbReadThrottles", Values: [0] },
                  { Id: "ddbWriteThrottles", Values: [1] },
                ],
              };
            case "DescribeAlarmsCommand":
              return {
                MetricAlarms: [
                  {
                    AlarmName: "infrastructure-as-words-prod-api-5xx",
                    StateValue: "ALARM",
                    StateReason: "Threshold crossed.",
                    StateUpdatedTimestamp: new Date("2026-04-21T16:20:00.000Z"),
                  },
                  {
                    AlarmName: "infrastructure-as-words-prod-lambda-errors",
                    StateValue: "OK",
                    StateReason: "Recovered.",
                    StateUpdatedTimestamp: new Date("2026-04-21T16:18:00.000Z"),
                  },
                ],
              };
            default:
              throw new Error(
                `Unexpected CloudWatch command ${command.constructor.name}`,
              );
          }
        },
      },
      logs: {
        send: async (command: {
          constructor: { name: string };
          input: { logGroupName?: string };
        }) => {
          assert.equal(command.constructor.name, "FilterLogEventsCommand");
          if (command.input.logGroupName?.includes("/aws/lambda/")) {
            return {
              events: [
                {
                  eventId: "lambda-1",
                  timestamp: Date.parse("2026-04-21T16:19:00.000Z"),
                  message:
                    '{"level":"ERROR","event_type":"http_request","status":500,"route":"GET /v1/admin/observability"}',
                },
              ],
            };
          }

          return {
            events: [
              {
                eventId: "api-1",
                timestamp: Date.parse("2026-04-21T16:17:00.000Z"),
                message:
                  '{"requestId":"123","status":502,"integration":"Lambda timeout"}',
              },
            ],
          };
        },
      },
      sns: {
        send: async (command) => {
          assert.equal(
            command.constructor.name,
            "ListSubscriptionsByTopicCommand",
          );
          return {
            Subscriptions: [
              {
                Protocol: "email",
                Endpoint: "devops.admin@example.com",
                SubscriptionArn: "PendingConfirmation",
              },
            ],
          };
        },
      },
    },
  });

  assert.equal(snapshot.periodMinutes, 60);
  assert.equal(snapshot.alarmSummary.alarmCount, 1);
  assert.equal(snapshot.alarmSummary.okCount, 1);
  assert.equal(snapshot.services[0]?.label, "Lambda");
  assert.equal(snapshot.services[1]?.metrics[3]?.displayValue, "940 ms");
  assert.equal(snapshot.subscriptions[0]?.status, "Pending confirmation");
  assert.equal(snapshot.recentEvents.length, 2);
  assert.equal(snapshot.recentEvents[0]?.source, "lambda");
  assert.equal(
    snapshot.alarms[0]?.name,
    "infrastructure-as-words-prod-api-5xx",
  );
});

void test("observability log filter keeps API failures and ignores healthy access logs", () => {
  assert.equal(
    isInterestingLogEvent(
      "api",
      JSON.stringify({
        requestId: "healthy-request",
        status: 200,
        integration: null,
      }),
    ),
    false,
  );

  assert.equal(
    isInterestingLogEvent(
      "api",
      JSON.stringify({
        requestId: "failed-request",
        status: 502,
        integration: "Lambda timeout",
      }),
    ),
    true,
  );
});
