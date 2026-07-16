import { useRef, useState } from "react";
import {
  CheckCircle,
  DownloadSimple,
  FileArrowUp,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import showToast from "@/utils/toast";
import {
  downloadProjectBackup,
  exportProjectBackup,
  PROJECT_BACKUP_RESTORE_DISABLED,
  projectBackupValidationSummary,
  validateProjectBackup,
} from "./projectBackup";

export default function ProjectBackupPanel({ workspaceSlug, busy = false }) {
  const fileInputRef = useRef(null);
  const [action, setAction] = useState("");
  const [validation, setValidation] = useState(null);

  async function downloadBackup() {
    if (!workspaceSlug || action) return;
    setAction("export");
    const result = await exportProjectBackup(workspaceSlug);
    setAction("");

    if (!result?.success || !result?.backup) {
      showToast(
        result?.message || "SPARKY could not create this project backup.",
        "error"
      );
      return;
    }

    downloadProjectBackup(result.backup);
    showToast("Project backup downloaded.", "success");
  }

  async function validateFile(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file || action) return;

    setAction("validate");
    setValidation(null);
    try {
      const parsed = JSON.parse(await file.text());
      const result = await validateProjectBackup(parsed);
      setValidation(result);
    } catch {
      setValidation({
        success: false,
        valid: false,
        errors: ["This file is not valid JSON."],
        restoreAvailable: false,
      });
    } finally {
      setAction("");
    }
  }

  if (!workspaceSlug) return null;

  const summary = validation?.valid
    ? projectBackupValidationSummary(validation)
    : [];

  return (
    <section
      aria-labelledby="swarmsy-project-backup-title"
      className="rounded-2xl border border-theme-sidebar-border bg-theme-bg-secondary p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
            Local ownership
          </p>
          <h2
            id="swarmsy-project-backup-title"
            className="mt-2 text-xl font-semibold text-theme-text-primary"
          >
            Project Backup
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-theme-text-secondary">
            Download a portable snapshot of your current questions, Identity
            Ideas, Memory Locks and Proof Reviews.
          </p>
          <p className="mt-2 text-xs leading-5 text-theme-text-secondary">
            {PROJECT_BACKUP_RESTORE_DISABLED}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || Boolean(action)}
            onClick={downloadBackup}
            className="flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {action === "export" ? (
              <SpinnerGap size={18} className="animate-spin" />
            ) : (
              <DownloadSimple size={18} />
            )}
            Download backup
          </button>
          <button
            type="button"
            disabled={busy || Boolean(action)}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {action === "validate" ? (
              <SpinnerGap size={18} className="animate-spin" />
            ) : (
              <FileArrowUp size={18} />
            )}
            Check a backup file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json,.swarmsy-backup.json"
            onChange={validateFile}
            className="hidden"
          />
        </div>
      </div>

      {validation && (
        <div
          className={`mt-5 rounded-xl border p-4 ${
            validation.valid
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          <div className="flex items-start gap-3">
            {validation.valid ? (
              <CheckCircle
                size={22}
                weight="fill"
                className="mt-0.5 text-emerald-400"
              />
            ) : (
              <WarningCircle
                size={22}
                weight="fill"
                className="mt-0.5 text-amber-400"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-theme-text-primary">
                {validation.valid
                  ? "Backup file is valid"
                  : "Backup file needs attention"}
              </h3>
              {validation.valid ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {summary.map(([label, count]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-theme-sidebar-border bg-theme-bg-primary px-3 py-2"
                    >
                      <p className="text-xs text-theme-text-secondary">
                        {label}
                      </p>
                      <p className="mt-1 font-semibold text-theme-text-primary">
                        {count}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-theme-text-secondary">
                  {(validation.errors || ["Unknown validation error."]).map(
                    (error) => (
                      <li key={error}>{error}</li>
                    )
                  )}
                </ul>
              )}
              <p className="mt-3 text-xs text-theme-text-secondary">
                No workspace data was changed.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
