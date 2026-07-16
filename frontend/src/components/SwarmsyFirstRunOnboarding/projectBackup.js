import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

export const PROJECT_BACKUP_RESTORE_DISABLED =
  "Restore is not enabled yet. Validation and planning do not change your workspace.";

async function parseResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (response.ok) return data;
  return {
    success: false,
    ...data,
    message: data?.message || fallbackMessage,
  };
}

export async function exportProjectBackup(workspaceSlug) {
  return await fetch(
    `${API_BASE}/swarmsy/workspaces/${encodeURIComponent(
      workspaceSlug
    )}/project-backup/export`,
    { headers: baseHeaders() }
  )
    .then((response) =>
      parseResponse(response, "Failed to create the SWARMSY project export.")
    )
    .catch(() => ({
      success: false,
      backup: null,
      message: "Failed to create the SWARMSY project export.",
    }));
}

export async function validateProjectBackup(backup) {
  return await fetch(`${API_BASE}/swarmsy/project-backup/validate`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({ backup }),
  })
    .then((response) =>
      parseResponse(response, "Failed to validate the SWARMSY project backup.")
    )
    .catch(() => ({
      success: false,
      valid: false,
      errors: ["Failed to validate the SWARMSY project backup."],
      restoreAvailable: false,
    }));
}

export async function planProjectBackupRestore(workspaceSlug, backup) {
  return await fetch(
    `${API_BASE}/swarmsy/workspaces/${encodeURIComponent(
      workspaceSlug
    )}/project-backup/restore-plan`,
    {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ backup }),
    }
  )
    .then((response) =>
      parseResponse(response, "Failed to create the project restore plan.")
    )
    .catch(() => ({
      success: false,
      valid: false,
      restoreApplied: false,
      restoreAvailable: false,
      message: "Failed to create the project restore plan.",
    }));
}

export function projectBackupFilename(backup) {
  const slug = String(backup?.workspace?.slug || "swarmsy-project")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = String(backup?.exportedAt || "").slice(0, 10) || "backup";
  return `${slug || "swarmsy-project"}-${date}.swarmsy-backup.json`;
}

export function downloadProjectBackup(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = projectBackupFilename(backup);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function projectBackupValidationSummary(validation) {
  const counts = validation?.summary?.counts || {};
  return [
    ["Intake Sessions", counts.intakeSessions || 0],
    ["Identity Ideas", counts.identityIdeas || 0],
    ["Memory Locks", counts.memoryLocks || 0],
    ["Proof Reviews", counts.proofReviews || 0],
  ];
}

export function projectBackupRestorePlanSummary(plan) {
  const summary = plan?.summary || {};
  return [
    ["Would add", summary.create || 0],
    ["Exact duplicates", summary.skipDuplicate || 0],
    ["Conflicts", summary.conflicts || 0],
  ];
}

export function projectBackupRestoreConflicts(plan) {
  const sections = plan?.sections || {};
  return Object.entries(sections).flatMap(([section, details]) =>
    (details?.conflicts || []).map((conflict) => ({
      section,
      ...conflict,
    }))
  );
}
