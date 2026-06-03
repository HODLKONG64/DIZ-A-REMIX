const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const {
  DESKTOP_LOCAL_USER_BACKUP_SCHEMA,
  DESKTOP_LOCAL_USER_BACKUP_VERSION,
  DESKTOP_LOCAL_USER_BACKUP_APP,
  DESKTOP_LOCAL_USER_BACKUP_MODE,
  BACKUP_ALLOWED_SETTINGS_KEYS,
  BACKUP_FORBIDDEN_SETTINGS_KEYS,
  validateLocalUserDesktopBackup,
  exportLocalUserDesktopBackup,
  importLocalUserDesktopBackup,
} = require("../../../desktop/foundation/localBackupStore.cjs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createContractOptions(homeDir) {
  return {
    platform: "linux",
    homeDir,
    env: {
      XDG_CONFIG_HOME: path.posix.join(homeDir, ".xdg"),
    },
  };
}

function validBackup(overrides = {}, stateOverrides = {}, settingsOverrides = {}) {
  return {
    schema: DESKTOP_LOCAL_USER_BACKUP_SCHEMA,
    version: DESKTOP_LOCAL_USER_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: DESKTOP_LOCAL_USER_BACKUP_APP,
    mode: DESKTOP_LOCAL_USER_BACKUP_MODE,
    state: {
      settings: {
        ollamaModel: "llama3.1:8b",
        provider: "ollama",
        ...settingsOverrides,
      },
      ...stateOverrides,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Schema constants
// ---------------------------------------------------------------------------

describe("desktop backup schema constants", () => {
  it("DESKTOP_LOCAL_USER_BACKUP_SCHEMA is the expected identifier", () => {
    expect(DESKTOP_LOCAL_USER_BACKUP_SCHEMA).toBe(
      "swarmsy_desktop_local_user_backup"
    );
  });

  it("DESKTOP_LOCAL_USER_BACKUP_VERSION starts at 1", () => {
    expect(DESKTOP_LOCAL_USER_BACKUP_VERSION).toBe(1);
  });

  it("DESKTOP_LOCAL_USER_BACKUP_APP is SWARMSY", () => {
    expect(DESKTOP_LOCAL_USER_BACKUP_APP).toBe("SWARMSY");
  });

  it("DESKTOP_LOCAL_USER_BACKUP_MODE is local_user_desktop", () => {
    expect(DESKTOP_LOCAL_USER_BACKUP_MODE).toBe("local_user_desktop");
  });

  it("BACKUP_ALLOWED_SETTINGS_KEYS contains ollamaModel and provider", () => {
    expect(BACKUP_ALLOWED_SETTINGS_KEYS.has("ollamaModel")).toBe(true);
    expect(BACKUP_ALLOWED_SETTINGS_KEYS.has("provider")).toBe(true);
  });

  it("BACKUP_FORBIDDEN_SETTINGS_KEYS excludes auth/session/API keys", () => {
    expect(BACKUP_FORBIDDEN_SETTINGS_KEYS.has("authToken")).toBe(true);
    expect(BACKUP_FORBIDDEN_SETTINGS_KEYS.has("sessionToken")).toBe(true);
    expect(BACKUP_FORBIDDEN_SETTINGS_KEYS.has("apiKey")).toBe(true);
    expect(BACKUP_FORBIDDEN_SETTINGS_KEYS.has("pendingHomeMessage")).toBe(true);
    expect(BACKUP_FORBIDDEN_SETTINGS_KEYS.has("runtimeSessionKey")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateLocalUserDesktopBackup
// ---------------------------------------------------------------------------

describe("validateLocalUserDesktopBackup", () => {
  it("accepts a minimal valid backup with only schema/version/exportedAt/state", () => {
    const result = validateLocalUserDesktopBackup({
      schema: DESKTOP_LOCAL_USER_BACKUP_SCHEMA,
      version: DESKTOP_LOCAL_USER_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      state: { settings: { ollamaModel: "phi3:mini" } },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a full valid backup with all fields", () => {
    const result = validateLocalUserDesktopBackup(validBackup());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a backup with empty state.settings", () => {
    const result = validateLocalUserDesktopBackup(validBackup({}, {}, {}));
    expect(result.valid).toBe(true);
  });

  it("accepts a backup without optional app/mode fields", () => {
    const { app: _a, mode: _m, ...rest } = validBackup();
    const result = validateLocalUserDesktopBackup(rest);
    expect(result.valid).toBe(true);
  });

  it("rejects null", () => {
    const result = validateLocalUserDesktopBackup(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/plain object/i);
  });

  it("rejects an array", () => {
    const result = validateLocalUserDesktopBackup([]);
    expect(result.valid).toBe(false);
  });

  it("rejects a string", () => {
    const result = validateLocalUserDesktopBackup("nope");
    expect(result.valid).toBe(false);
  });

  it("rejects wrong schema", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({ schema: "swarmsy_local_user_backup" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /schema/i.test(e))).toBe(true);
  });

  it("rejects wrong version", () => {
    const result = validateLocalUserDesktopBackup(validBackup({ version: 99 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /version/i.test(e))).toBe(true);
  });

  it("rejects missing exportedAt", () => {
    const { exportedAt: _e, ...rest } = validBackup();
    const result = validateLocalUserDesktopBackup(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /exportedAt/i.test(e))).toBe(true);
  });

  it("rejects non-date exportedAt", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({ exportedAt: "not-a-date" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /exportedAt/i.test(e))).toBe(true);
  });

  it("rejects unknown top-level field", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({ unknownTopKey: "x" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /unknownTopKey/i.test(e))).toBe(true);
  });

  it("rejects forbidden top-level field (authToken)", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({ authToken: "secret" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /authToken/i.test(e))).toBe(true);
  });

  it("rejects forbidden top-level field (apiKey)", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({ apiKey: "secret" })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects forbidden top-level field (sessionToken)", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({ sessionToken: "s" })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects forbidden top-level field (serverDbPath)", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({ serverDbPath: "/etc/db" })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects wrong app field", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({ app: "OTHER_APP" })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects wrong mode field", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({ mode: "hosted_admin" })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects non-object state", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({ state: "bad" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /state/i.test(e))).toBe(true);
  });

  it("rejects unknown state field", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({}, { unknownStateField: {} })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /unknownStateField/i.test(e))).toBe(true);
  });

  it("rejects forbidden state field (auth)", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({}, { auth: {} })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /auth/i.test(e))).toBe(true);
  });

  it("rejects forbidden state field (serverDb)", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({}, { serverDb: {} })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects forbidden state field (adminData)", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({}, { adminData: {} })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects unknown settings key inside state.settings", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({}, {}, { unknownSetting: "x" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /unknownSetting/i.test(e))).toBe(true);
  });

  it("rejects forbidden settings key (authToken) inside state.settings", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({}, {}, { authToken: "secret" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /authToken/i.test(e))).toBe(true);
  });

  it("rejects forbidden settings key (apiKey) inside state.settings", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({}, {}, { apiKey: "k" })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects non-object state.settings", () => {
    const result = validateLocalUserDesktopBackup(
      validBackup({}, { settings: "bad" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /state\.settings/i.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// exportLocalUserDesktopBackup (filesystem)
// ---------------------------------------------------------------------------

describe("exportLocalUserDesktopBackup", () => {
  let tmpRoot;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "swarmsy-desktop-backup-export-")
    );
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("creates a backup file in the backups directory with correct schema", async () => {
    const options = { contractOptions: createContractOptions(tmpRoot) };
    const result = await exportLocalUserDesktopBackup(options);

    expect(result.ok).toBe(true);
    expect(result.backup).toBeDefined();
    expect(result.path).toBeDefined();
    expect(result.backup.schema).toBe(DESKTOP_LOCAL_USER_BACKUP_SCHEMA);
    expect(result.backup.version).toBe(DESKTOP_LOCAL_USER_BACKUP_VERSION);
    expect(result.backup.app).toBe(DESKTOP_LOCAL_USER_BACKUP_APP);
    expect(result.backup.mode).toBe(DESKTOP_LOCAL_USER_BACKUP_MODE);
  });

  it("backup exportedAt is a valid ISO date string", async () => {
    const options = { contractOptions: createContractOptions(tmpRoot) };
    const result = await exportLocalUserDesktopBackup(options);
    expect(result.ok).toBe(true);
    expect(typeof result.backup.exportedAt).toBe("string");
    expect(Number.isNaN(Date.parse(result.backup.exportedAt))).toBe(false);
  });

  it("backup state.settings includes only allowlisted keys", async () => {
    const options = { contractOptions: createContractOptions(tmpRoot) };
    const result = await exportLocalUserDesktopBackup(options);

    expect(result.ok).toBe(true);
    const settingsKeys = Object.keys(result.backup.state.settings);
    for (const key of settingsKeys) {
      expect(BACKUP_ALLOWED_SETTINGS_KEYS.has(key)).toBe(true);
    }
  });

  it("backup does not include auth/session/API key fields", async () => {
    const options = { contractOptions: createContractOptions(tmpRoot) };
    const result = await exportLocalUserDesktopBackup(options);

    expect(result.ok).toBe(true);
    const backup = result.backup;
    expect(backup.state.settings.authToken).toBeUndefined();
    expect(backup.state.settings.apiKey).toBeUndefined();
    expect(backup.state.settings.sessionToken).toBeUndefined();
    expect(backup.state.settings.pendingHomeMessage).toBeUndefined();
    expect(backup.state.settings.runtimeSessionKey).toBeUndefined();
  });

  it("backup does not include server DB or hosted/admin paths", async () => {
    const options = { contractOptions: createContractOptions(tmpRoot) };
    const result = await exportLocalUserDesktopBackup(options);

    expect(result.ok).toBe(true);
    const backup = result.backup;
    expect(backup.state.serverDb).toBeUndefined();
    expect(backup.state.adminData).toBeUndefined();
    expect(backup.serverDbPath).toBeUndefined();
  });

  it("backup file is written to the backups directory", async () => {
    const options = { contractOptions: createContractOptions(tmpRoot) };
    const result = await exportLocalUserDesktopBackup(options);

    expect(result.ok).toBe(true);
    const stat = await fs.stat(result.path);
    expect(stat.isFile()).toBe(true);
    const content = await fs.readFile(result.path, "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.schema).toBe(DESKTOP_LOCAL_USER_BACKUP_SCHEMA);
  });

  it("backup file path stays inside Local User root", async () => {
    const {
      getLocalUserStorageLayout,
    } = require("../../../server/utils/swarmsy/localUserStorageContract");
    const layout = getLocalUserStorageLayout(createContractOptions(tmpRoot));
    const options = { contractOptions: createContractOptions(tmpRoot) };
    const result = await exportLocalUserDesktopBackup(options);

    expect(result.ok).toBe(true);
    expect(result.path.startsWith(layout.paths.backups)).toBe(true);
  });

  it("includes ollamaModel and provider from settings file when set", async () => {
    const {
      setLocalUserSettings,
    } = require("../../../desktop/foundation/localSettingsStore.cjs");
    const contractOptions = createContractOptions(tmpRoot);
    await setLocalUserSettings(
      { ollamaModel: "mistral:7b", provider: "ollama" },
      { contractOptions }
    );

    const result = await exportLocalUserDesktopBackup({ contractOptions });
    expect(result.ok).toBe(true);
    expect(result.backup.state.settings.ollamaModel).toBe("mistral:7b");
    expect(result.backup.state.settings.provider).toBe("ollama");
  });

  it("rejects backups directory that is a symlink", async () => {
    const {
      getLocalUserStorageLayout,
    } = require("../../../server/utils/swarmsy/localUserStorageContract");
    const contractOptions = createContractOptions(tmpRoot);
    const layout = getLocalUserStorageLayout(contractOptions);

    // Create backups dir as real dir first, then replace with symlink.
    await fs.mkdir(layout.paths.backups, { recursive: true });
    await fs.rm(layout.paths.backups, { recursive: true });

    const symlinkTarget = await fs.mkdtemp(
      path.join(os.tmpdir(), "swarmsy-symlink-target-")
    );
    await fs.symlink(symlinkTarget, layout.paths.backups);

    const result = await exportLocalUserDesktopBackup({ contractOptions });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/backup_path_invalid/);
    expect(result.message).toMatch(/symlink/i);

    await fs.rm(symlinkTarget, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// importLocalUserDesktopBackup (filesystem)
// ---------------------------------------------------------------------------

describe("importLocalUserDesktopBackup", () => {
  let tmpRoot;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "swarmsy-desktop-backup-import-")
    );
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("imports a valid backup and writes settings to the settings file", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const payload = validBackup(
      {},
      {},
      { ollamaModel: "phi3:mini", provider: "ollama" }
    );

    const result = await importLocalUserDesktopBackup(payload, {
      contractOptions,
    });

    expect(result.ok).toBe(true);
    expect(result.restored).toContain("ollamaModel");
    expect(result.restored).toContain("provider");

    const {
      getLocalUserSettings,
    } = require("../../../desktop/foundation/localSettingsStore.cjs");
    const settings = await getLocalUserSettings({ contractOptions });
    expect(settings.ok).toBe(true);
    expect(settings.settings.state.ollamaModel).toBe("phi3:mini");
    expect(settings.settings.state.provider).toBe("ollama");
  });

  it("restores only allowlisted settings keys", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const payload = validBackup({}, {}, { ollamaModel: "llama3.1:8b" });
    const result = await importLocalUserDesktopBackup(payload, {
      contractOptions,
    });

    expect(result.ok).toBe(true);
    for (const key of result.restored) {
      expect(BACKUP_ALLOWED_SETTINGS_KEYS.has(key)).toBe(true);
    }
  });

  it("returns ok with empty restored list when state.settings has no recognized keys", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const payload = {
      schema: DESKTOP_LOCAL_USER_BACKUP_SCHEMA,
      version: DESKTOP_LOCAL_USER_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      state: { settings: {} },
    };
    const result = await importLocalUserDesktopBackup(payload, {
      contractOptions,
    });
    expect(result.ok).toBe(true);
    expect(result.restored).toHaveLength(0);
  });

  it("skips null/empty settings values without error", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const payload = validBackup({}, {}, { ollamaModel: null });
    const result = await importLocalUserDesktopBackup(payload, {
      contractOptions,
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toContain("ollamaModel");
  });

  it("rejects malformed JSON-like non-object payload", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup("bad string", {
      contractOptions,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("backup_validation_failed");
  });

  it("rejects null payload", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(null, { contractOptions });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("backup_validation_failed");
  });

  it("rejects wrong schema", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(
      validBackup({ schema: "swarmsy_local_user_backup" }),
      { contractOptions }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /schema/i.test(e))).toBe(true);
  });

  it("rejects wrong version", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(
      validBackup({ version: 99 }),
      { contractOptions }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /version/i.test(e))).toBe(true);
  });

  it("rejects unknown top-level fields in payload", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(
      validBackup({ unknownKey: "bad" }),
      { contractOptions }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /unknownKey/i.test(e))).toBe(true);
  });

  it("rejects forbidden top-level field (authToken)", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(
      validBackup({ authToken: "secret" }),
      { contractOptions }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /authToken/i.test(e))).toBe(true);
  });

  it("rejects forbidden top-level field (serverDbPath)", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(
      validBackup({ serverDbPath: "/etc/db" }),
      { contractOptions }
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown settings field in state.settings", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(
      validBackup({}, {}, { unknownField: "x" }),
      { contractOptions }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /unknownField/i.test(e))).toBe(true);
  });

  it("rejects forbidden settings key (authToken) inside state.settings", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(
      validBackup({}, {}, { authToken: "secret" }),
      { contractOptions }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /authToken/i.test(e))).toBe(true);
  });

  it("rejects unknown state field", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(
      validBackup({}, { unknownStateKey: {} }),
      { contractOptions }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /unknownStateKey/i.test(e))).toBe(true);
  });

  it("rejects forbidden state field (auth)", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(
      validBackup({}, { auth: { token: "s" } }),
      { contractOptions }
    );
    expect(result.ok).toBe(false);
  });

  it("rejects forbidden state field (hostedData)", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const result = await importLocalUserDesktopBackup(
      validBackup({}, { hostedData: {} }),
      { contractOptions }
    );
    expect(result.ok).toBe(false);
  });

  it("does not write any settings when validation fails", async () => {
    const {
      getLocalUserSettings,
    } = require("../../../desktop/foundation/localSettingsStore.cjs");
    const contractOptions = createContractOptions(tmpRoot);
    await importLocalUserDesktopBackup(
      validBackup({ authToken: "secret" }),
      { contractOptions }
    );
    const settings = await getLocalUserSettings({ contractOptions });
    expect(settings.ok).toBe(true);
    expect(settings.settings.state).toEqual({});
  });

  it("stale model import still writes settings safely (no silent fallback)", async () => {
    const contractOptions = createContractOptions(tmpRoot);
    const payload = validBackup(
      {},
      {},
      { ollamaModel: "not-installed-model:latest" }
    );
    const result = await importLocalUserDesktopBackup(payload, {
      contractOptions,
    });
    expect(result.ok).toBe(true);
    expect(result.restored).toContain("ollamaModel");

    const {
      getLocalUserSettings,
    } = require("../../../desktop/foundation/localSettingsStore.cjs");
    const settings = await getLocalUserSettings({ contractOptions });
    expect(settings.settings.state.ollamaModel).toBe(
      "not-installed-model:latest"
    );
  });
});

// ---------------------------------------------------------------------------
// Export/import round-trip
// ---------------------------------------------------------------------------

describe("exportLocalUserDesktopBackup → importLocalUserDesktopBackup round-trip", () => {
  let tmpRoot;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "swarmsy-desktop-backup-roundtrip-")
    );
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("restores exported settings after clearing them", async () => {
    const {
      setLocalUserSettings,
      getLocalUserSettings,
      clearLocalUserSettings,
    } = require("../../../desktop/foundation/localSettingsStore.cjs");
    const contractOptions = createContractOptions(tmpRoot);

    await setLocalUserSettings(
      { ollamaModel: "llama3.1:8b", provider: "ollama" },
      { contractOptions }
    );

    const exportResult = await exportLocalUserDesktopBackup({ contractOptions });
    expect(exportResult.ok).toBe(true);

    await clearLocalUserSettings({ contractOptions });

    const importResult = await importLocalUserDesktopBackup(
      exportResult.backup,
      { contractOptions }
    );
    expect(importResult.ok).toBe(true);
    expect(importResult.restored).toContain("ollamaModel");

    const settings = await getLocalUserSettings({ contractOptions });
    expect(settings.settings.state.ollamaModel).toBe("llama3.1:8b");
  });
});
