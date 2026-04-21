"use client";

import { useEffect, useState } from "react";
import {
  SUBMISSION_DESCRIPTION_MAX_LENGTH,
  type BudgetStatus,
  type GenerationSettings,
  type GenerationSettingsInput,
  type ObservabilityConsoleLinks,
  type SubmissionDetail,
  type SubmissionSummary,
  type WorkspaceProfile,
} from "@infrastructure-as-words/contracts";
import {
  clearSession,
  getSession,
  startLogin,
  subscribeToSessionChanges,
  type SessionProfile,
} from "./auth";
import {
  createSubmission,
  fetchGenerationSettings,
  fetchSubmissionDetail,
  fetchSubmissionHistory,
  fetchWorkspaceProfile,
  updateGenerationSettings,
} from "./submissions";
import { type WorkspaceView } from "./workspace-route";
import { useWorkspaceNavigation } from "./use-workspace-navigation";

const DRAFT_STORAGE_KEY = "infrastructure-as-words.request.v2";

const readStoredRequest = (): string =>
  window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? "";

const withUpdatedSummary = (
  submissions: SubmissionSummary[],
  submission: SubmissionDetail,
): SubmissionSummary[] => {
  const nextSummary: SubmissionSummary = {
    submissionId: submission.submissionId,
    userSub: submission.userSub,
    ...(submission.userEmail ? { userEmail: submission.userEmail } : {}),
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    status: submission.status,
    description: submission.description,
    ...(submission.summary ? { summary: submission.summary } : {}),
    artifactAvailable: submission.artifactAvailable,
    ...(typeof submission.aiCostUsd === "number"
      ? { aiCostUsd: submission.aiCostUsd }
      : {}),
  };

  const existingIndex = submissions.findIndex(
    (entry) => entry.submissionId === submission.submissionId,
  );
  if (existingIndex < 0) {
    return [nextSummary, ...submissions];
  }

  return submissions.map((entry, index) =>
    index === existingIndex ? nextSummary : entry,
  );
};

