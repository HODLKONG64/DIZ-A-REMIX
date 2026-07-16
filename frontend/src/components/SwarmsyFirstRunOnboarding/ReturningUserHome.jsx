import ProjectBackupPanel from "./ProjectBackupPanel";
import ProjectDashboard from "./ProjectDashboard";
import ProofReviewHistoryPanel from "./ProofReviewHistoryPanel";
import { buildMemoryLockStarterMessage } from "./memoryLock";

export default function ReturningUserHome({
  workspaceSlug,
  busy = false,
  onContinueIntake,
  onContinueIdea,
  onShowChoices,
}) {
  if (!workspaceSlug) return null;

  function continueMemoryLock(lock) {
    const message = buildMemoryLockStarterMessage(lock?.content, { lock });
    if (!message) {
      onShowChoices?.();
      return;
    }
    onContinueIdea?.(message);
  }

  return (
    <div className="space-y-4">
      <ProjectDashboard
        workspaceSlug={workspaceSlug}
        busy={busy}
        onContinueIntake={onContinueIntake}
        onContinueIdea={onContinueIdea}
        onContinueMemoryLock={continueMemoryLock}
        onShowChoices={onShowChoices}
      />

      <ProjectBackupPanel workspaceSlug={workspaceSlug} busy={busy} />

      <ProofReviewHistoryPanel
        workspaceSlug={workspaceSlug}
        busy={busy}
        onContinueWithSparky={(message) => onContinueIdea?.(message)}
      />
    </div>
  );
}
