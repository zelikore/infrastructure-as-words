"use client";

import { useEffect, useState } from "react";
import type { SubmissionDetail } from "@infrastructure-as-words/contracts";
import { formatModelLabel, formatTimestamp, formatUsd } from "../lib/format";
import { SubmissionDiagramCanvas } from "./submission-diagram";

type SubmissionDetailPanelProps = {
  submission: SubmissionDetail | undefined;
  loading: boolean;
  errorMessage: string | undefined;
};

type DetailTab = "details" | "modules" | "files";

const statusLabels: Record<SubmissionDetail["status"], string> = {
  pending: "Running",
  completed: "Ready",
  failed: "Failed"
};

export function SubmissionDetailPanel({
  submission,
  loading,
  errorMessage
}: SubmissionDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("details");

  useEffect(() => {
    setActiveTab("details");
  }, [submission?.submissionId]);

  if (loading && !submission) {
    return (
      <section className="iaw-detail iaw-surface">
        <div className="iaw-detailHeader">
          <p className="iaw-sectionLabel">Run</p>
          <span className="iaw-status iaw-statusPending">Loading</span>
        </div>
        <div className="iaw-detailSkeleton" aria-hidden="true">
          <span className="iaw-ghostLine iaw-ghostLineWide" />
          <span className="iaw-ghostLine iaw-ghostLineMid" />
          <span className="iaw-ghostLine iaw-ghostLineNarrow" />
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="iaw-detail iaw-surface">
        <div className="iaw-detailHeader">
          <p className="iaw-sectionLabel">Run</p>
        </div>
        <p className="iaw-error">{errorMessage}</p>
      </section>
    );
  }

  if (!submission) {
    return (
      <section className="iaw-detail iaw-surface">
        <div className="iaw-detailHeader">
          <div>
            <p className="iaw-sectionLabel">Run</p>
            <h2 className="iaw-detailTitle">Select a run</h2>
          </div>
        </div>
      </section>
    );
  }

  const statusClassName =
    submission.status === "completed"
      ? "iaw-statusReady"
      : submission.status === "failed"
        ? "iaw-statusFailed"
        : "iaw-statusPending";
  const title = submission.architecture?.name ?? `Run ${submission.submissionId.slice(0, 8)}`;
  const runLead = submission.summary ?? submission.description;
  const runDurationMs = Math.max(
    0,
    new Date(submission.updatedAt).getTime() - new Date(submission.createdAt).getTime()
  );
  const detailStats = [
    {
      label: "Run",
      value: submission.submissionId.slice(0, 8)
    },
    {
      label: "Created",
      value: formatTimestamp(submission.createdAt)
    },
    {
      label: "Updated",
      value: formatTimestamp(submission.updatedAt)
    },
    ...(submission.artifact
      ? [
          {
            label: "Artifact",
            value: `${Math.max(1, Math.round(submission.artifact.sizeBytes / 1024))} KB`
          }
        ]
      : []),
    ...(runDurationMs > 0
      ? [
          {
            label: "Runtime",
            value: `${Math.max(1, Math.round(runDurationMs / 1000))}s`
          }
        ]
      : []),
    ...(typeof submission.aiCostUsd === "number"
      ? [
          {
            label: "Cost",
            value: formatUsd(submission.aiCostUsd)
          }
        ]
      : []),
    ...(submission.aiUsage
      ? [
          {
            label: "Tokens",
            value: submission.aiUsage.totalTokens.toLocaleString()
          }
        ]
      : [])
  ];
  const tabs: Array<{ id: DetailTab; label: string }> = [
    {
      id: "details",
      label: "Details"
    },
    ...(submission.architecture?.modules.length
      ? [
          {
            id: "modules" as const,
            label: `Modules ${submission.architecture.modules.length}`
          }
        ]
      : []),
    ...(submission.architecture?.files.length
      ? [
          {
            id: "files" as const,
            label: `Files ${submission.architecture.files.length}`
          }
        ]
      : [])
  ];

  return (
    <section className="iaw-detail iaw-surface">
      <div className="iaw-runHero">
        <div className="iaw-runHeroCopy">
          <p className="iaw-sectionLabel">Run</p>
          <h1 className="iaw-detailTitle">{title}</h1>
          <p className="iaw-runHeroSummary">{runLead}</p>
        </div>
        <div className="iaw-runHeroMeta">
          <span className={`iaw-status ${statusClassName}`}>{statusLabels[submission.status]}</span>
          {submission.artifact?.downloadUrl ? (
            <a className="iaw-primaryButton" href={submission.artifact.downloadUrl}>
              Download zip
            </a>
          ) : null}
        </div>
      </div>

      <div className="iaw-detailStatsGrid">
        {detailStats.map((item) => (
          <article key={item.label} className="iaw-detailStat">
            <span className="iaw-fieldLabel">{item.label}</span>
            <strong className="iaw-detailStatValue">{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="iaw-runFocusShell">
        <div className="iaw-runFocusCard">
          {submission.architecture?.diagram ? (
            <SubmissionDiagramCanvas diagram={submission.architecture.diagram} />
          ) : (
            <div className="iaw-runFailureState">
              <p className="iaw-sectionLabel">Result</p>
              <h2 className="iaw-runFailureTitle">Run needs review</h2>
              <p className="iaw-detailSummary">
                {submission.failureMessage ?? "The run did not produce a diagram or artifact."}
              </p>
            </div>
          )}
        </div>

        <div className="iaw-runActionDock">
          <div className="iaw-detailTabs" role="tablist" aria-label="Run details">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`iaw-detailTab ${activeTab === tab.id ? "iaw-detailTabActive" : ""}`}
                onClick={() => {
                  setActiveTab(tab.id);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="iaw-runActionButtons">
            {submission.artifact ? (
              <p className="iaw-runActionMeta">
                {submission.artifact.fileName} •{" "}
                {Math.max(1, Math.round(submission.artifact.sizeBytes / 1024))} KB
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {activeTab === "details" ? (
        <div className="iaw-runDetailsGrid">
          <div className="iaw-detailBlock">
            <p className="iaw-sectionLabel">Request</p>
            <p className="iaw-detailRequest">{submission.description}</p>
          </div>

          {submission.artifact ? (
            <div className="iaw-detailBlock">
              <p className="iaw-sectionLabel">Artifact</p>
              <div className="iaw-detailMetricGrid">
                <article className="iaw-detailMetric">
                  <span className="iaw-fieldLabel">File</span>
                  <strong>{submission.artifact.fileName}</strong>
                </article>
                <article className="iaw-detailMetric">
                  <span className="iaw-fieldLabel">Size</span>
                  <strong>{Math.max(1, Math.round(submission.artifact.sizeBytes / 1024))} KB</strong>
                </article>
                <article className="iaw-detailMetric iaw-detailMetricWide">
                  <span className="iaw-fieldLabel">Created</span>
                  <strong>{formatTimestamp(submission.artifact.createdAt)}</strong>
                </article>
              </div>
            </div>
          ) : null}

          {submission.architecture?.summary ? (
            <div className="iaw-detailBlock">
              <p className="iaw-sectionLabel">Summary</p>
              <p className="iaw-detailSummary">{submission.architecture.summary}</p>
            </div>
          ) : null}

          {submission.architecture?.explanation.length ? (
            <div className="iaw-detailBlock">
              <p className="iaw-sectionLabel">Architecture</p>
              <div className="iaw-factList">
                {submission.architecture.explanation.map((item) => (
                  <article key={item.title} className="iaw-factRow">
                    <h3 className="iaw-factTitle">{item.title}</h3>
                    <p className="iaw-factBody">{item.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {submission.architecture?.limitations.length ? (
            <div className="iaw-detailBlock">
              <p className="iaw-sectionLabel">Limits</p>
              <div className="iaw-limitList">
                {submission.architecture.limitations.map((limitation) => (
                  <div key={limitation} className="iaw-limitRow">
                    {limitation}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {submission.aiUsage ? (
            <div className="iaw-detailBlock">
              <p className="iaw-sectionLabel">AI</p>
              <div className="iaw-detailMetricGrid">
                <article className="iaw-detailMetric">
                  <span className="iaw-fieldLabel">Cost</span>
                  <strong>{formatUsd(submission.aiUsage.actualCostUsd)}</strong>
                </article>
                <article className="iaw-detailMetric">
                  <span className="iaw-fieldLabel">Input</span>
                  <strong>{submission.aiUsage.inputTokens.toLocaleString()}</strong>
                </article>
                <article className="iaw-detailMetric">
                  <span className="iaw-fieldLabel">Output</span>
                  <strong>{submission.aiUsage.outputTokens.toLocaleString()}</strong>
                </article>
                <article className="iaw-detailMetric">
                  <span className="iaw-fieldLabel">Calls</span>
                  <strong>{submission.aiUsage.attempts}</strong>
                </article>
                <article className="iaw-detailMetric iaw-detailMetricWide">
                  <span className="iaw-fieldLabel">Model</span>
                  <strong>{submission.aiUsage.modelIds.map(formatModelLabel).join(" / ")}</strong>
                </article>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "modules" ? (
        <div className="iaw-resourceList">
          {submission.architecture?.modules.map((module) => (
            <article key={`${module.moduleId}-${module.source}`} className="iaw-resourceRow">
              <div className="iaw-resourceMetaRow">
                <span
                  className={`iaw-resourceBadge iaw-resourceBadge${module.visibility === "private" ? "Private" : "Public"}`}
                >
                  {module.visibility}
                </span>
                <span className="iaw-resourceId">{module.moduleId}</span>
              </div>
              <h3 className="iaw-resourceTitle">{module.label}</h3>
              <p className="iaw-resourceBody">{module.source}</p>
              <p className="iaw-resourceBody">{module.reason}</p>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "files" ? (
        <div className="iaw-fileList">
          {submission.architecture?.files.map((file) => (
            <div key={file.path} className="iaw-fileRow">
              <span>{file.path}</span>
              <span>{file.language}</span>
              <span>{Math.max(1, Math.round(file.sizeBytes / 1024))} KB</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
