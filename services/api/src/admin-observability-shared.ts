import type { MetricDataQuery } from "@aws-sdk/client-cloudwatch";
import type {
  ObservabilityAlarm,
  ObservabilityAlarmState,
  ObservabilityLogEvent,
  ObservabilityMetric,
  ObservabilityServiceSnapshot,
} from "@infrastructure-as-words/contracts";
import type { ApiEnvironment } from "./environment.js";

export type MetricDefinition = {
  id: string;
  section: ObservabilityServiceSnapshot["id"];
  label: string;
  unit: ObservabilityMetric["unit"];
  query: MetricDataQuery;
};

export const METRIC_WINDOW_MINUTES = 60;
export const METRIC_PERIOD_SECONDS = METRIC_WINDOW_MINUTES * 60;
export const LOG_LOOKBACK_MS = 10 * 60 * 1000;
export const RECENT_EVENT_LIMIT = 8;

const formatMetricValue = (
  value: number,
  unit: ObservabilityMetric["unit"],
): string =>
  unit === "milliseconds"
    ? `${Math.round(value).toLocaleString("en-US")} ms`
    : Math.round(value).toLocaleString("en-US");

export const buildMetricDefinitions = (
  environment: ApiEnvironment,
): MetricDefinition[] => {
  const lambdaDimensions = [
    {
      Name: "FunctionName",
      Value: environment.CURRENT_FUNCTION_NAME,
    },
  ];
  const apiDimensions = environment.OBSERVABILITY_API_ID
    ? [
        {
          Name: "ApiId",
          Value: environment.OBSERVABILITY_API_ID,
        },
        {
          Name: "Stage",
          Value: environment.OBSERVABILITY_API_STAGE_NAME,
        },
      ]
    : [];
  const tableDimensions = [
    {
      Name: "TableName",
      Value: environment.SUBMISSIONS_TABLE_NAME,
    },
  ];

  const metric = (
    id: string,
    section: MetricDefinition["section"],
    label: string,
    unit: MetricDefinition["unit"],
    namespace: string,
    metricName: string,
    dimensions: { Name: string; Value: string }[],
    stat: string,
  ): MetricDefinition => ({
    id,
    section,
    label,
    unit,
    query: {
      Id: id,
      MetricStat: {
        Metric: {
          Namespace: namespace,
          MetricName: metricName,
          Dimensions: dimensions,
        },
        Period: METRIC_PERIOD_SECONDS,
        Stat: stat,
      },
      ReturnData: true,
    },
  });

  return [
    metric(
      "lambdaInvocations",
      "lambda",
      "Invocations",
      "count",
      "AWS/Lambda",
      "Invocations",
      lambdaDimensions,
      "Sum",
    ),
    metric(
      "lambdaErrors",
      "lambda",
      "Errors",
      "count",
      "AWS/Lambda",
      "Errors",
      lambdaDimensions,
      "Sum",
    ),
    metric(
      "lambdaThrottles",
      "lambda",
      "Throttles",
      "count",
      "AWS/Lambda",
      "Throttles",
      lambdaDimensions,
      "Sum",
    ),
    metric(
      "lambdaDurationP95",
      "lambda",
      "p95 duration",
      "milliseconds",
      "AWS/Lambda",
      "Duration",
      lambdaDimensions,
      "p95",
    ),
    metric(
      "apiRequests",
      "api",
      "Requests",
      "count",
      "AWS/ApiGateway",
      "Count",
      apiDimensions,
      "Sum",
    ),
    metric(
      "api4xx",
      "api",
      "4xx",
      "count",
      "AWS/ApiGateway",
      "4xx",
      apiDimensions,
      "Sum",
    ),
    metric(
      "api5xx",
      "api",
      "5xx",
      "count",
      "AWS/ApiGateway",
      "5xx",
      apiDimensions,
      "Sum",
    ),
    metric(
      "apiLatencyP95",
      "api",
      "p95 latency",
      "milliseconds",
      "AWS/ApiGateway",
      "Latency",
      apiDimensions,
      "p95",
    ),
    metric(
      "ddbReadThrottles",
      "dynamodb",
      "Read throttles",
      "count",
      "AWS/DynamoDB",
      "ReadThrottleEvents",
      tableDimensions,
      "Sum",
    ),
    metric(
      "ddbWriteThrottles",
      "dynamodb",
      "Write throttles",
      "count",
      "AWS/DynamoDB",
      "WriteThrottleEvents",
      tableDimensions,
      "Sum",
    ),
  ].filter((entry) => entry.query.MetricStat?.Metric?.Dimensions?.length);
};

const extractMetricValue = (
  id: string,
  metricResults: {
    Id: string | undefined;
    Values: number[] | undefined;
  }[],
): number => {
  const result = metricResults.find((entry) => entry.Id === id);
  const value = result?.Values?.find((entry) => Number.isFinite(entry));
  return typeof value === "number" ? value : 0;
};

export const buildServiceSnapshots = (
  definitions: MetricDefinition[],
  metricResults: {
    Id: string | undefined;
    Values: number[] | undefined;
  }[],
): ObservabilityServiceSnapshot[] =>
  (
    [
      ["lambda", "Lambda"],
      ["api", "HTTP API"],
      ["dynamodb", "DynamoDB"],
    ] as const
  ).map(([sectionId, label]) => ({
    id: sectionId,
    label,
    metrics: definitions
      .filter((entry) => entry.section === sectionId)
      .map((entry) => {
        const value = extractMetricValue(entry.id, metricResults);
        return {
          id: entry.id,
          label: entry.label,
          value,
          displayValue: formatMetricValue(value, entry.unit),
          unit: entry.unit,
        };
      }),
  }));

export const buildAlarmSummary = (alarms: ObservabilityAlarm[]) => ({
  okCount: alarms.filter((alarm) => alarm.state === "OK").length,
  alarmCount: alarms.filter((alarm) => alarm.state === "ALARM").length,
  insufficientDataCount: alarms.filter(
    (alarm) => alarm.state === "INSUFFICIENT_DATA",
  ).length,
});

export const alarmPriority = (state: ObservabilityAlarmState): number => {
  if (state === "ALARM") {
    return 0;
  }

  if (state === "INSUFFICIENT_DATA") {
    return 1;
  }

  return 2;
};

export const normalizeLogMessage = (message: string): string =>
  message.trim().replace(/\s+/g, " ").slice(0, 2_000);

const hasInterestingIntegrationMessage = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim();
  return Boolean(normalized) && normalized !== "-";
};

export const isInterestingLogEvent = (
  source: ObservabilityLogEvent["source"],
  message: string,
): boolean => {
  if (source === "lambda") {
    return /error|exception|task timed out/i.test(message);
  }

  try {
    const parsed = JSON.parse(message) as {
      status?: number | string;
      integration?: unknown;
    };
    const status = Number(parsed.status);
    return status >= 500 || hasInterestingIntegrationMessage(parsed.integration);
  } catch {
    return /5\d\d|integration(err(or)?)|timeout|exception/i.test(message);
  }
};