export function useWorkbenchState() {
  const [session, setSession] = useState<SessionProfile | undefined>();
  const [sessionReady, setSessionReady] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<
    string | undefined
  >();
  const [selectedSubmission, setSelectedSubmission] = useState<
    SubmissionDetail | undefined
  >();
  const [historyBusy, setHistoryBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [historyErrorMessage, setHistoryErrorMessage] = useState<
    string | undefined
  >();
  const [detailErrorMessage, setDetailErrorMessage] = useState<
    string | undefined
  >();
  const [createErrorMessage, setCreateErrorMessage] = useState<
    string | undefined
  >();
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const [governanceSettings, setGovernanceSettings] = useState<
    GenerationSettings | undefined
  >();
  const [governanceBudget, setGovernanceBudget] = useState<
    BudgetStatus | undefined
  >();
  const [governanceObservability, setGovernanceObservability] = useState<
    ObservabilityConsoleLinks | undefined
  >();
  const [workspaceProfile, setWorkspaceProfile] = useState<
    WorkspaceProfile | undefined
  >();
  const [governanceSaving, setGovernanceSaving] = useState(false);
  const [governanceErrorMessage, setGovernanceErrorMessage] = useState<
    string | undefined
  >();
  const [canAccessGovernance, setCanAccessGovernance] = useState(false);
  const { activeView, routeSubmissionId, syncRoute } = useWorkspaceNavigation();

  useEffect(() => {
    setRequestText(readStoredRequest());
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (routeSubmissionId) {
      setSelectedSubmissionId(routeSubmissionId);
    }
  }, [routeSubmissionId]);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    window.localStorage.setItem(DRAFT_STORAGE_KEY, requestText);
  }, [draftReady, requestText]);

  useEffect(() => {
    let cancelled = false;

    const syncSession = async () => {
      try {
        const currentSession = await getSession();
        if (!cancelled) {
          setSession(currentSession?.profile);
        }
      } catch {
        if (!cancelled) {
          clearSession();
          setSession(undefined);
        }
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    };

    void syncSession();
    const unsubscribe = subscribeToSessionChanges(() => {
      void syncSession();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      if (!session) {
        syncRoute(
          {
            view: "create",
          },
          "replace",
        );
        setSubmissions([]);
        setSelectedSubmissionId(undefined);
        setSelectedSubmission(undefined);
        setHistoryErrorMessage(undefined);
        setCanAccessGovernance(false);
        setGovernanceSettings(undefined);
        setGovernanceBudget(undefined);
        setGovernanceObservability(undefined);
        setWorkspaceProfile(undefined);
        return;
      }

      setHistoryBusy(true);
      setHistoryErrorMessage(undefined);
      try {
        const nextSubmissions = await fetchSubmissionHistory();
        if (!cancelled) {
          setSubmissions(nextSubmissions);
          setSelectedSubmissionId(
            (current) => current ?? nextSubmissions[0]?.submissionId,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setHistoryErrorMessage(
            error instanceof Error ? error.message : "Failed to load history.",
          );
        }
      } finally {
        if (!cancelled) {
          setHistoryBusy(false);
        }
      }

      try {
        const profile = await fetchWorkspaceProfile();
        if (!cancelled) {
          setWorkspaceProfile(profile);
          setCanAccessGovernance(profile.canManageGovernance);
        }

        if (!profile.canManageGovernance) {
          if (!cancelled) {
            setGovernanceSettings(undefined);
            setGovernanceBudget(undefined);
            setGovernanceObservability(undefined);
            setGovernanceErrorMessage(undefined);
          }
          return;
        }

        const response = await fetchGenerationSettings();
        if (!cancelled) {
          setGovernanceSettings(response.settings);
          setGovernanceBudget(response.budget);
          setGovernanceObservability(response.observability);
          setGovernanceErrorMessage(undefined);
        }
      } catch (error) {
        if (!cancelled) {
          setCanAccessGovernance(false);
          setGovernanceSettings(undefined);
          setGovernanceBudget(undefined);
          setGovernanceObservability(undefined);
          setWorkspaceProfile(undefined);
          setGovernanceErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load governance.",
          );
        }
      }
    };

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [session, syncRoute]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (activeView === "admin" && workspaceProfile && !canAccessGovernance) {
      syncRoute(
        {
          view: "create",
        },
        "replace",
      );
      return;
    }

    if (activeView === "run" && !selectedSubmissionId && submissions[0]) {
      syncRoute(
        {
          view: "run",
          submissionId: submissions[0].submissionId,
        },
        "replace",
      );
    }
  }, [
    activeView,
    canAccessGovernance,
    selectedSubmissionId,
    session,
    submissions,
    syncRoute,
    workspaceProfile,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!session || !selectedSubmissionId) {
        setSelectedSubmission(undefined);
        setDetailBusy(false);
        setDetailErrorMessage(undefined);
        return;
      }

      setDetailBusy(true);
      setDetailErrorMessage(undefined);
      try {
        const nextSubmission =
          await fetchSubmissionDetail(selectedSubmissionId);
        if (!cancelled) {
          setSelectedSubmission(nextSubmission);
          setSubmissions((current) =>
            withUpdatedSummary(current, nextSubmission),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setDetailErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load the selected system.",
          );
        }
      } finally {
        if (!cancelled) {
          setDetailBusy(false);
        }
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedSubmissionId, session]);

  useEffect(() => {
    if (
      !session ||
      !selectedSubmissionId ||
      selectedSubmission?.status !== "pending"
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const nextSubmission =
            await fetchSubmissionDetail(selectedSubmissionId);
          setSelectedSubmission(nextSubmission);
          setSubmissions((current) =>
            withUpdatedSummary(current, nextSubmission),
          );
        } catch {
          return;
        }
      })();
    }, 4_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [selectedSubmission, selectedSubmissionId, session]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createBusy || !sessionReady) {
      return;
    }

    const description = requestText.trim();
    if (!description) {
      setCreateErrorMessage("Describe the infrastructure first.");
      return;
    }

    if (description.length > SUBMISSION_DESCRIPTION_MAX_LENGTH) {
      setCreateErrorMessage(
        `Keep the request under ${SUBMISSION_DESCRIPTION_MAX_LENGTH} characters.`,
      );
      return;
    }

    setCreateBusy(true);
    setCreateErrorMessage(undefined);
    try {
      if (!session) {
        await startLogin();
        return;
      }

      const created = await createSubmission({
        description,
      });

      setSubmissions((current) => [created, ...current]);
      setSelectedSubmissionId(created.submissionId);
      setSelectedSubmission(created);
      setRequestText("");
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      syncRoute(
        {
          view: "run",
          submissionId: created.submissionId,
        },
        "push",
      );
    } catch (error) {
      setCreateErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create the request.",
      );
    } finally {
      setCreateBusy(false);
    }
  };

  const handleSaveGovernance = async (settings: GenerationSettingsInput) => {
    setGovernanceSaving(true);
    setGovernanceErrorMessage(undefined);
    try {
      const response = await updateGenerationSettings(settings);
      setGovernanceSettings(response.settings);
      setGovernanceBudget(response.budget);
      setGovernanceObservability(response.observability);
      setWorkspaceProfile({
        organizationName: response.settings.organizationName,
        governedModuleCount: response.settings.modules.length,
        canManageGovernance: true,
      });
      setCanAccessGovernance(true);
    } catch (error) {
      setGovernanceErrorMessage(
        error instanceof Error ? error.message : "Failed to save governance.",
      );
      throw error;
    } finally {
      setGovernanceSaving(false);
    }
  };

  return {
    session,
    sessionReady,
    activeView,
    requestText,
    setRequestText,
    submissions,
    selectedSubmissionId,
    setSelectedSubmissionId,
    selectedSubmission,
    selectedSubmissionSummary: selectedSubmissionId
      ? submissions.find(
          (submission) => submission.submissionId === selectedSubmissionId,
        )
      : undefined,
    historyBusy,
    detailBusy,
    createBusy,
    historyErrorMessage,
    detailErrorMessage,
    createErrorMessage,
    governanceOpen,
    setGovernanceOpen,
    governanceSettings,
    governanceBudget,
    governanceObservability,
    workspaceProfile,
    governanceSaving,
    governanceErrorMessage,
    canAccessGovernance,
    navigateToView: (view: WorkspaceView) => {
      syncRoute(
        {
          view,
        },
        "push",
      );
    },
    openSubmission: (submissionId: string) => {
      syncRoute(
        {
          view: "run",
          submissionId,
        },
        "push",
      );
    },
    handleCreate,
    handleSaveGovernance,
  };
}
