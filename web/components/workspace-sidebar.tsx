"use client";

import type { SubmissionStatus } from "@infrastructure-as-words/contracts";
import type { WorkspaceView } from "../lib/workspace-route";

type WorkspaceSidebarProps = {
  activeView: WorkspaceView;
  canAccessGovernance: boolean;
  hasSelectedRun: boolean;
  organizationName: string | undefined;
  runCount: number;
  readyCount: number;
  totalAiCostUsd: number;
  activeRunSummary: string | undefined;
  activeRunStatus: SubmissionStatus | undefined;
  onNavigate: (view: Exclude<WorkspaceView, "run">) => void;
  onOpenRun: () => void;
};

const primaryItems = [
  {
    id: "create",
    label: "Create"
  },
  {
    id: "history",
    label: "History"
  }
] as const;

const formatUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2
  }).format(value);

const statusLabel = (status: SubmissionStatus | undefined): string => {
  if (status === "completed") {
    return "Ready";
  }

  if (status === "failed") {
    return "Review";
  }

  if (status === "pending") {
    return "Running";
  }

  return "Idle";
};

export function WorkspaceSidebar({
  activeView,
  canAccessGovernance,
  hasSelectedRun,
  organizationName,
  runCount,
  readyCount,
  totalAiCostUsd,
  activeRunSummary,
  activeRunStatus,
  onNavigate,
  onOpenRun
}: WorkspaceSidebarProps) {
  return (
    <aside className="iaw-workspaceRail" aria-label="Workspace navigation">
      <div className="iaw-workspaceRailHeader">
        <div>
          <p className="iaw-sectionLabel">Workspace</p>
          <h2 className="iaw-workspaceRailTitle">{organizationName ?? "Generation console"}</h2>
        </div>
        <p className="iaw-workspaceRailSummary">{runCount} runs tracked</p>
      </div>

      <div className="iaw-workspaceRailStats" aria-label="Workspace status">
        <article className="iaw-workspaceRailStat">
          <span className="iaw-fieldLabel">Ready</span>
          <strong>{readyCount}</strong>
        </article>
        <article className="iaw-workspaceRailStat">
          <span className="iaw-fieldLabel">Spend</span>
          <strong>{formatUsd(totalAiCostUsd)}</strong>
        </article>
      </div>

      <div className="iaw-workspaceRailGroup">
        <p className="iaw-sectionLabel">Views</p>
        <div className="iaw-workspaceNavList">
          {primaryItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`iaw-workspaceNavButton ${
                activeView === item.id ? "iaw-workspaceNavButtonActive" : ""
              }`}
              onClick={() => {
                onNavigate(item.id);
              }}
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            className={`iaw-workspaceNavButton ${activeView === "run" ? "iaw-workspaceNavButtonActive" : ""}`}
            disabled={!hasSelectedRun}
            onClick={onOpenRun}
          >
            Current run
          </button>
        </div>
      </div>

      {hasSelectedRun ? (
        <button
          type="button"
          className="iaw-workspaceRailRunCard"
          onClick={onOpenRun}
          aria-label="Open current run"
        >
          <span className="iaw-fieldLabel">Current run</span>
          <strong className="iaw-workspaceRailRunStatus">{statusLabel(activeRunStatus)}</strong>
          <span className="iaw-workspaceRailRunSummary">
            {activeRunSummary ?? "Open the latest generated result."}
          </span>
        </button>
      ) : null}

      {canAccessGovernance ? (
        <div className="iaw-workspaceRailGroup">
          <p className="iaw-sectionLabel">Admin</p>
          <div className="iaw-workspaceNavList">
            <button
              type="button"
              className={`iaw-workspaceNavButton ${
                activeView === "admin" ? "iaw-workspaceNavButtonActive" : ""
              }`}
              onClick={() => {
                onNavigate("admin");
              }}
            >
              Governance
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
