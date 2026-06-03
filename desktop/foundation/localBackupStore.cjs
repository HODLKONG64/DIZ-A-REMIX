const fs = require("fs/promises");
const path = require("path");
const { getDesktopStorageContract } = require("./storageContractBridge.cjs");
const {
  validateLocalUserStoragePath,
} = require("../../server/utils/swarmsy/localUserStorageContract");
const {
  getLocalUserSettings,
  setLocalUserSettings,
  ALLOWED_STATE_KEYS,
  FORBIDDEN_STATE_KEYS,
} = require("./localSettingsStore.cjs");

const DESKTOP_LOCAL_USER_BACKUP_SCHEMA = "swarmsy_desktop_local_user_backup";
const DESKTOP_LOCAL_USER_BACKUP_VERSION = 1;
const DESKTOP_LOCAL_USER_BACKUP_APP = "SWARMSY";
const DESKTOP_LOCAL_USER_BACKUP_MODE = "local_user_desktop";

const BACKUP_FILENAME_PREFIX = "swarmsy-desktop-local-user-backup-";

const BACKUP_ALLOWED_TOP_LEVEL_KEYS = new Set([
  "schema",
  "version",
  "exportedAt",
  "app",
  "mode",
  "state",
]);

const BACKUP_ALLOWED_STATE_KEYS = new Set(["settings"]);

// Settings keys allowed inside state.settings — reuses allowlist from localSettingsStore.
// ALLOWED_STATE_KEYS is a Set: { "ollamaModel", "provider" }
const BACKUP_ALLOWED_SETTINGS_KEYS = ALLOWED_STATE_KEYS;

// Keys that are explicitly forbidden — reuses denylist from localSettingsStore.
const BACKUP_FORBIDDEN_SETTINGS_KEYS = FORBIDDEN_STATE_KEYS;

