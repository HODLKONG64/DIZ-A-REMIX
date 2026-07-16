import { useEffect, useState } from "react";
import SwarmsyOnboarding from "@/models/swarmsyOnboarding";
import ProjectBackupPanel from "./ProjectBackupPanel";
import ProjectDashboard from "./ProjectDashboard";
import ProofReviewHistoryPanel from "./ProofReviewHistoryPanel";
import { buildMemoryLockStarterMessage } from "./memoryLock";
import { hasDesktopLocalSettingsBridge } from "./localUserOllamaSelection";

export default function ReturningUserHome({
  workspaceSlug,
  busy = false,
  isLocalUserMode = null,
  onContinueIntake,
  onContinueIdea,
  onShowChoices,
}) {
  const [detectedLocalUserMode, setDetectedLocalUserMode] = useState(
    isLocalUserMode === true
  );

  useEffect(() => {
    if (typeof isLocalUserMode === "boolean") {
      setDetectedLocalUserMode(isLocalUserMode);
      return;
    }

    let cancelled = false;
    SwarmsyOnboarding.localUserOllamaStatus()
      .then((result) => {
        if (cancelled) return;
        setDetectedLocalUserMode(
          result?.mode === "local_user" && result?.source !== "fallback"
        );
      })
      .catch(() => {
        if (!cancelled) setDetectedLocalUserMode(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLocalUserMode]);

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
    detectedLocalUserMode && hasDesktopLocalSettingsBridge();

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
