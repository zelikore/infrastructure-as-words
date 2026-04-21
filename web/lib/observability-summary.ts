import type { AdminObservabilityResponse } from "@infrastructure-as-words/contracts";

export type ObservabilitySummaryTone = "ok" | "warn" | "critical";

export type ObservabilitySummary = {
  detail: string;
  title: string;
  tone: ObservabilitySummaryTone;
};

export const buildObservabilitySummary = (
  snapshot: Pick<AdminObservabilityResponse, "alarmSummary" | "subscriptions">,
): ObservabilitySummary => {
  const { alarmSummary } = snapshot;
  const subscriptionCount = snapshot.subscriptions.length;
  const subscriptionLabel =
    subscriptionCount === 1 ? "1 subscription" : `${subscriptionCount} subscriptions`;

  if (alarmSummary.alarmCount > 0) {
    const alarmLabel =
      alarmSummary.alarmCount === 1
        ? "1 active alarm"
        : `${alarmSummary.alarmCount} active alarms`;

    return {
      title: `Attention needed: ${alarmLabel}`,
      detail: `${alarmSummary.okCount} ok · ${alarmSummary.insufficientDataCount} unknown · ${subscriptionLabel}`,
      tone: "critical",
    };
  }

  if (alarmSummary.insufficientDataCount > 0) {
    return {
      title: "No active alarms, but some signals are unknown",
      detail: `${alarmSummary.okCount} ok · ${alarmSummary.insufficientDataCount} unknown · ${subscriptionLabel}`,
      tone: "warn",
    };
  }

  return {
    title: "All alarms are healthy",
    detail: `${alarmSummary.okCount} ok · ${subscriptionLabel}`,
    tone: "ok",
  };
};
