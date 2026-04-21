import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  GetMetricDataCommand,
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

const SNAPSHOT_CACHE_TTL_MS = 15_000;

let cachedSnapshot:
  | {
      cacheKey: string;
      expiresAt: number;
      value: AdminObservabilityResponse;
    }
  | undefined;

const readAlarms = async (
  clients: ObservabilityClients,
  environment: ApiEnvironment,
): Promise<ObservabilityAlarm[]> => {
  if (environment.OBSERVABILITY_ALARM_NAMES.length === 0) {
    return [];
  }

  const response = await clients.cloudWatch.send(
    new DescribeAlarmsCommand({
      AlarmNames: environment.OBSERVABILITY_ALARM_NAMES,
    }),
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
): Promise<ObservabilitySubscription[]> => {
  if (!environment.OBSERVABILITY_ALERTS_TOPIC_ARN) {
    return [];
  }

  const response = await clients.sns.send(
    new ListSubscriptionsByTopicCommand({
      TopicArn: environment.OBSERVABILITY_ALERTS_TOPIC_ARN,
    }),
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
          limit: 50,
        }),
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
      clients.cloudWatch.send(
        new GetMetricDataCommand({
          StartTime: new Date(Date.now() - METRIC_PERIOD_SECONDS * 1_000),
          EndTime: new Date(),
          MetricDataQueries: metricDefinitions.map((entry) => entry.query),
        }),
      ),
      readAlarms(clients, environment),
      readSubscriptions(clients, environment),
      readRecentEvents(clients, environment),
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
