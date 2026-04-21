"use client";

import { useEffect, useState } from "react";
import type {
  BudgetStatus,
  GenerationSettings,
  GenerationSettingsInput,
  ModuleCatalogEntry,
  ObservabilityConsoleLinks,
} from "@infrastructure-as-words/contracts";
import { GovernanceModuleEditor } from "./governance-module-editor";

type GovernancePageProps = {
  settings: GenerationSettings | undefined;
  budget: BudgetStatus | undefined;
  observability: ObservabilityConsoleLinks | undefined;
  saving: boolean;
  errorMessage: string | undefined;
  onSave: (settings: GenerationSettingsInput) => Promise<void>;
};

type GovernanceDraft = {
  organizationName: string;
  guidance: string;
  preferredRegionsText: string;
  guardrailsText: string;
  limitationsText: string;
  monthlyBudgetUsdText: string;
  modules: ModuleCatalogEntry[];
};

const toDraft = (settings: GenerationSettings): GovernanceDraft => ({
  organizationName: settings.organizationName,
  guidance: settings.guidance,
  preferredRegionsText: settings.preferredRegions.join("\n"),
  guardrailsText: settings.guardrails.join("\n"),
  limitationsText: settings.limitationsTemplate.join("\n"),
  monthlyBudgetUsdText: String(settings.budgetPolicy.monthlyLimitUsd),
  modules: settings.modules,
});

const splitLines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const toSettingsInput = (draft: GovernanceDraft): GenerationSettingsInput => ({
  organizationName: draft.organizationName.trim(),
  guidance: draft.guidance.trim(),
  preferredRegions: splitLines(draft.preferredRegionsText),
  guardrails: splitLines(draft.guardrailsText),
  limitationsTemplate: splitLines(draft.limitationsText),
  budgetPolicy: {
    monthlyLimitUsd: Number.parseFloat(draft.monthlyBudgetUsdText),
  },
  modules: draft.modules,
});

const formatUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatBudgetMonth = (periodKey: string): string => {
  const [yearText = "", monthText = ""] = periodKey.split("-");
  const year = Number.parseInt(yearText, 10);
  const monthIndex = Number.parseInt(monthText, 10) - 1;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 15)));
};

