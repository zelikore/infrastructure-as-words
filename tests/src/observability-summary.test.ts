import assert from "node:assert/strict";
import test from "node:test";
import { buildObservabilitySummary } from "../../web/lib/observability-summary.js";

void test("observability summary highlights active alarms", () => {
  const summary = buildObservabilitySummary({
    alarmSummary: {
      alarmCount: 2,
      okCount: 5,
      insufficientDataCount: 1,
    },
    subscriptions: [{ endpoint: "ops@example.com", protocol: "email", status: "Confirmed" }],
  });

  assert.equal(summary.tone, "critical");
  assert.equal(summary.title, "Attention needed: 2 active alarms");
  assert.equal(summary.detail, "5 ok · 1 unknown · 1 subscription");
});

void test("observability summary marks unknown signals without active alarms", () => {
  const summary = buildObservabilitySummary({
    alarmSummary: {
      alarmCount: 0,
      okCount: 6,
      insufficientDataCount: 2,
    },
    subscriptions: [],
  });

  assert.equal(summary.tone, "warn");
  assert.equal(summary.title, "No active alarms, but some signals are unknown");
  assert.equal(summary.detail, "6 ok · 2 unknown · 0 subscriptions");
});

void test("observability summary reports healthy state when all alarms are ok", () => {
  const summary = buildObservabilitySummary({
    alarmSummary: {
      alarmCount: 0,
      okCount: 7,
      insufficientDataCount: 0,
    },
    subscriptions: [
      { endpoint: "ops@example.com", protocol: "email", status: "Confirmed" },
      { endpoint: "pager@example.com", protocol: "email", status: "Pending confirmation" },
    ],
  });

  assert.equal(summary.tone, "ok");
  assert.equal(summary.title, "All alarms are healthy");
  assert.equal(summary.detail, "7 ok · 2 subscriptions");
});
