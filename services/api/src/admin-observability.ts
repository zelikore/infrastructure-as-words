import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  GetMetricDataCommand,
  type GetMetricDataCommandOutput,
} from "@aws-sdk/client-cloudwatch";
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  ListSubscriptionsByTopicCommand,
  SNSClient,
} from "@aws-sdk/client-sns";
import {
  adminObservabilityResponseSchema,
  type AdminObservabilityResponse,
  type ObservabilityAlarm,
  type ObservabilityAlarmState,
  type ObservabilityLogEvent,
  type ObservabilitySubscription,
} from "@infrastructure-as-words/contracts";
import {
  alarmPriority,
  buildAlarmSummary,
  buildMetricDefinitions,
  buildServiceSnapshots,
  isInterestingLogEvent,
  LOG_LOOKBACK_MS,
  METRIC_PERIOD_SECONDS,
  METRIC_WINDOW_MINUTES,
  normalizeLogMessage,
  RECENT_EVENT_LIMIT,
} from "./admin-observability-shared.js";
import { getEnvironment, type ApiEnvironment } from "./environment.js";
import { buildObservabilityConsoleLinks } from "./observability.js";

type ObservabilityClients = {
  cloudWatch: Pick<CloudWatchClient, "send">;
  logs: Pick<CloudWatchLogsClient, "send">;
  sns: Pick<SNSClient, "send">;
};

const cloudWatchClient = new CloudWatchClient({});
const logsClient = new CloudWatchLogsClient({});
const snsClient = new SNSClient({});

const defaultClients: ObservabilityClients = {
  cloudWatch: cloudWatchClient,
  logs: logsClient,
  sns: snsClient,
};

const SNAPSHOT_CACHE_TTL_MS = 60_000;
const CLOUDWATCH_READ_TIMEOUT_MS = 4_000;
const LOG_READ_TIMEOUT_MS = 2_500;
const SNS_READ_TIMEOUT_MS = 2_000;
const LOG_EVENT_FETCH_LIMIT = 100;
const EMPTY_METRIC_RESPONSE: GetMetricDataCommandOutput = {
  $metadata: {},
  MetricDataResults: [],
};

type ObservabilityReadComponent =
  | "metrics"
  | "alarms"
  | "subscriptions"
  | "recentEvents";

let cachedSnapshot:
  | {
      cacheKey: string;
      expiresAt: number;
      value: AdminObservabilityResponse;
    }
  | undefined;

const readFailureMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown observability read failure.";

const readWithTimeout = async <T>({
  component,
  timeoutMs,
  fallback,
  read,
}: {
  component: ObservabilityReadComponent;
  timeoutMs: number;
  fallback: T;
  read: (abortSignal: AbortSignal) => Promise<T>;
}): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await read(controller.signal);
  } catch (error) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "WARN",
        event_type: "observability_read_failure",
        component,
        reason: controller.signal.aborted ? "timeout" : "error",
        error: readFailureMessage(error),
      }),
    );
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
};

