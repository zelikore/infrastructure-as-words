"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatWorkspaceHash,
  parseWorkspaceHash,
  type WorkspaceRoute,
  type WorkspaceView
} from "./workspace-route";

export function useWorkspaceNavigation() {
  const [activeView, setActiveView] = useState<WorkspaceView>("create");
  const [routeSubmissionId, setRouteSubmissionId] = useState<string | undefined>();

  const applyRoute = useCallback((route: WorkspaceRoute) => {
    setActiveView(route.view);
    setRouteSubmissionId(route.submissionId);
  }, []);

  const syncRoute = useCallback((route: WorkspaceRoute, mode: "push" | "replace" = "push") => {
    const nextHash = `#${formatWorkspaceHash(route)}`;
    const currentHash = window.location.hash || "#create";
    if (currentHash !== nextHash) {
      const url = new URL(window.location.href);
      url.hash = nextHash;
      window.history[mode === "replace" ? "replaceState" : "pushState"](null, "", url);
    }

    applyRoute(route);
  }, [applyRoute]);

  useEffect(() => {
    applyRoute(parseWorkspaceHash(window.location.hash));

    const handleHashChange = () => {
      applyRoute(parseWorkspaceHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [applyRoute]);

  return {
    activeView,
    routeSubmissionId,
    setActiveView,
    syncRoute
  };
}
