import type { ObservabilityConsoleLinks } from "@infrastructure-as-words/contracts";
import { getEnvironment, type ApiEnvironment } from "./environment.js";

type StructuredLogEvent = {
  eventType: "http_request" | "generation_run";
  requestId: string;
  route: string;
  status: number | string;
  latencyMs: number;
  userSub?: string | undefined;
  submissionId?: string | undefined;
  costUsd?: number | undefined;
  errorMessage?: string | undefined;
  level?: "INFO" | "ERROR";
};

const encodeCloudWatchPath = (value: string): string =>
  encodeURIComponent(value).replace(/%/g, "$25");

const buildLogGroupUrl = (region: string, logGroupName: string): string =>
  logGroupName
    ? `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${encodeCloudWatchPath(logGroupName)}`
    : `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups`;

const buildSnsTopicUrl = (region: string, topicArn: string): string =>
  topicArn
    ? `https://${region}.console.aws.amazon.com/sns/v3/home?region=${region}#/topic/${encodeURIComponent(topicArn)}`
    : `https://${region}.console.aws.amazon.com/sns/v3/home?region=${region}#/topics`;

const removeUndefined = <T extends Record<string, unknown>>(
  value: T,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );

export const buildObservabilityConsoleLinks = (
  environment: ApiEnvironment = getEnvironment(),
): ObservabilityConsoleLinks => ({
  dashboardUrl: environment.OBSERVABILITY_DASHBOARD_NAME
    ? `https://${environment.AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${environment.AWS_REGION}#dashboards/dashboard/${encodeURIComponent(environment.OBSERVABILITY_DASHBOARD_NAME)}`
    : `https://${environment.AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${environment.AWS_REGION}#dashboards:`,
  alarmsUrl: `https://${environment.AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${environment.AWS_REGION}#alarmsV2:`,
  lambdaLogsUrl: buildLogGroupUrl(
    environment.AWS_REGION,
    environment.OBSERVABILITY_LAMBDA_LOG_GROUP_NAME,
  ),
  apiLogsUrl: buildLogGroupUrl(
    environment.AWS_REGION,
    environment.OBSERVABILITY_API_LOG_GROUP_NAME,
  ),
  notificationsUrl: buildSnsTopicUrl(
    environment.AWS_REGION,
    environment.OBSERVABILITY_ALERTS_TOPIC_ARN,
  ),
});

export const logStructuredEvent = ({
  eventType,
  requestId,
  route,
  status,
  latencyMs,
  userSub,
  submissionId,
  costUsd,
  errorMessage,
  level = "INFO",
}: StructuredLogEvent): void => {
  const environment = getEnvironment();
  const payload = removeUndefined({
    timestamp: new Date().toISOString(),
    level,
    event_type: eventType,
    environment: environment.DEPLOY_ENV,
    request_id: requestId,
    route,
    user_sub: userSub,
    submission_id: submissionId,
    status,
    latency_ms: latencyMs,
    cost_usd: costUsd,
    error: errorMessage,
  });

  console.log(JSON.stringify(payload));
};
