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
const FORBIDDEN_MANIFEST_FIELD_PATTERN =
  /(token|secret|api[_-]?key|auth|session|credential)/i;

function isPathInsideRoot(candidatePath, rootPath) {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative !== "" &&
    relative !== "." &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  );
}

function normalizeRoot(rootPath = "") {
  return path.resolve(String(rootPath || "").trim());
}

function getLocalUserDataRoot({
  platform = process.platform,
  env = process.env,
  homeDir = os.homedir(),
} = {}) {
  const normalizedHome = normalizeRoot(homeDir);

  if (platform === "win32") {
    const appData = String(env?.APPDATA || "").trim();
    const base = appData ? normalizeRoot(appData) : path.join(normalizedHome, "AppData", "Roaming");
    return path.join(base, LOCAL_USER_APP_NAME);
  }

  if (platform === "darwin") {
    return path.join(normalizedHome, "Library", "Application Support", LOCAL_USER_APP_NAME);
  }

  if (platform === "linux") {
    const xdgConfigHome = String(env?.XDG_CONFIG_HOME || "").trim();
    const base = xdgConfigHome ? normalizeRoot(xdgConfigHome) : path.join(normalizedHome, ".config");
    return path.join(base, "swarmsy");
  }

  return path.join(normalizedHome, ".config", "swarmsy");
}

function getLocalUserStorageLayout(options = {}) {
  const root = getLocalUserDataRoot(options);
  const paths = {};

  for (const [key, segment] of Object.entries(STORAGE_LAYOUT_SEGMENTS)) {
    paths[key] = path.join(root, segment);
  }

  return {
    app: LOCAL_USER_APP_NAME,
    mode: LOCAL_USER_STORAGE_MODE,
    root,
    paths,
  };
}

function validateLocalUserStoragePath(candidatePath, { layout } = {}) {
  if (!candidatePath || typeof candidatePath !== "string") {
    return { valid: false, reason: "Storage path must be a non-empty string." };
  }

  const resolvedCandidate = normalizeRoot(candidatePath);
  const resolvedLayout = layout || getLocalUserStorageLayout();
  const resolvedRoot = normalizeRoot(resolvedLayout.root);

  if (resolvedCandidate === resolvedRoot) {
    return { valid: true, reason: null };
  }

  if (!isPathInsideRoot(resolvedCandidate, resolvedRoot)) {
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
  const manifestPaths = {};
  for (const key of REQUIRED_PATH_KEYS) {
    manifestPaths[key] = layout.paths?.[key] || path.join(layout.root, STORAGE_LAYOUT_SEGMENTS[key]);
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

  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { valid: false, errors: ["Manifest must be a plain object."] };
  }

  if (manifest.schema !== LOCAL_USER_STORAGE_SCHEMA) {
    errors.push(
      `Invalid schema \"${manifest.schema}\". Expected \"${LOCAL_USER_STORAGE_SCHEMA}\".`
    );
  }

  if (manifest.version !== LOCAL_USER_STORAGE_VERSION) {
    errors.push(
      `Unsupported manifest version \"${manifest.version}\". Expected ${LOCAL_USER_STORAGE_VERSION}.`
    );
  }

  if (manifest.app !== LOCAL_USER_APP_NAME) {
    errors.push(`Invalid app \"${manifest.app}\". Expected \"${LOCAL_USER_APP_NAME}\".`);
  }

  if (manifest.mode !== LOCAL_USER_STORAGE_MODE) {
    errors.push(
      `Invalid mode \"${manifest.mode}\". Expected \"${LOCAL_USER_STORAGE_MODE}\".`
    );
  }

  if (typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt))) {
    errors.push("createdAt must be a valid ISO date string.");
  }

  if (typeof manifest.updatedAt !== "string" || Number.isNaN(Date.parse(manifest.updatedAt))) {
    errors.push("updatedAt must be a valid ISO date string.");
  }

  if (manifest.paths === null || typeof manifest.paths !== "object" || Array.isArray(manifest.paths)) {
    errors.push("paths must be a plain object.");
  } else {
    const contractLayout = layout || getLocalUserStorageLayout();

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

  for (const topLevelKey of Object.keys(manifest)) {
    if (topLevelKey === "paths") continue;
    if (FORBIDDEN_MANIFEST_FIELD_PATTERN.test(topLevelKey)) {
      errors.push(`Forbidden manifest field \"${topLevelKey}\" is not allowed.`);
    }
  }

  if (manifest.paths && typeof manifest.paths === "object" && !Array.isArray(manifest.paths)) {
    for (const key of Object.keys(manifest.paths)) {
      if (FORBIDDEN_MANIFEST_FIELD_PATTERN.test(key)) {
        errors.push(`Forbidden path key \"${key}\" is not allowed.`);
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
  FORBIDDEN_MANIFEST_FIELD_PATTERN,
  getLocalUserDataRoot,
  getLocalUserStorageLayout,
  validateLocalUserStoragePath,
  createLocalUserStorageManifest,
  validateLocalUserStorageManifest,
};
