import ProjectDashboard from "./ProjectDashboard";
import ProofReviewHistoryPanel from "./ProofReviewHistoryPanel";

export default function ReturningUserHome({
  workspaceSlug,
  busy = false,
  onContinueIntake,
  onContinueIdea,
  onShowChoices,
}) {
  if (!workspaceSlug) return null;

  return (
    <div className="space-y-4">
      <ProjectDashboard
        workspaceSlug={workspaceSlug}
        busy={busy}
        onContinueIntake={onContinueIntake}
        onContinueIdea={onContinueIdea}
        onContinueMemoryLock={onShowChoices}
        onShowChoices={onShowChoices}
      />

      <ProofReviewHistoryPanel
        workspaceSlug={workspaceSlug}
        busy={busy}
        onContinueWithSparky={(message) => onContinueIdea?.(message)}
      />
    </div>
  );
}
