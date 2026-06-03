const fs = require("fs/promises");
const path = require("path");
const { getDesktopStorageContract } = require("./storageContractBridge.cjs");
const {
  getLocalUserSettings,
  setLocalUserSettings,
} = require("./localSettingsStore.cjs");
const {
  validateLocalUserStoragePath,
} = require("../../server/utils/swarmsy/localUserStorageContract");

const DESKTOP_LOCAL_USER_BACKUP_SCHEMA = "swarmsy_desktop_local_user_backup";
const DESKTOP_LOCAL_USER_BACKUP_VERSION = 1;
const BACKUPS_DIR_NAME = "backups";

const ALLOWED_BACKUP_TOP_LEVEL_KEYS = new Set([
  "schema",
  "version",
  "exportedAt",
  "app",
  "mode",
  "state",
]);

const ALLOWED_BACKUP_STATE_KEYS = new Set(["settings"]);

const FORBIDDEN_BACKUP_KEYS = new Set([
  "authToken",
  "sessionToken",
  "apiKey",
  "pendingHomeMessage",
  "runtimeSessionKey",
  "serverDbPath",
  // add more as needed
]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isIsoDateString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

// Similar validation as in localSettingsStore
function validateBackupDocument(document) {
  const errors = [];
  if (!isPlainObject(document)) {
    return { valid: false, errors: ["backup document must be a plain object."] };
  }

  for (const key of Object.keys(document)) {
    if (!ALLOWED_BACKUP_TOP_LEVEL_KEYS.has(key)) {
      errors.push(`Unknown top-level field "${key}" is not allowed.`);
    }
  }

  if (document.schema !== DESKTOP_LOCAL_USER_BACKUP_SCHEMA) {
    errors.push(`Invalid schema. Expected "${DESKTOP_LOCAL_USER_BACKUP_SCHEMA}".`);
  }

  if (document.version !== DESKTOP_LOCAL_USER_BACKUP_VERSION) {
    errors.push(`Unsupported version. Expected ${DESKTOP_LOCAL_USER_BACKUP_VERSION}.`);
  }

  if (!isIsoDateString(document.exportedAt)) {
    errors.push("exportedAt must be a valid ISO date string.");
  }

  if (!isPlainObject(document.state)) {
    errors.push("state must be a plain object.");
  } else {
    for (const key of Object.keys(document.state)) {
      if (!ALLOWED_BACKUP_STATE_KEYS.has(key)) {
        errors.push(`Unknown state field "${key}" is not allowed.`);
      }
      // further validate settings if present
      if (key === "settings" && document.state[key]) {
        // can reuse or call sanitize from settings
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    backup: document,
  };
}

async function resolveBackupsDirContext(options = {}) {
  const contract = getDesktopStorageContract(options);
  const layout = contract.layout;
  const backupsDir = layout?.paths?.backups;
  if (!backupsDir) {
    throw new Error("Backups path not found in storage contract");
  }
  // similar path safety as in localSettingsStore
  // ... (implement full safety checks like symlink, realpath, assertPathWithinLocalUserRoot)
  await fs.mkdir(backupsDir, { recursive: true });
  return { layout, backupsDir };
}

async function exportLocalUserBackup(options = {}) {
  let context;
  try {
    context = await resolveBackupsDirContext(options);
  } catch (error) {
    return { ok: false, reason: "backup_path_invalid", message: String(error) };
  }

  const settingsResult = await getLocalUserSettings(options);
  if (!settingsResult.ok) {
    return settingsResult;
  }

  const backup = {
    schema: DESKTOP_LOCAL_USER_BACKUP_SCHEMA,
    version: DESKTOP_LOCAL_USER_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "SWARMSY",
    mode: "local_user_desktop",
    state: {
      settings: settingsResult.settings ? settingsResult.settings.state || {} : {},
    }
  };

  const validation = validateBackupDocument(backup);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  // Optionally save to backups dir
  // const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  // const backupPath = path.resolve(context.backupsDir, `backup-${timestamp}.json`);
  // await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));

  return {
    ok: true,
    backup,
  };
}

async function importLocalUserBackup(payload = {}, options = {}) {
  if (!isPlainObject(payload)) {
    return { ok: false, reason: "invalid_payload" };
  }

  const validation = validateBackupDocument(payload);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  // Restore settings only
  const settingsPayload = payload.state?.settings || {};
  const result = await setLocalUserSettings(settingsPayload, options);

  return result.ok ? { ok: true, restored: true } : result;
}

module.exports = {
  DESKTOP_LOCAL_USER_BACKUP_SCHEMA,
  DESKTOP_LOCAL_USER_BACKUP_VERSION,
  exportLocalUserBackup,
  importLocalUserBackup,
  validateBackupDocument,
};
