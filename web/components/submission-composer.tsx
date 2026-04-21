import type { FormEvent, KeyboardEvent } from "react";
import { SUBMISSION_DESCRIPTION_MAX_LENGTH } from "@infrastructure-as-words/contracts";

type SubmissionComposerProps = {
  variant: "landing" | "workspace";
  value: string;
  busy: boolean;
  sessionReady: boolean;
  sessionSignedIn: boolean;
  errorMessage: string | undefined;
  moduleCount: number;
  onChange: (value: string) => void;
  onUseStarter: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const starterPrompts = [
  {
    label: "Internal",
    detail: "Private workflows",
    value:
      "A secure internal platform where teams request new environments, review previous stacks, and download Terraform packages."
  },
  {
    label: "Customer",
    detail: "Frontend + API",
    value:
      "A customer-facing web platform with Cognito auth, an API layer, durable storage, and observability from day one."
  },
  {
    label: "Automation",
    detail: "Async jobs",
    value:
      "A multi-tenant automation service that ingests jobs, processes them asynchronously, and keeps an auditable history."
  }
] as const;

export function SubmissionComposer({
  variant,
  value,
  busy,
  sessionReady,
  sessionSignedIn,
  errorMessage,
  moduleCount,
  onChange,
  onUseStarter,
  onSubmit
}: SubmissionComposerProps) {
  const primaryLabel = busy
    ? "Generating"
    : sessionSignedIn
      ? "Generate run"
      : sessionReady
        ? "Continue"
        : "Loading";
  const title = variant === "landing" ? "Start" : "Prompt";
  const label = variant === "landing" ? "Prompt" : "Input";
  const helperText = sessionSignedIn
    ? "Diagram and zip follow"
    : sessionReady
      ? "Continue through Cognito"
      : "Checking session";
  const placeholder =
    variant === "landing"
      ? "Describe the stack."
      : "A private customer platform with Cognito, API, storage, and audit history.";

  const handleShortcut = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <form
      className={`iaw-composer iaw-surface ${
        variant === "landing" ? "iaw-composerLanding" : "iaw-composerWorkspace"
      }`}
      onSubmit={onSubmit}
      onKeyDown={handleShortcut}
    >
      <div className="iaw-composerHeader">
        <div>
          <p className="iaw-sectionLabel">{label}</p>
          <h2 className="iaw-composerTitle">{title}</h2>
        </div>
        <div className="iaw-composerStats">
          <span>{Math.min(value.length, SUBMISSION_DESCRIPTION_MAX_LENGTH)}</span>
          <span>{moduleCount} governed</span>
        </div>
      </div>

      <div className="iaw-starterList">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            className="iaw-starter"
            onClick={() => {
              onUseStarter(prompt.value);
            }}
          >
            <span className="iaw-starterTitle">{prompt.label}</span>
            {variant === "landing" ? (
              <span className="iaw-starterDetail">{prompt.detail}</span>
            ) : null}
          </button>
        ))}
      </div>

      <textarea
        className="iaw-requestField"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />

      <div className="iaw-composerFooter">
        <button type="submit" className="iaw-primaryButton" disabled={busy || !sessionReady}>
          {primaryLabel}
        </button>
        <p className="iaw-helper">{helperText}</p>
      </div>

      {errorMessage ? (
        <p className="iaw-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
