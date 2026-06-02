const os = require("os");
const path = require("path");

const LOCAL_USER_STORAGE_SCHEMA = "swarmsy_local_user_storage_manifest";
const LOCAL_USER_STORAGE_VERSION = 1;
const LOCAL_USER_STORAGE_MODE = "local_user";
const LOCAL_USER_APP_NAME = "SWARMSY";

const STORAGE_LAYOUT_SEGMENTS = Object.freeze({
  profile: "profile",
  settings: "settings",
  hives: "hives",
  chats: "chats",
  uploads: "uploads",
  memoryLocks: "memory-locks",
  backups: "backups",
  logs: "logs",
  runtime: "runtime",
  temp: "temp",
});

const REQUIRED_PATH_KEYS = Object.freeze(Object.keys(STORAGE_LAYOUT_SEGMENTS));
const REQUIRED_PATH_KEYS_SET = new Set(REQUIRED_PATH_KEYS);

const MANIFEST_ALLOWED_TOP_LEVEL_KEYS = new Set([
  "schema",
  "version",
  "createdAt",
  "updatedAt",
  "app",
  "mode",
  "paths",
]);

function getPathModule(platform = process.platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function isPathInsideRoot(candidatePath, rootPath, pathModule) {
  const relative = pathModule.relative(rootPath, candidatePath);
  const parentPrefix = `..${pathModule.sep}`;
  return (
    relative !== "" &&
    relative !== "." &&
    relative !== ".." &&
    !relative.startsWith(parentPrefix) &&
    !pathModule.isAbsolute(relative)
  );
}

function normalizeRoot(rootPath = "", platform = process.platform) {
  const cleaned = String(rootPath || "").trim();
  return getPathModule(platform).resolve(cleaned);
}

function getLocalUserDataRoot({
  platform = process.platform,
  env = process.env,
  homeDir = os.homedir(),
} = {}) {
  const pathModule = getPathModule(platform);
  const normalizedHome = normalizeRoot(homeDir, platform);

  if (platform === "win32") {
    const appData = String(env?.APPDATA || "").trim();
    const base = appData
      ? normalizeRoot(appData, platform)
      : pathModule.join(normalizedHome, "AppData", "Roaming");
    return pathModule.join(base, LOCAL_USER_APP_NAME);
  }

  if (platform === "darwin") {
    return pathModule.join(
      normalizedHome,
      "Library",
      "Application Support",
      LOCAL_USER_APP_NAME
    );
  }

  if (platform === "linux") {
    const xdgConfigHome = String(env?.XDG_CONFIG_HOME || "").trim();
    const base = xdgConfigHome
      ? normalizeRoot(xdgConfigHome, platform)
      : pathModule.join(normalizedHome, ".config");
    return pathModule.join(base, "swarmsy");
  }

  return pathModule.join(normalizedHome, ".config", "swarmsy");
}

function getLocalUserStorageLayout(options = {}) {
  const root = getLocalUserDataRoot(options);
  const pathModule = getPathModule(options.platform);
  const paths = {};

  for (const [key, segment] of Object.entries(STORAGE_LAYOUT_SEGMENTS)) {
    paths[key] = pathModule.join(root, segment);
  }

  return {
    app: LOCAL_USER_APP_NAME,
    mode: LOCAL_USER_STORAGE_MODE,
    platform: options.platform || process.platform,
    root,
    paths,
  };
}

function validateLocalUserStoragePath(
  candidatePath,
  { layout, allowRoot = false } = {}
) {
  if (!candidatePath || typeof candidatePath !== "string") {
    return { valid: false, reason: "Storage path must be a non-empty string." };
  }

  const resolvedLayout = layout || getLocalUserStorageLayout();
  if (!resolvedLayout?.root || typeof resolvedLayout.root !== "string") {
    return {
      valid: false,
      reason: "Storage layout root must be a non-empty string.",
    };
  }
  const platform = resolvedLayout.platform || process.platform;
  const pathModule = getPathModule(platform);
  const resolvedCandidate = normalizeRoot(candidatePath, platform);
  const resolvedRoot = normalizeRoot(resolvedLayout.root, platform);

  if (resolvedCandidate === resolvedRoot && allowRoot) {
    return { valid: true, reason: null };
  }

  if (!isPathInsideRoot(resolvedCandidate, resolvedRoot, pathModule)) {
    return {
      valid: false,
      reason: "Storage path must stay inside the SWARMSY Local User data root.",
    };
  }

  return { valid: true, reason: null };
}

function createLocalUserStorageManifest({
  layout = getLocalUserStorageLayout(),
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
} = {}) {
  const pathModule = getPathModule(layout.platform);
  const manifestPaths = {};
  for (const key of REQUIRED_PATH_KEYS) {
    manifestPaths[key] =
      layout.paths?.[key] ||
      pathModule.join(layout.root, STORAGE_LAYOUT_SEGMENTS[key]);
  }

  return {
    schema: LOCAL_USER_STORAGE_SCHEMA,
    version: LOCAL_USER_STORAGE_VERSION,
    createdAt,
    updatedAt,
    app: LOCAL_USER_APP_NAME,
    mode: LOCAL_USER_STORAGE_MODE,
    paths: manifestPaths,
  };
}

function validateLocalUserStorageManifest(manifest, { layout } = {}) {
  const errors = [];

  if (
    manifest === null ||
    typeof manifest !== "object" ||
    Array.isArray(manifest)
  ) {
    return { valid: false, errors: ["Manifest must be a plain object."] };
  }

  for (const topLevelKey of Object.keys(manifest)) {
    if (!MANIFEST_ALLOWED_TOP_LEVEL_KEYS.has(topLevelKey)) {
      errors.push(`Unknown manifest field "${topLevelKey}" is not allowed.`);
    }
  }

  if (manifest.schema !== LOCAL_USER_STORAGE_SCHEMA) {
    errors.push(
      `Invalid schema "${manifest.schema}". Expected "${LOCAL_USER_STORAGE_SCHEMA}".`
    );
  }

  if (manifest.version !== LOCAL_USER_STORAGE_VERSION) {
    errors.push(
      `Unsupported manifest version "${manifest.version}". Expected ${LOCAL_USER_STORAGE_VERSION}.`
    );
  }

  if (manifest.app !== LOCAL_USER_APP_NAME) {
    errors.push(
      `Invalid app "${manifest.app}". Expected "${LOCAL_USER_APP_NAME}".`
    );
  }

  if (manifest.mode !== LOCAL_USER_STORAGE_MODE) {
    errors.push(
      `Invalid mode "${manifest.mode}". Expected "${LOCAL_USER_STORAGE_MODE}".`
    );
  }

  if (
    typeof manifest.createdAt !== "string" ||
    Number.isNaN(Date.parse(manifest.createdAt))
  ) {
    errors.push("createdAt must be a valid ISO date string.");
  }

  if (
    typeof manifest.updatedAt !== "string" ||
    Number.isNaN(Date.parse(manifest.updatedAt))
  ) {
    errors.push("updatedAt must be a valid ISO date string.");
  }

  if (
    manifest.paths === null ||
    typeof manifest.paths !== "object" ||
    Array.isArray(manifest.paths)
  ) {
    errors.push("paths must be a plain object.");
  } else {
    const contractLayout = layout || getLocalUserStorageLayout();
    if (!contractLayout?.root || typeof contractLayout.root !== "string") {
      errors.push("Storage layout root must be a non-empty string.");
      return { valid: false, errors };
    }

    for (const key of Object.keys(manifest.paths)) {
      if (!REQUIRED_PATH_KEYS_SET.has(key)) {
        errors.push(`Unknown paths key "${key}" is not allowed.`);
      }
    }

    for (const key of REQUIRED_PATH_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(manifest.paths, key)) {
        errors.push(`Missing required paths.${key}.`);
        continue;
      }

      const candidatePath = manifest.paths[key];
      const pathValidation = validateLocalUserStoragePath(candidatePath, {
        layout: contractLayout,
      });
      if (!pathValidation.valid) {
        errors.push(`Invalid paths.${key}: ${pathValidation.reason}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  LOCAL_USER_STORAGE_SCHEMA,
  LOCAL_USER_STORAGE_VERSION,
  LOCAL_USER_STORAGE_MODE,
  LOCAL_USER_APP_NAME,
  STORAGE_LAYOUT_SEGMENTS,
  REQUIRED_PATH_KEYS,
  REQUIRED_PATH_KEYS_SET,
  MANIFEST_ALLOWED_TOP_LEVEL_KEYS,
  getLocalUserDataRoot,
  getLocalUserStorageLayout,
  validateLocalUserStoragePath,
  createLocalUserStorageManifest,
  validateLocalUserStorageManifest,
};
