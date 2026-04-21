"use client";

import type { SubmissionSummary } from "@infrastructure-as-words/contracts";
import { HistoryArchive } from "./history-archive";

type WorkspaceHistoryViewProps = {
  submissions: SubmissionSummary[];
  selectedSubmissionId: string | undefined;
  historyBusy: boolean;
  historyErrorMessage: string | undefined;
  onOpenRun: (submissionId: string) => void;
};

const formatUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2
  }).format(value);

export function WorkspaceHistoryView({
  submissions,
  selectedSubmissionId,
  historyBusy,
  historyErrorMessage,
  onOpenRun
}: WorkspaceHistoryViewProps) {
  const readyCount = submissions.filter((submission) => submission.status === "completed").length;
  const totalAiCostUsd = submissions.reduce(
    (total, submission) => total + (submission.aiCostUsd ?? 0),
    0
  );

  return (
    <div className="iaw-workspaceView">
      <section className="iaw-historyHero iaw-surface">
        <div>
          <p className="iaw-sectionLabel">History</p>
          <h1 className="iaw-consoleTitle">Previous requests</h1>
        </div>

        <div className="iaw-consoleMetaGrid">
          <article className="iaw-consoleMetaCard">
            <span className="iaw-fieldLabel">Runs</span>
            <strong className="iaw-consoleMetaValue">{submissions.length}</strong>
          </article>
          <article className="iaw-consoleMetaCard">
            <span className="iaw-fieldLabel">Ready</span>
            <strong className="iaw-consoleMetaValue">{readyCount}</strong>
          </article>
          <article className="iaw-consoleMetaCard">
            <span className="iaw-fieldLabel">Spend</span>
            <strong className="iaw-consoleMetaValue">{formatUsd(totalAiCostUsd)}</strong>
          </article>
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
