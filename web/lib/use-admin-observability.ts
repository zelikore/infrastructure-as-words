"use client";

import { useEffect, useState } from "react";
import type { AdminObservabilityResponse } from "@infrastructure-as-words/contracts";
import { fetchAdminObservability } from "./submissions";
import type { WorkspaceView } from "./workspace-route";

const POLL_INTERVAL_MS = 30_000;

type UseAdminObservabilityOptions = {
  activeView: WorkspaceView;
  canAccessGovernance: boolean;
  signedIn: boolean;
};

export function useAdminObservability({
  activeView,
  canAccessGovernance,
  signedIn,
}: UseAdminObservabilityOptions) {
  const [snapshot, setSnapshot] = useState<
    AdminObservabilityResponse | undefined
  >();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!signedIn || !canAccessGovernance) {
      setSnapshot(undefined);
      setLoading(false);
      setErrorMessage(undefined);
      return;
    }

    if (activeView !== "observability") {
      return;
    }

    let cancelled = false;

    const load = async (mode: "initial" | "refresh") => {
      if (mode === "initial") {
        setLoading(true);
      }

      try {
        const nextSnapshot = await fetchAdminObservability();
        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setErrorMessage(undefined);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load observability.",
          );
        }
      } finally {
        if (!cancelled && mode === "initial") {
          setLoading(false);
        }
      }
    };

    void load("initial");
    const intervalId = window.setInterval(() => {
      void load("refresh");
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeView, canAccessGovernance, refreshVersion, signedIn]);

  return {
    observabilitySnapshot: snapshot,
    observabilityLoading: loading,
    observabilityErrorMessage: errorMessage,
    refreshObservability: () => {
      setRefreshVersion((current) => current + 1);
    },
  };
}
