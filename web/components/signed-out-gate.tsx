type SignedOutGateProps = {
  sessionReady: boolean;
  onSignIn: () => void;
};

const lockedOutputs = [
  "Prompt",
  "Diagram",
  "Zip",
  "History"
] as const;

export function SignedOutGate({ sessionReady, onSignIn }: SignedOutGateProps) {
  return (
    <section className="iaw-gatePanel iaw-surface">
      <div className="iaw-gateHeader">
        <div>
          <p className="iaw-sectionLabel">Access</p>
          <h2 className="iaw-composerTitle">Open the workspace.</h2>
        </div>
        <span className="iaw-gateBadge">Locked</span>
      </div>

      <div className="iaw-gateVisual" aria-hidden="true">
        <div className="iaw-gateLock">
          <span className="iaw-gateLockShackle" />
          <span className="iaw-gateLockBody" />
        </div>
        <div className="iaw-gateBars">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="iaw-gateOutputs" aria-label="Workspace features">
        {lockedOutputs.map((item) => (
          <div key={item} className="iaw-gateOutput">
            <span className="iaw-gateDot" aria-hidden="true" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="iaw-landingActions">
        <button
          type="button"
          className="iaw-primaryButton"
          disabled={!sessionReady}
          onClick={onSignIn}
        >
          Sign in
        </button>
        <p className="iaw-helper">Sign in to generate and review runs.</p>
      </div>
    </section>
  );
}
