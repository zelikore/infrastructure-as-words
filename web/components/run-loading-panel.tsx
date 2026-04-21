"use client";

import { useEffect, useMemo, useState } from "react";

type PendingRun = {
  submissionId: string;
  createdAt: string;
  description: string;
  summary?: string | undefined;
};

type RunLoadingPanelProps = {
  submission: PendingRun;
  averageDurationMs: number;
};

const formatSeconds = (value: number): string => `${Math.max(0, Math.ceil(value / 1000))}s`;

const loadingSteps = [
  "Rules and module priority",
  "Bedrock architecture pass",
  "Terraform assembly",
  "Diagram and artifact save"
] as const;

export function RunLoadingPanel({ submission, averageDurationMs }: RunLoadingPanelProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const elapsedMs = Math.max(0, now - Date.parse(submission.createdAt));
  const progress = Math.min(elapsedMs / averageDurationMs, 0.92);
  const activeStep = Math.min(
    loadingSteps.length - 1,
    Math.floor(progress * loadingSteps.length)
  );
  const remainingMs = averageDurationMs - elapsedMs;
  const timingLabel =
    remainingMs > 0
      ? `${formatSeconds(remainingMs)} remaining on average`
      : "Taking longer than the current average";

  const progressPercent = useMemo(() => Math.round(progress * 100), [progress]);

  return (
    <section className="iaw-runLoading iaw-surface">
      <div className="iaw-runLoadingHeader">
        <div>
          <p className="iaw-sectionLabel">Generating</p>
          <h1 className="iaw-consoleTitle">{submission.summary ?? "Preparing your run"}</h1>
        </div>
        <span className="iaw-status iaw-statusPending">Running</span>
      </div>

      <div className="iaw-runLoadingRail">
        <div className="iaw-runLoadingBar" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="iaw-runLoadingMeta">
          <span>{timingLabel}</span>
          <span>{progressPercent}%</span>
        </div>
      </div>

      <div className="iaw-runLoadingGrid">
        <div className="iaw-runLoadingCard">
          <span className="iaw-fieldLabel">Request</span>
          <p className="iaw-runLoadingPrompt">{submission.description}</p>
        </div>

        <div className="iaw-runLoadingCard">
          <span className="iaw-fieldLabel">Backend flow</span>
          <div className="iaw-runStepList">
            {loadingSteps.map((step, index) => (
              <div
                key={step}
                className={`iaw-runStep ${index <= activeStep ? "iaw-runStepActive" : ""}`}
              >
                <span className="iaw-runStepIndex">{index + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
