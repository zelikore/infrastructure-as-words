"use client";

import type {
  AdminObservabilityResponse,
  ObservabilityAlarm,
  ObservabilityServiceSnapshot,
} from "@infrastructure-as-words/contracts";
import { buildObservabilitySummary } from "../lib/observability-summary";

type ObservabilityPageProps = {
  snapshot: AdminObservabilityResponse | undefined;
  loading: boolean;
  errorMessage: string | undefined;
  onRefresh: () => void;
};

const formatTimestamp = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const findService = (
  snapshot: AdminObservabilityResponse,
  serviceId: ObservabilityServiceSnapshot["id"],
): ObservabilityServiceSnapshot | undefined =>
  snapshot.services.find((service) => service.id === serviceId);

const findMetricValue = (
  service: ObservabilityServiceSnapshot | undefined,
  metricId: string,
): string =>
  service?.metrics.find((metric) => metric.id === metricId)?.displayValue ??
  "0";

const alarmToneClass = (alarm: ObservabilityAlarm): string => {
  if (alarm.state === "ALARM") {
    return "iaw-observabilityAlarmCritical";
  }

  if (alarm.state === "INSUFFICIENT_DATA") {
    return "iaw-observabilityAlarmWarn";
  }

  return "iaw-observabilityAlarmOk";
};