// Additional forbidden top-level and state fields to block hosted/server paths.
const BACKUP_FORBIDDEN_TOP_LEVEL_KEYS = new Set([
  "authToken",
  "apiKey",
  "apiKeys",
  "sessionToken",
  "serverDbPath",
  "runtimeSessionKey",
  "pendingHomeMessage",
]);
const BACKUP_FORBIDDEN_STATE_TOP_LEVEL_KEYS = new Set([
  "auth",
  "session",
  "serverDb",
  "adminData",
  "hostedData",
]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertPathWithinLocalUserRoot(
  targetPath,
  layout,
  { allowRoot = false } = {}
) {
  const validation = validateLocalUserStoragePath(targetPath, {
    layout,
    allowRoot,
  });
  if (!validation.valid) {
    throw new Error(
      validation.reason || "Path is outside SWARMSY Local User root."
    );
  }
}

async function resolveBackupDirectoryContext({
  fsApi = fs,
  pathApi = path,
  contractOptions = {},
} = {}) {
  const contract = getDesktopStorageContract(contractOptions);
  const layout = contract.layout;
  const backupsDir = layout?.paths?.backups;

  if (!backupsDir) {
    throw new Error("Local User storage layout missing backups path.");
  }

  assertPathWithinLocalUserRoot(layout.root, layout, { allowRoot: true });
  assertPathWithinLocalUserRoot(backupsDir, layout);

  await fsApi.mkdir(backupsDir, { recursive: true });

  const backupsDirStats = await fsApi.lstat(backupsDir);
  if (backupsDirStats.isSymbolicLink()) {
    throw new Error("Backups directory cannot be a symlink.");
  }

  const realBackupsDir = await fsApi.realpath(backupsDir);
  assertPathWithinLocalUserRoot(realBackupsDir, layout);

  return { layout, backupsDir };
}

function buildBackupFilename() {
  const datePart = new Date().toISOString().slice(0, 10);
  const entropy = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${BACKUP_FILENAME_PREFIX}${datePart}-${entropy}.json`;
}

function buildBackupObject(settingsState = {}) {
  const state = {};

  for (const key of BACKUP_ALLOWED_SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(settingsState, key)) {
      const value = settingsState[key];
      state[key] = typeof value === "string" ? value : null;
    }
  }

  return {
    schema: DESKTOP_LOCAL_USER_BACKUP_SCHEMA,
    version: DESKTOP_LOCAL_USER_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: DESKTOP_LOCAL_USER_BACKUP_APP,
    mode: DESKTOP_LOCAL_USER_BACKUP_MODE,
    state: { settings: state },
  };
}

/**
 * Validate a parsed desktop Local User backup object.
 *
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLocalUserDesktopBackup(data) {
  const errors = [];

  if (!isPlainObject(data)) {
    return { valid: false, errors: ["Backup must be a plain object."] };
  }

  for (const key of Object.keys(data)) {
    if (BACKUP_FORBIDDEN_TOP_LEVEL_KEYS.has(key)) {
      errors.push(`Forbidden top-level field "${key}" is not allowed.`);
    } else if (!BACKUP_ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      errors.push(`Unknown top-level field "${key}" is not allowed.`);
    }
  }

  if (data.schema !== DESKTOP_LOCAL_USER_BACKUP_SCHEMA) {
    errors.push(
      `Invalid schema "${data.schema}". Expected "${DESKTOP_LOCAL_USER_BACKUP_SCHEMA}".`
    );
  }

  if (data.version !== DESKTOP_LOCAL_USER_BACKUP_VERSION) {
    errors.push(
      `Unsupported backup version "${data.version}". Expected ${DESKTOP_LOCAL_USER_BACKUP_VERSION}.`
    );
  }

  if (
    typeof data.exportedAt !== "string" ||
    Number.isNaN(Date.parse(data.exportedAt))
  ) {
    errors.push("exportedAt must be a valid ISO date string.");
  }

  if (data.app !== undefined && data.app !== DESKTOP_LOCAL_USER_BACKUP_APP) {
    errors.push(
      `Invalid app "${data.app}". Expected "${DESKTOP_LOCAL_USER_BACKUP_APP}".`
    );
  }

  if (
    data.mode !== undefined &&
    data.mode !== DESKTOP_LOCAL_USER_BACKUP_MODE
  ) {
    errors.push(
      `Invalid mode "${data.mode}". Expected "${DESKTOP_LOCAL_USER_BACKUP_MODE}".`
    );
  }

  if (!isPlainObject(data.state)) {
    errors.push("Backup state must be a plain object.");
    return { valid: errors.length === 0, errors };
  }

  for (const key of Object.keys(data.state)) {
    if (BACKUP_FORBIDDEN_STATE_TOP_LEVEL_KEYS.has(key)) {
      errors.push(`Forbidden state field "${key}" is not allowed.`);
    } else if (!BACKUP_ALLOWED_STATE_KEYS.has(key)) {
      errors.push(`Unknown state field "${key}" is not allowed.`);
    }
  }

  if (data.state.settings !== undefined) {
    if (!isPlainObject(data.state.settings)) {
      errors.push("state.settings must be a plain object.");
    } else {
      for (const key of Object.keys(data.state.settings)) {
        if (BACKUP_FORBIDDEN_SETTINGS_KEYS.has(key)) {
          errors.push(
            `Forbidden settings field "${key}" is not allowed in backup.`
          );
        } else if (!BACKUP_ALLOWED_SETTINGS_KEYS.has(key)) {
          errors.push(
            `Unknown settings field "${key}" is not allowed in backup.`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Export a desktop Local User backup.
 *
 * Reads current settings from the local settings file and builds a versioned
 * backup object. Also writes a backup file to the Local User backups directory.
 *
 * The renderer must not pass file paths — the main process controls the backup
 * path entirely.
 *
 * @param {{ contractOptions?: object, fsApi?: object, pathApi?: object }} [options]
 * @returns {Promise<{ ok: boolean, backup?: object, path?: string, reason?: string, message?: string }>}
 */
async function exportLocalUserDesktopBackup(options = {}) {
  let backupDirContext;
  try {
    backupDirContext = await resolveBackupDirectoryContext(options);
  } catch (error) {
    return {
      ok: false,
      reason: "backup_path_invalid",
      message: String(
        error?.message || error || "Invalid backup directory path."
      ),
    };
  }

  const settingsResult = await getLocalUserSettings(options);
  const settingsState =
    settingsResult?.ok && settingsResult?.settings?.state
      ? settingsResult.settings.state
      : {};

  const backup = buildBackupObject(settingsState);

  const fsApi = options.fsApi || fs;
  const pathApi = options.pathApi || path;
  const backupFilename = buildBackupFilename();
  const backupFilePath = pathApi.resolve(
    backupDirContext.backupsDir,
    backupFilename
  );

  assertPathWithinLocalUserRoot(backupFilePath, backupDirContext.layout);

  try {
    const existingStats = await fsApi.lstat(backupFilePath).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (existingStats) {
      throw new Error("Backup output file already exists.");
    }

    await fsApi.writeFile(
      backupFilePath,
      `${JSON.stringify(backup, null, 2)}\n`,
      "utf8"
    );

    const writtenStats = await fsApi.lstat(backupFilePath);
    if (writtenStats.isSymbolicLink()) {
      await fsApi.unlink(backupFilePath).catch(() => {});
      throw new Error("Backup output file cannot be a symlink.");
    }

    return { ok: true, backup, path: backupFilePath };
  } catch (error) {
    return {
      ok: false,
      reason: "backup_write_failed",
      message: String(
        error?.message || error || "Failed to write desktop backup file."
      ),
    };
  }
}

/**
 * Import a desktop Local User backup payload.
 *
 * The renderer passes the full parsed backup object (not a file path).
 * The main process validates and writes allowed settings via localSettingsStore.
 *
 * @param {unknown} payload - Parsed backup JSON object from renderer.
 * @param {{ contractOptions?: object, fsApi?: object, pathApi?: object }} [options]
 * @returns {Promise<{ ok: boolean, restored?: string[], skipped?: string[], errors?: string[], reason?: string, message?: string }>}
 */
async function importLocalUserDesktopBackup(payload, options = {}) {
  const { valid, errors } = validateLocalUserDesktopBackup(payload);
  if (!valid) {
    return { ok: false, reason: "backup_validation_failed", errors };
  }

  const settingsInput =
    isPlainObject(payload?.state?.settings) ? payload.state.settings : {};

  const restored = [];
  const skipped = [];
  const allowedSettingsToWrite = {};

  for (const key of BACKUP_ALLOWED_SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(settingsInput, key)) {
      const value = settingsInput[key];
      if (value === null || value === undefined) {
        skipped.push(key);
      } else if (typeof value === "string" && value.trim()) {
        allowedSettingsToWrite[key] = value.trim();
        restored.push(key);
      } else {
        skipped.push(key);
      }
    } else {
      skipped.push(key);
    }
  }

  if (restored.length === 0) {
    return { ok: true, restored: [], skipped, errors: [] };
  }

  const writeResult = await setLocalUserSettings(
    { state: allowedSettingsToWrite },
    options
  );
  if (!writeResult.ok) {
    return {
      ok: false,
      reason: writeResult.reason || "settings_write_failed",
      message: writeResult.message || "Failed to write restored settings.",
      errors: writeResult.errors || [],
    };
  }

  return { ok: true, restored, skipped, errors: [] };
}

module.exports = {
  DESKTOP_LOCAL_USER_BACKUP_SCHEMA,
  DESKTOP_LOCAL_USER_BACKUP_VERSION,
  DESKTOP_LOCAL_USER_BACKUP_APP,
  DESKTOP_LOCAL_USER_BACKUP_MODE,
  BACKUP_ALLOWED_TOP_LEVEL_KEYS,
  BACKUP_ALLOWED_STATE_KEYS,
  BACKUP_ALLOWED_SETTINGS_KEYS,
  BACKUP_FORBIDDEN_SETTINGS_KEYS,
  validateLocalUserDesktopBackup,
  exportLocalUserDesktopBackup,
  importLocalUserDesktopBackup,
};
