const DESKTOP_DIAGNOSTIC_ENTRIES = [
  {
    code: "selected_model_stale",
    title: "Selected Ollama model is no longer installed.",
    message:
      "The saved Local User Ollama model is missing from the current Ollama model list. Select an installed model to continue.",
    action:
      "Open Local User settings, choose an installed Ollama model, and save it.",
  },
  {
    code: "local_provider_unavailable",
    title: "Local Ollama provider is unavailable.",
    message:
      "SWARMSY could not reach the local Ollama provider required for Local User mode.",
    action:
      "Start Ollama, confirm it is reachable, and retry the Local User status check.",
  },
  {
    code: "selected_model_not_ready",
    title: "Selected Ollama model is not ready yet.",
    message:
      "The selected Local User Ollama model is saved, but SWARMSY has not confirmed it is ready for chat.",
    action:
      "Wait for Ollama status to refresh, or select a different installed model.",
  },
  {
    code: "model_restore_failed",
    title: "Backup model selection could not be restored.",
    message:
      "SWARMSY imported the backup, but the saved Local User Ollama model could not be restored safely.",
    action:
      "Select an installed Ollama model in Local User settings and save the selection.",
  },
  {
    code: "backup_file_symlink_rejected",
    title: "Backup file was rejected because it is unsafe.",
    message:
      "The desktop backup bridge rejected a backup file path that resolves to a symlink or unsafe file target.",
    action:
      "Choose a normal backup file in the SWARMSY backups directory and try again.",
  },
  {
    code: "backup_directory_invalid",
    title: "Backup directory is invalid.",
    message:
      "The desktop backup bridge could not resolve a safe Local User backup directory.",
    action:
      "Restart the desktop app and retry the backup operation from Local User settings.",
  },
  {
    code: "backup_import_failed",
    title: "Backup import failed.",
    message:
      "The selected Local User backup could not be parsed or validated by the desktop backup bridge.",
    action: "Choose a valid SWARMSY Local User backup file and try again.",
  },
  {
    code: "backup_export_failed",
    title: "Backup export failed.",
    message:
      "The desktop backup bridge could not safely write the Local User backup file.",
    action:
      "Confirm the backups directory is writable, then try exporting again.",
  },
  {
    code: "untrusted_origin",
    title: "Desktop bridge rejected this request.",
    message:
      "The desktop bridge rejected a request from an untrusted browser origin.",
    action: "Use the trusted SWARMSY desktop window and retry the operation.",
  },
];

export const DESKTOP_DIAGNOSTIC_CATALOG = Object.freeze(
  DESKTOP_DIAGNOSTIC_ENTRIES.reduce((catalog, diagnostic) => {
    catalog[diagnostic.code] = Object.freeze({ ...diagnostic });
    return catalog;
  }, {})
);

export const DESKTOP_BRIDGE_REASON_TO_DIAGNOSTIC_CODE = Object.freeze({
  backup_file_symlink: "backup_file_symlink_rejected",
  backup_path_invalid: "backup_directory_invalid",
  backup_parse_failed: "backup_import_failed",
  backup_validation_failed: "backup_import_failed",
  backup_write_failed: "backup_export_failed",
  backup_settings_invalid: "backup_export_failed",
  backup_file_unsafe: "backup_file_symlink_rejected",
  untrusted_origin: "untrusted_origin",
});

function normalizeDiagnosticCode(code = "") {
  return String(code || "").trim();
}

export function getDiagnosticForCode(code = "") {
  const normalizedCode = normalizeDiagnosticCode(code);
  const diagnostic = DESKTOP_DIAGNOSTIC_CATALOG[normalizedCode];
  return diagnostic ? { ...diagnostic } : null;
}

export function diagnosticFromResult(result = null, fallbackCode = null) {
  const reason = normalizeDiagnosticCode(result?.reason);
  const mappedCode = DESKTOP_BRIDGE_REASON_TO_DIAGNOSTIC_CODE[reason] || reason;
  const diagnostic = getDiagnosticForCode(mappedCode);
  if (diagnostic) return diagnostic;
  if (fallbackCode) return getDiagnosticForCode(fallbackCode);
  return null;
}