export function ObservabilityPage({
  snapshot,
  loading,
  errorMessage,
  onRefresh,
}: ObservabilityPageProps) {
  const lambda = snapshot ? findService(snapshot, "lambda") : undefined;
  const api = snapshot ? findService(snapshot, "api") : undefined;
  const dynamodb = snapshot ? findService(snapshot, "dynamodb") : undefined;
  const summary = snapshot ? buildObservabilitySummary(snapshot) : undefined;

  return (
    <section className="iaw-observabilityPage iaw-surface">
      <div className="iaw-observabilityHeader">
        <div>
          <p className="iaw-sectionLabel">Admin</p>
          <h1 className="iaw-governanceTitle">Observability</h1>
          <p className="iaw-governanceIntro">
            Live AWS health for the active environment.
          </p>
        </div>

        <div className="iaw-observabilityHeaderMeta">
          {snapshot ? (
            <p className="iaw-fieldLabel">
              Updated {formatTimestamp(snapshot.generatedAt)}
            </p>
          ) : null}
          <button
            type="button"
            className="iaw-secondaryButton"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p className="iaw-inlineError" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!snapshot && loading ? (
        <div className="iaw-emptyState">
          <p className="iaw-emptyStateTitle">Loading observability</p>
        </div>
      ) : null}

      {snapshot ? (
        <>
          {summary ? (
            <div
              className={`iaw-observabilitySummary iaw-observabilitySummary${summary.tone[0]?.toUpperCase()}${summary.tone.slice(1)}`}
            >
              <p className="iaw-sectionLabel">Status</p>
              <strong>{summary.title}</strong>
              <span className="iaw-fieldLabel">{summary.detail}</span>
            </div>
          ) : null}

          <div className="iaw-observabilityStats">
            <article className="iaw-observabilityStat">
              <span className="iaw-fieldLabel">Active alarms</span>
              <strong>{snapshot.alarmSummary.alarmCount}</strong>
            </article>
            <article className="iaw-observabilityStat">
              <span className="iaw-fieldLabel">
                Requests · {snapshot.periodMinutes}m
              </span>
              <strong>{findMetricValue(api, "apiRequests")}</strong>
            </article>
            <article className="iaw-observabilityStat">
              <span className="iaw-fieldLabel">API p95</span>
              <strong>{findMetricValue(api, "apiLatencyP95")}</strong>
            </article>
            <article className="iaw-observabilityStat">
              <span className="iaw-fieldLabel">Lambda errors</span>
              <strong>{findMetricValue(lambda, "lambdaErrors")}</strong>
            </article>
            <article className="iaw-observabilityStat">
              <span className="iaw-fieldLabel">Subscriptions</span>
              <strong>{snapshot.subscriptions.length}</strong>
            </article>
          </div>

          <div className="iaw-observabilityLayout">
            <section className="iaw-observabilityPanel">
              <div className="iaw-observabilityPanelHeader">
                <p className="iaw-sectionLabel">Services</p>
                <span className="iaw-fieldLabel">
                  Last {snapshot.periodMinutes}m
                </span>
              </div>

              {[lambda, api, dynamodb]
                .flatMap((service) => (service ? [service] : []))
                .map((service) => (
                  <article
                    key={service.id}
                    className="iaw-observabilityServiceCard"
                  >
                    <div className="iaw-observabilityServiceHead">
                      <h2>{service.label}</h2>
                    </div>
                    <div className="iaw-observabilityMetricGrid">
                      {service.metrics.map((metric) => (
                        <div
                          key={metric.id}
                          className="iaw-observabilityMetricCard"
                        >
                          <span className="iaw-fieldLabel">{metric.label}</span>
                          <strong>{metric.displayValue}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
            </section>

            <section className="iaw-observabilityPanel">
              <div className="iaw-observabilityPanelHeader">
                <p className="iaw-sectionLabel">Console</p>
              </div>
              <div className="iaw-governanceObservability">
                <a
                  className="iaw-governanceLink"
                  href={snapshot.links.dashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="iaw-fieldLabel">Dashboard</span>
                  <strong>CloudWatch</strong>
                </a>
                <a
                  className="iaw-governanceLink"
                  href={snapshot.links.alarmsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="iaw-fieldLabel">Alarms</span>
                  <strong>Thresholds</strong>
                </a>
                <a
                  className="iaw-governanceLink"
                  href={snapshot.links.lambdaLogsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="iaw-fieldLabel">Lambda logs</span>
                  <strong>Requests</strong>
                </a>
                <a
                  className="iaw-governanceLink"
                  href={snapshot.links.apiLogsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="iaw-fieldLabel">API logs</span>
                  <strong>Access</strong>
                </a>
                <a
                  className="iaw-governanceLink"
                  href={snapshot.links.notificationsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="iaw-fieldLabel">Notifications</span>
                  <strong>SNS</strong>
                </a>
              </div>
            </section>

            <section className="iaw-observabilityPanel">
              <div className="iaw-observabilityPanelHeader">
                <p className="iaw-sectionLabel">Alarms</p>
                <span className="iaw-fieldLabel">
                  {snapshot.alarmSummary.okCount} ok ·{" "}
                  {snapshot.alarmSummary.insufficientDataCount} unknown
                </span>
              </div>

              <div className="iaw-observabilityAlarmList">
                {snapshot.alarms.map((alarm) => (
                  <article
                    key={alarm.name}
                    className="iaw-observabilityAlarmCard"
                  >
                    <div className="iaw-observabilityAlarmHead">
                      <strong>{alarm.name}</strong>
                      <span
                        className={`iaw-observabilityAlarmBadge ${alarmToneClass(alarm)}`}
                      >
                        {alarm.state}
                      </span>
                    </div>
                    <p className="iaw-observabilityAlarmReason">
                      {alarm.reason}
                    </p>
                    <span className="iaw-fieldLabel">
                      Updated {formatTimestamp(alarm.updatedAt)}
                    </span>
                  </article>
                ))}
              </div>
            </section>

            <section className="iaw-observabilityPanel">
              <div className="iaw-observabilityPanelHeader">
                <p className="iaw-sectionLabel">Notifications</p>
              </div>

              <div className="iaw-observabilitySubscriptionList">
                {snapshot.subscriptions.length ? (
                  snapshot.subscriptions.map((subscription) => (
                    <article
                      key={`${subscription.protocol}:${subscription.endpoint}`}
                      className="iaw-observabilitySubscriptionCard"
                    >
                      <span className="iaw-fieldLabel">
                        {subscription.protocol}
                      </span>
                      <strong>{subscription.endpoint}</strong>
                      <span className="iaw-fieldLabel">
                        {subscription.status}
                      </span>
                    </article>
                  ))
                ) : (
                  <p className="iaw-emptyHint">No alert subscriptions.</p>
                )}
              </div>
            </section>

            <section className="iaw-observabilityPanel iaw-observabilityPanelWide">
              <div className="iaw-observabilityPanelHeader">
                <p className="iaw-sectionLabel">Recent signals</p>
              </div>

              <div className="iaw-observabilityEventList">
                {snapshot.recentEvents.length ? (
                  snapshot.recentEvents.map((event) => (
                    <article
                      key={event.id}
                      className="iaw-observabilityEventCard"
                    >
                      <div className="iaw-observabilityEventHead">
                        <strong>
                          {event.source === "lambda" ? "Lambda" : "API"}
                        </strong>
                        <span className="iaw-fieldLabel">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                      <p>{event.message}</p>
                    </article>
                  ))
                ) : (
                  <p className="iaw-emptyHint">No recent error events.</p>
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}