const readAlarms = async (
  clients: ObservabilityClients,
  environment: ApiEnvironment,
  abortSignal: AbortSignal,
): Promise<ObservabilityAlarm[]> => {
  if (environment.OBSERVABILITY_ALARM_NAMES.length === 0) {
    return [];
  }

  const response = await clients.cloudWatch.send(
    new DescribeAlarmsCommand({
      AlarmNames: environment.OBSERVABILITY_ALARM_NAMES,
    }),
    { abortSignal },
  );

  return (response.MetricAlarms ?? [])
    .map((alarm) => ({
      name: alarm.AlarmName ?? "Unnamed alarm",
      state: (alarm.StateValue ??
        "INSUFFICIENT_DATA") as ObservabilityAlarmState,
      reason: alarm.StateReason ?? "No state reason available.",
      updatedAt: (alarm.StateUpdatedTimestamp ?? new Date(0)).toISOString(),
    }))
    .sort((left, right) => {
      const priorityDelta =
        alarmPriority(left.state) - alarmPriority(right.state);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
};

const readSubscriptions = async (
  clients: ObservabilityClients,
  environment: ApiEnvironment,
  abortSignal: AbortSignal,
): Promise<ObservabilitySubscription[]> => {
  if (!environment.OBSERVABILITY_ALERTS_TOPIC_ARN) {
    return [];
  }

  const response = await clients.sns.send(
    new ListSubscriptionsByTopicCommand({
      TopicArn: environment.OBSERVABILITY_ALERTS_TOPIC_ARN,
    }),
    { abortSignal },
  );

  return (response.Subscriptions ?? []).map((subscription) => ({
    protocol: subscription.Protocol ?? "unknown",
    endpoint: subscription.Endpoint ?? "unknown",
    status:
      subscription.SubscriptionArn === "PendingConfirmation"
        ? "Pending confirmation"
        : "Confirmed",
  }));
};

const readRecentEvents = async (
  clients: ObservabilityClients,
  environment: ApiEnvironment,
  abortSignal: AbortSignal,
): Promise<ObservabilityLogEvent[]> => {
  const sources: Array<{
    source: ObservabilityLogEvent["source"];
    logGroupName: string;
  }> = [
    {
      source: "lambda" as const,
      logGroupName: environment.OBSERVABILITY_LAMBDA_LOG_GROUP_NAME,
    },
    {
      source: "api" as const,
      logGroupName: environment.OBSERVABILITY_API_LOG_GROUP_NAME,
    },
  ].filter((entry) => entry.logGroupName);

  const results = await Promise.all(
    sources.map(async ({ source, logGroupName }) => {
      const response = await clients.logs.send(
        new FilterLogEventsCommand({
          logGroupName,
          startTime: Date.now() - LOG_LOOKBACK_MS,
          limit: LOG_EVENT_FETCH_LIMIT,
        }),
        { abortSignal },
      );

      return (response.events ?? [])
        .filter((event) => typeof event.message === "string")
        .filter((event) => isInterestingLogEvent(source, event.message ?? ""))
        .map((event) => ({
          id: `${source}-${event.eventId ?? crypto.randomUUID()}`,
          source,
          timestamp: new Date(event.timestamp ?? 0).toISOString(),
          message: normalizeLogMessage(event.message ?? ""),
        }));
    }),
  );

  return results
    .flat()
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, RECENT_EVENT_LIMIT);
};

export const loadAdminObservabilitySnapshot = async ({
  environment = getEnvironment(),
  clients = defaultClients,
  bypassCache = false,
}: {
  environment?: ApiEnvironment;
  clients?: ObservabilityClients;
  bypassCache?: boolean;
} = {}): Promise<AdminObservabilityResponse> => {
  const cacheKey = `${environment.DEPLOY_ENV}:${environment.OBSERVABILITY_DASHBOARD_NAME}`;
  if (
    !bypassCache &&
    cachedSnapshot &&
    cachedSnapshot.cacheKey === cacheKey &&
    cachedSnapshot.expiresAt > Date.now()
  ) {
    return cachedSnapshot.value;
  }

  const metricDefinitions = buildMetricDefinitions(environment);
  const [metricResponse, alarms, subscriptions, recentEvents] =
    await Promise.all([
      readWithTimeout({
        component: "metrics",
        timeoutMs: CLOUDWATCH_READ_TIMEOUT_MS,
        fallback: EMPTY_METRIC_RESPONSE,
        read: (abortSignal) =>
          clients.cloudWatch.send(
            new GetMetricDataCommand({
              StartTime: new Date(Date.now() - METRIC_PERIOD_SECONDS * 1_000),
              EndTime: new Date(),
              MetricDataQueries: metricDefinitions.map((entry) => entry.query),
            }),
            { abortSignal },
          ),
      }),
      readWithTimeout({
        component: "alarms",
        timeoutMs: CLOUDWATCH_READ_TIMEOUT_MS,
        fallback: [],
        read: (abortSignal) => readAlarms(clients, environment, abortSignal),
      }),
      readWithTimeout({
        component: "subscriptions",
        timeoutMs: SNS_READ_TIMEOUT_MS,
        fallback: [],
        read: (abortSignal) =>
          readSubscriptions(clients, environment, abortSignal),
      }),
      readWithTimeout({
        component: "recentEvents",
        timeoutMs: LOG_READ_TIMEOUT_MS,
        fallback: [],
        read: (abortSignal) =>
          readRecentEvents(clients, environment, abortSignal),
      }),
    ]);

  const snapshot = adminObservabilityResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    periodMinutes: METRIC_WINDOW_MINUTES,
    links: buildObservabilityConsoleLinks(environment),
    alarmSummary: buildAlarmSummary(alarms),
    services: buildServiceSnapshots(
      metricDefinitions,
      (metricResponse.MetricDataResults ?? []).map((entry) => ({
        Id: entry.Id,
        Values: entry.Values,
      })),
    ),
    alarms,
    subscriptions,
    recentEvents,
  });

  cachedSnapshot = {
    cacheKey,
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
    value: snapshot,
  };

  return snapshot;
};