export function GovernancePage({
  settings,
  budget,
  observability,
  saving,
  errorMessage,
  onSave,
}: GovernancePageProps) {
  const [draft, setDraft] = useState<GovernanceDraft | undefined>();
  const [saveMessage, setSaveMessage] = useState<string | undefined>();

  useEffect(() => {
    if (settings) {
      setDraft(toDraft(settings));
    }
  }, [settings]);

  return (
    <section className="iaw-governancePage iaw-surface">
      <div className="iaw-governanceHeader">
        <div>
          <p className="iaw-sectionLabel">Admin</p>
          <h1 className="iaw-governanceTitle">Governance</h1>
        </div>
      </div>

      {draft ? (
        <form
          className="iaw-governanceForm"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaveMessage(undefined);
            await onSave(toSettingsInput(draft));
            setSaveMessage("Saved");
          }}
        >
          <div className="iaw-governancePageGrid">
            <label className="iaw-stackField">
              <span className="iaw-fieldLabel">Org</span>
              <input
                className="iaw-inlineField"
                value={draft.organizationName}
                onChange={(event) => {
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          organizationName: event.target.value,
                        }
                      : current,
                  );
                }}
              />
            </label>

            <label className="iaw-stackField">
              <span className="iaw-fieldLabel">Monthly AI budget</span>
              <input
                className="iaw-inlineField"
                inputMode="decimal"
                value={draft.monthlyBudgetUsdText}
                onChange={(event) => {
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          monthlyBudgetUsdText: event.target.value,
                        }
                      : current,
                  );
                }}
              />
            </label>
          </div>

          {budget ? (
            <div
              className="iaw-governanceBudgetStats"
              aria-label="Budget status"
            >
              <div className="iaw-governanceBudgetStat">
                <span className="iaw-fieldLabel">
                  {formatBudgetMonth(budget.periodKey)}
                </span>
                <strong>{formatUsd(budget.monthlyLimitUsd)}</strong>
              </div>
              <div className="iaw-governanceBudgetStat">
                <span className="iaw-fieldLabel">Spent</span>
                <strong>{formatUsd(budget.spentUsd)}</strong>
              </div>
              <div className="iaw-governanceBudgetStat">
                <span className="iaw-fieldLabel">Reserved</span>
                <strong>{formatUsd(budget.reservedUsd)}</strong>
              </div>
              <div className="iaw-governanceBudgetStat">
                <span className="iaw-fieldLabel">Remaining</span>
                <strong>{formatUsd(budget.remainingUsd)}</strong>
              </div>
            </div>
          ) : null}

          {observability ? (
            <div
              className="iaw-governanceObservability"
              aria-label="Observability"
            >
              <a
                className="iaw-governanceLink"
                href={observability.dashboardUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="iaw-fieldLabel">Dashboard</span>
                <strong>CloudWatch</strong>
              </a>
              <a
                className="iaw-governanceLink"
                href={observability.alarmsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="iaw-fieldLabel">Alarms</span>
                <strong>Thresholds</strong>
              </a>
              <a
                className="iaw-governanceLink"
                href={observability.lambdaLogsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="iaw-fieldLabel">Lambda logs</span>
                <strong>Requests</strong>
              </a>
              <a
                className="iaw-governanceLink"
                href={observability.apiLogsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="iaw-fieldLabel">API logs</span>
                <strong>Access</strong>
              </a>
              <a
                className="iaw-governanceLink"
                href={observability.notificationsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="iaw-fieldLabel">Notifications</span>
                <strong>SNS</strong>
              </a>
            </div>
          ) : null}

          <label className="iaw-stackField">
            <span className="iaw-fieldLabel">Guidance</span>
            <textarea
              className="iaw-stackArea"
              value={draft.guidance}
              onChange={(event) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        guidance: event.target.value,
                      }
                    : current,
                );
              }}
            />
          </label>

          <div className="iaw-governanceGrid">
            <label className="iaw-stackField">
              <span className="iaw-fieldLabel">Regions</span>
              <textarea
                className="iaw-stackArea iaw-stackAreaCompact"
                value={draft.preferredRegionsText}
                onChange={(event) => {
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          preferredRegionsText: event.target.value,
                        }
                      : current,
                  );
                }}
              />
            </label>

            <label className="iaw-stackField">
              <span className="iaw-fieldLabel">Guardrails</span>
              <textarea
                className="iaw-stackArea iaw-stackAreaCompact"
                value={draft.guardrailsText}
                onChange={(event) => {
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          guardrailsText: event.target.value,
                        }
                      : current,
                  );
                }}
              />
            </label>

            <label className="iaw-stackField">
              <span className="iaw-fieldLabel">Limits</span>
              <textarea
                className="iaw-stackArea iaw-stackAreaCompact"
                value={draft.limitationsText}
                onChange={(event) => {
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          limitationsText: event.target.value,
                        }
                      : current,
                  );
                }}
              />
            </label>
          </div>

          <GovernanceModuleEditor
            modules={draft.modules}
            onChange={(modules) => {
              setDraft((current) =>
                current ? { ...current, modules } : current,
              );
            }}
          />

          <div className="iaw-governanceFooter">
            <button
              type="submit"
              className="iaw-primaryButton"
              disabled={saving}
            >
              {saving ? "Saving" : "Save governance"}
            </button>
            {saveMessage ? <p className="iaw-helper">{saveMessage}</p> : null}
            {errorMessage ? <p className="iaw-error">{errorMessage}</p> : null}
          </div>
        </form>
      ) : (
        <div className="iaw-detailSkeleton" aria-hidden="true">
          <span className="iaw-ghostLine iaw-ghostLineWide" />
          <span className="iaw-ghostLine iaw-ghostLineMid" />
          <span className="iaw-ghostLine iaw-ghostLineNarrow" />
        </div>
      )}
    </section>
  );
}
