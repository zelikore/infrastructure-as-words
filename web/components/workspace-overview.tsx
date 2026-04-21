"use client";

import type { FormEvent } from "react";
import type { SubmissionSummary } from "@infrastructure-as-words/contracts";
import { HeroStage } from "./hero-stage";
import { HistoryArchive } from "./history-archive";
import { SubmissionComposer } from "./submission-composer";

type WorkspaceOverviewProps = {
  requestText: string;
  createBusy: boolean;
  sessionReady: boolean;
  createErrorMessage: string | undefined;
  moduleCount: number;
  averageDurationMs: number;
  submissions: SubmissionSummary[];
  selectedSubmissionId: string | undefined;
  historyBusy: boolean;
  historyErrorMessage: string | undefined;
  onRequestChange: (value: string) => void;
  onUseStarter: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onOpenRun: (submissionId: string) => void;
};

const formatUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2
  }).format(value);

const formatAverageDuration = (value: number): string => {
  const totalSeconds = Math.max(1, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
};

export function WorkspaceOverview({
  requestText,
  createBusy,
  sessionReady,
  createErrorMessage,
  moduleCount,
  averageDurationMs,
  submissions,
  selectedSubmissionId,
  historyBusy,
  historyErrorMessage,
  onRequestChange,
  onUseStarter,
  onCreate,
  onOpenRun
}: WorkspaceOverviewProps) {
  const totalAiCostUsd = submissions.reduce(
    (total, submission) => total + (submission.aiCostUsd ?? 0),
    0
  );

  return (
    <div className="iaw-workspaceView">
      <section className="iaw-builderHero">
        <div className="iaw-builderLead iaw-surface">
          <div className="iaw-builderIntro">
            <div>
              <p className="iaw-sectionLabel">Create</p>
              <h1 className="iaw-consoleTitle">Describe infrastructure.</h1>
            </div>
            <p className="iaw-builderSummary">Prompt in. Diagram and Terraform out.</p>
          </div>

          <div className="iaw-builderSignals" aria-label="Generation outputs">
            <article className="iaw-builderSignal">
              <span className="iaw-fieldLabel">Output</span>
              <strong>Diagram</strong>
            </article>
            <article className="iaw-builderSignal">
              <span className="iaw-fieldLabel">Artifact</span>
              <strong>Terraform zip</strong>
            </article>
            <article className="iaw-builderSignal">
              <span className="iaw-fieldLabel">Governed</span>
              <strong>{moduleCount} modules</strong>
            </article>
            <article className="iaw-builderSignal">
              <span className="iaw-fieldLabel">Average</span>
              <strong>{formatAverageDuration(averageDurationMs)}</strong>
            </article>
          </div>

          <SubmissionComposer
            variant="workspace"
            value={requestText}
            busy={createBusy}
            sessionReady={sessionReady}
            sessionSignedIn
            errorMessage={createErrorMessage}
            moduleCount={moduleCount}
            onChange={onRequestChange}
            onUseStarter={onUseStarter}
            onSubmit={onCreate}
          />
        </div>

        <div className="iaw-builderPreview">
          <HeroStage
            mode="workspace"
            request={requestText}
            submissionCount={submissions.length}
            selectedStatus={undefined}
            moduleCount={moduleCount}
            artifactReady={false}
          />
          <div className="iaw-builderCallout iaw-surface">
            <div className="iaw-builderCalloutRow">
              <span className="iaw-fieldLabel">Flow</span>
              <strong>Request</strong>
            </div>
            <div className="iaw-builderCalloutRow">
              <span className="iaw-fieldLabel">Then</span>
              <strong>Diagram</strong>
            </div>
            <div className="iaw-builderCalloutRow">
              <span className="iaw-fieldLabel">Spend</span>
              <strong>{formatUsd(totalAiCostUsd)}</strong>
            </div>
          </div>
        </div>
      </section>

      <HistoryArchive
        sessionSignedIn
        historyBusy={historyBusy}
        historyErrorMessage={historyErrorMessage}
        selectedSubmissionId={selectedSubmissionId}
        submissions={submissions}
        onSelect={onOpenRun}
      />
    </div>
  );
}
