export type WorkspaceView =
  | "create"
  | "history"
  | "run"
  | "admin"
  | "observability";

export type WorkspaceRoute = {
  view: WorkspaceView;
  submissionId?: string;
};

const DEFAULT_ROUTE: WorkspaceRoute = {
  view: "create",
};

export const parseWorkspaceHash = (hash: string): WorkspaceRoute => {
  const normalized = hash.replace(/^#/, "").trim();
  if (!normalized) {
    return DEFAULT_ROUTE;
  }

  if (normalized.startsWith("run/")) {
    const submissionId = normalized.slice(4).trim();
    return submissionId
      ? {
          view: "run",
          submissionId,
        }
      : DEFAULT_ROUTE;
  }

  if (
    normalized === "history" ||
    normalized === "admin" ||
    normalized === "observability"
  ) {
    return {
      view: normalized,
    };
  }

  return DEFAULT_ROUTE;
};

export const formatWorkspaceHash = (route: WorkspaceRoute): string => {
  if (route.view === "run" && route.submissionId) {
    return `run/${route.submissionId}`;
  }

  if (
    route.view === "history" ||
    route.view === "admin" ||
    route.view === "observability"
  ) {
    return route.view;
  }

  return "create";
};
