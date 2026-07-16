import ProjectBackupPanel from "./ProjectBackupPanel";
import ProjectDashboard from "./ProjectDashboard";
import ProofReviewHistoryPanel from "./ProofReviewHistoryPanel";
import { buildMemoryLockStarterMessage } from "./memoryLock";
import { hasDesktopLocalSettingsBridge } from "./localUserOllamaSelection";

export default function ReturningUserHome({
  workspaceSlug,
  busy = false,
  isLocalUserMode = false,
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

  const canUseLocalProjectBackup =
    isLocalUserMode && hasDesktopLocalSettingsBridge();

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

      {canUseLocalProjectBackup && (
        <ProjectBackupPanel workspaceSlug={workspaceSlug} busy={busy} />
      )}

      <ProofReviewHistoryPanel
        workspaceSlug={workspaceSlug}
        busy={busy}
        onContinueWithSparky={(message) => onContinueIdea?.(message)}
      />
    </div>
  );
}
