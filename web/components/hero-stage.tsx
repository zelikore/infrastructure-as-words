type HeroStageProps = {
  mode: "landing" | "workspace";
  request: string;
  submissionCount: number;
  selectedStatus: "pending" | "completed" | "failed" | undefined;
  moduleCount: number;
  artifactReady: boolean;
};

const compactRequest = (value: string): string => {
  const compact = value.trim().replace(/\s+/g, " ");
  if (!compact) {
    return "No draft";
  }

  return compact.length > 42 ? `${compact.slice(0, 42)}…` : compact;
};

const statusLabel = (value: HeroStageProps["selectedStatus"]): string => {
  if (value === "completed") {
    return "ready";
  }
  if (value === "failed") {
    return "review";
  }
  if (value === "pending") {
    return "active";
  }
  return "idle";
};

export function HeroStage({
  mode,
  request,
  submissionCount,
  selectedStatus,
  moduleCount,
  artifactReady
}: HeroStageProps) {
  const status = statusLabel(selectedStatus);
  const inputLabel = mode === "landing" ? "Prompt" : "Draft";
  const outputLabel = mode === "landing" ? "Artifacts" : "Artifact";
  const outputValue = artifactReady ? "Zip" : mode === "landing" ? "Diagram + zip" : "Run";

  return (
    <div className={`iaw-stage ${mode === "landing" ? "iaw-stageLanding" : "iaw-stageWorkspace"}`} aria-hidden="true">
      <div className="iaw-stageShell">
        <div className="iaw-stageHalo iaw-stageHaloA" />
        <div className="iaw-stageHalo iaw-stageHaloB" />
        <div className="iaw-stageConstellation" />
        <div className="iaw-stageOrbit iaw-stageOrbitA" />
        <div className="iaw-stageOrbit iaw-stageOrbitB" />
        <div className="iaw-stageBeam iaw-stageBeamA" />
        <div className="iaw-stageBeam iaw-stageBeamB" />

        <div className="iaw-stageNode iaw-stageNodeInput">
          <span className="iaw-stageLabel">{inputLabel}</span>
          <p className="iaw-stageValue">{compactRequest(request)}</p>
        </div>

        <div className="iaw-stageCore">
          <span className="iaw-stageLabel">Bedrock</span>
          <div className="iaw-stageBars">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="iaw-stageNode iaw-stageNodeOutput">
          <span className="iaw-stageLabel">{outputLabel}</span>
          <p className="iaw-stageValue">{outputValue}</p>
        </div>

        <span className="iaw-stageChip iaw-stageChipA">
          {mode === "landing" ? "policy" : `mods ${moduleCount}`}
        </span>
        <span className="iaw-stageChip iaw-stageChipB">
          {mode === "landing" ? "diagram" : `runs ${submissionCount}`}
        </span>
        <span className="iaw-stageChip iaw-stageChipC">{status}</span>
        <span className="iaw-stageChip iaw-stageChipD">
          {mode === "landing" ? `mods ${moduleCount}` : artifactReady ? "zip" : "queue"}
        </span>
      </div>
    </div>
  );
}
