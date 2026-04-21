"use client";

import { useAdminObservability } from "../lib/use-admin-observability";
import { logout, startLogin } from "../lib/auth";
import { useWorkbenchState } from "../lib/use-workbench-state";
import { GovernancePage } from "./governance-page";
import { HeroStage } from "./hero-stage";
import { ObservabilityPage } from "./observability-page";
import { RunLoadingPanel } from "./run-loading-panel";
import { SignedOutGate } from "./signed-out-gate";
import { SubmissionDetailPanel } from "./submission-detail-panel";
import { WorkspaceHistoryView } from "./workspace-history-view";
import { WorkspaceOverview } from "./workspace-overview";
import { WorkspaceSidebar } from "./workspace-sidebar";

const averageDurationFallbackMs = 95_000;
const publicRepoUrl = "https://github.com/zelikore/infrastructure-as-words";

export function AppShell() {
  const {
    session,
    sessionReady,
    activeView,
    requestText,
    setRequestText,
    submissions,
    selectedSubmissionId,
    selectedSubmission,
    selectedSubmissionSummary,
    historyBusy,
    detailBusy,
    createBusy,
    historyErrorMessage,
    detailErrorMessage,
    createErrorMessage,
    governanceSettings,
    governanceBudget,
    governanceObservability,
    workspaceProfile,
    governanceSaving,
    governanceErrorMessage,
    canAccessGovernance,
    navigateToView,
    openSubmission,
    handleCreate,
    handleSaveGovernance,
  } = useWorkbenchState();

  const sessionIdentity = session?.name ?? session?.email ?? session?.sub;
  const sessionSignedIn = Boolean(session);
  const governedModuleCount =
    governanceSettings?.modules.length ??
    workspaceProfile?.governedModuleCount ??
    0;
  const organizationName =
    governanceSettings?.organizationName ?? workspaceProfile?.organizationName;
  const activeRun = selectedSubmission ?? selectedSubmissionSummary;
  const readyCount = submissions.filter(
    (submission) => submission.status === "completed",
  ).length;
  const totalAiCostUsd = submissions.reduce(
    (total, submission) => total + (submission.aiCostUsd ?? 0),
    0,
  );
  const completedDurationsMs = submissions
    .filter((submission) => submission.status === "completed")
    .map(
      (submission) =>
        new Date(submission.updatedAt).getTime() -
        new Date(submission.createdAt).getTime(),
    )
    .filter((value) => value > 0);
  const averageDurationMs = completedDurationsMs.length
    ? Math.max(
        45_000,
        Math.round(
          completedDurationsMs.reduce((total, value) => total + value, 0) /
            completedDurationsMs.length,
        ),
      )
    : averageDurationFallbackMs;
  const {
    observabilitySnapshot,
    observabilityLoading,
    observabilityErrorMessage,
    refreshObservability,
  } = useAdminObservability({
    activeView,
    canAccessGovernance,
    signedIn: sessionSignedIn,
  });

  return (
    <main
      className={`iaw-page ${sessionSignedIn ? "iaw-pageWorkspace" : "iaw-pageLanding"}`}
    >
      <div
        className={`iaw-chrome ${sessionSignedIn ? "iaw-chromeWorkspace" : "iaw-chromeLanding"}`}
      >
        <section
          className="iaw-challengeBanner"
          aria-label="Challenge attribution"
        >
          <p className="iaw-challengeBannerText">
            Created by Elijah Faviel for the CVS team take-home coding
            challenge.
          </p>
          <a
            className="iaw-challengeBannerLink"
            href={publicRepoUrl}
            target="_blank"
            rel="noreferrer"
          >
            View code
          </a>
        </section>

        <header className="iaw-header">
          <div className="iaw-brand">
            <span className="iaw-brandMark" aria-hidden="true" />
            <div>
              <p className="iaw-brandTitle">Infrastructure as Words</p>
              <p className="iaw-brandSubtitle">
                {sessionSignedIn
                  ? "Generation workspace"
                  : "Governed Terraform generation"}
              </p>
            </div>
          </div>

          <div className="iaw-headerActions">
            <p className="iaw-session">
              {sessionReady
                ? sessionSignedIn
                  ? (sessionIdentity ?? "Signed in")
                  : "Signed out"
                : "Loading"}
            </p>
            {session ? (
              <button
                type="button"
                className="iaw-secondaryButton"
                onClick={() => {
                  void logout();
                }}
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                className="iaw-secondaryButton"
                disabled={!sessionReady}
                onClick={() => {
                  void startLogin();
                }}
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        {sessionSignedIn ? (
          <div className="iaw-appShell">
            <WorkspaceSidebar
              activeView={activeView}
              canAccessGovernance={canAccessGovernance}
              hasSelectedRun={Boolean(selectedSubmissionId)}
              organizationName={organizationName}
              runCount={submissions.length}
              readyCount={readyCount}
              totalAiCostUsd={totalAiCostUsd}
              activeRunSummary={activeRun?.summary ?? activeRun?.description}
              activeRunStatus={activeRun?.status}
              onNavigate={navigateToView}
              onOpenRun={() => {
                if (selectedSubmissionId) {
                  openSubmission(selectedSubmissionId);
                }
              }}
            />

            <div className="iaw-appContent">
              {activeView === "create" ? (
                <WorkspaceOverview
                  requestText={requestText}
                  createBusy={createBusy}
                  sessionReady={sessionReady}
                  createErrorMessage={createErrorMessage}
                  moduleCount={governedModuleCount}
                  averageDurationMs={averageDurationMs}
                  submissions={submissions}
                  selectedSubmissionId={selectedSubmissionId}
                  historyBusy={historyBusy}
                  historyErrorMessage={historyErrorMessage}
                  onRequestChange={setRequestText}
                  onUseStarter={setRequestText}
                  onCreate={handleCreate}
                  onOpenRun={openSubmission}
                />
              ) : null}

              {activeView === "history" ? (
                <WorkspaceHistoryView
                  submissions={submissions}
                  selectedSubmissionId={selectedSubmissionId}
                  historyBusy={historyBusy}
                  historyErrorMessage={historyErrorMessage}
                  onOpenRun={openSubmission}
                />
              ) : null}

              {activeView === "run" && activeRun?.status === "pending" ? (
                <RunLoadingPanel
                  submission={activeRun}
                  averageDurationMs={averageDurationMs}
                />
              ) : null}

              {activeView === "run" && activeRun?.status !== "pending" ? (
                <SubmissionDetailPanel
                  submission={selectedSubmission}
                  loading={
                    detailBusy || Boolean(activeRun && !selectedSubmission)
                  }
                  errorMessage={detailErrorMessage}
                />
              ) : null}

              {activeView === "run" && !activeRun ? (
                <SubmissionDetailPanel
                  submission={undefined}
                  loading={detailBusy}
                  errorMessage={detailErrorMessage}
                />
              ) : null}

              {activeView === "admin" && canAccessGovernance ? (
                <GovernancePage
                  settings={governanceSettings}
                  budget={governanceBudget}
                  observability={governanceObservability}
                  saving={governanceSaving}
                  errorMessage={governanceErrorMessage}
                  onSave={handleSaveGovernance}
                />
              ) : null}

              {activeView === "observability" && canAccessGovernance ? (
                <ObservabilityPage
                  snapshot={observabilitySnapshot}
                  loading={observabilityLoading}
                  errorMessage={observabilityErrorMessage}
                  onRefresh={refreshObservability}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <section className="iaw-landingHero">
              <div className="iaw-landingCopy">
                <div className="iaw-heroCopy">
                  <p className="iaw-kicker">Bedrock</p>
                  <h1 className="iaw-title">
                    Describe infra.
                    <span className="iaw-titleAccent">
                      {" "}
                      Open the workspace.
                    </span>
                  </h1>
                  <p className="iaw-heroSummary">
                    Prompt in, diagram out, artifacts ready.
                  </p>
                </div>

                <SignedOutGate
                  sessionReady={sessionReady}
                  onSignIn={() => {
                    void startLogin();
                  }}
                />
              </div>

              <HeroStage
                mode="landing"
                request="Private customer platform with auth, API, storage, and audit history."
                submissionCount={18}
                selectedStatus="completed"
                moduleCount={14}
                artifactReady
              />
            </section>

            <section className="iaw-proofRail" aria-label="Outputs">
              <article className="iaw-proofCard">
                <span
                  className="iaw-proofGlyph iaw-proofGlyphZip"
                  aria-hidden="true"
                />
                <p className="iaw-proofLabel">Terraform zip</p>
              </article>
              <article className="iaw-proofCard">
                <span
                  className="iaw-proofGlyph iaw-proofGlyphDiagram"
                  aria-hidden="true"
                />
                <p className="iaw-proofLabel">Live diagram</p>
              </article>
              <article className="iaw-proofCard">
                <span
                  className="iaw-proofGlyph iaw-proofGlyphHistory"
                  aria-hidden="true"
                />
                <p className="iaw-proofLabel">History and spend</p>
              </article>
              <article className="iaw-proofCard">
                <span
                  className="iaw-proofGlyph iaw-proofGlyphRules"
                  aria-hidden="true"
                />
                <p className="iaw-proofLabel">Org rules first</p>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
