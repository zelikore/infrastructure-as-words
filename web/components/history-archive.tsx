"use client";

import { useDeferredValue, useState } from "react";
import type { SubmissionSummary } from "@infrastructure-as-words/contracts";

type HistoryArchiveProps = {
  sessionSignedIn: boolean;
  historyBusy: boolean;
  historyErrorMessage: string | undefined;
  selectedSubmissionId: string | undefined;
  submissions: SubmissionSummary[];
  onSelect: (submissionId: string) => void;
};

type StatusFilter = "all" | SubmissionSummary["status"];
type ArtifactFilter = "all" | "zip" | "plan";
type SortOrder = "newest" | "oldest" | "cost-desc" | "cost-asc";

const formatTimestamp = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

const formatUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2
  }).format(value);

const statusClassName = (status: SubmissionSummary["status"]): string => {
  if (status === "completed") {
    return "iaw-statusReady";
  }

  if (status === "failed") {
    return "iaw-statusFailed";
  }

  return "iaw-statusPending";
};

const statusLabel = (status: SubmissionSummary["status"]): string => {
  if (status === "completed") {
    return "Ready";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Running";
};

const matchesQuery = (submission: SubmissionSummary, query: string): boolean => {
  if (!query) {
    return true;
  }

  const haystack = [
    submission.submissionId,
    submission.summary ?? "",
    submission.description
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
};

const sortSubmissions = (submissions: SubmissionSummary[], order: SortOrder): SubmissionSummary[] => {
  const next = [...submissions];

  next.sort((left, right) => {
    if (order === "oldest") {
      return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
    }

    if (order === "cost-desc") {
      const leftCost = left.aiCostUsd ?? Number.NEGATIVE_INFINITY;
      const rightCost = right.aiCostUsd ?? Number.NEGATIVE_INFINITY;
      if (leftCost !== rightCost) {
        return rightCost - leftCost;
      }
    }

    if (order === "cost-asc") {
      const leftCost = left.aiCostUsd ?? Number.POSITIVE_INFINITY;
      const rightCost = right.aiCostUsd ?? Number.POSITIVE_INFINITY;
      if (leftCost !== rightCost) {
        return leftCost - rightCost;
      }
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

  return next;
};

export function HistoryArchive({
  sessionSignedIn,
  historyBusy,
  historyErrorMessage,
  selectedSubmissionId,
  submissions,
  onSelect
}: HistoryArchiveProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [artifactFilter, setArtifactFilter] = useState<ArtifactFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const visibleSubmissions = sortSubmissions(
    submissions.filter((submission) => {
      if (statusFilter !== "all" && submission.status !== statusFilter) {
        return false;
      }

      if (artifactFilter === "zip" && !submission.artifactAvailable) {
        return false;
      }

      if (artifactFilter === "plan" && submission.artifactAvailable) {
        return false;
      }

      return matchesQuery(submission, deferredQuery);
    }),
    sortOrder
  );
  const visibleCostUsd = visibleSubmissions.reduce(
    (total, submission) => total + (submission.aiCostUsd ?? 0),
    0
  );

  return (
    <section className="iaw-archive">
      <div className="iaw-archiveHeader">
        <div>
          <p className="iaw-sectionLabel">Runs</p>
          <h2 className="iaw-archiveTitle">Run list</h2>
        </div>
        <p className="iaw-archiveStatus">
          {historyBusy ? "Refreshing" : `${visibleSubmissions.length} shown • ${formatUsd(visibleCostUsd)}`}
        </p>
      </div>

      {sessionSignedIn ? (
        <>
          {historyErrorMessage ? <p className="iaw-error">{historyErrorMessage}</p> : null}
          <div className="iaw-archiveFilters">
            <label className="iaw-filterField">
              <span className="iaw-fieldLabel">Search</span>
              <input
                className="iaw-filterInput"
                type="search"
                value={query}
                placeholder="Find run or request"
                aria-label="Search runs"
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
              />
            </label>

            <label className="iaw-filterField">
              <span className="iaw-fieldLabel">Status</span>
              <select
                className="iaw-filterSelect"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as StatusFilter);
                }}
              >
                <option value="all">All</option>
                <option value="pending">Running</option>
                <option value="completed">Ready</option>
                <option value="failed">Failed</option>
              </select>
            </label>

            <label className="iaw-filterField">
              <span className="iaw-fieldLabel">Artifact</span>
              <select
                className="iaw-filterSelect"
                value={artifactFilter}
                onChange={(event) => {
                  setArtifactFilter(event.target.value as ArtifactFilter);
                }}
              >
                <option value="all">All</option>
                <option value="zip">Zip</option>
                <option value="plan">Plan only</option>
              </select>
            </label>

            <label className="iaw-filterField">
              <span className="iaw-fieldLabel">Sort</span>
              <select
                className="iaw-filterSelect"
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value as SortOrder);
                }}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="cost-desc">Cost high</option>
                <option value="cost-asc">Cost low</option>
              </select>
            </label>
          </div>

          {submissions.length > 0 ? (
            visibleSubmissions.length > 0 ? (
              <div className="iaw-runTable">
                <div className="iaw-runHead" aria-hidden="true">
                  <span>Run</span>
                  <span>Synopsis</span>
                  <span>Updated</span>
                  <span>Status</span>
                  <span>Cost</span>
                  <span>Zip</span>
                </div>
                {visibleSubmissions.map((submission) => {
                  const active = submission.submissionId === selectedSubmissionId;
                  return (
                    <button
                      key={submission.submissionId}
                      type="button"
                      className={`iaw-runRow ${active ? "iaw-runRowActive" : ""}`}
                      onClick={() => {
                        onSelect(submission.submissionId);
                      }}
                    >
                      <span className="iaw-runCell iaw-runCellMono" data-label="Run">
                        {submission.submissionId.slice(0, 8)}
                      </span>

                      <span className="iaw-runPrimary" data-label="Synopsis">
                        <span className="iaw-runText">
                          {submission.summary ?? submission.description}
                        </span>
                        <span className="iaw-runSubtext">{submission.description}</span>
                      </span>

                      <span className="iaw-runCell" data-label="Updated">
                        {formatTimestamp(submission.updatedAt)}
                      </span>

                      <span className="iaw-runCell" data-label="Status">
                        <span className={`iaw-status iaw-statusInline ${statusClassName(submission.status)}`}>
                          {statusLabel(submission.status)}
                        </span>
                      </span>

                      <span className="iaw-runCell iaw-runCellMono" data-label="Cost">
                        {typeof submission.aiCostUsd === "number"
                          ? formatUsd(submission.aiCostUsd)
                          : "—"}
                      </span>

                      <span className="iaw-runCell iaw-runCellMono" data-label="Zip">
                        {submission.artifactAvailable ? "Ready" : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="iaw-emptyState iaw-archiveEmpty">No matching runs.</div>
            )
          ) : (
            <div className="iaw-emptyState iaw-archiveEmpty">No runs.</div>
          )}
        </>
      ) : (
        <div className="iaw-emptyState iaw-archiveEmpty">Sign in for history.</div>
      )}
    </section>
  );
}
