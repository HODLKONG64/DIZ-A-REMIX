const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const {
  DESKTOP_LOCAL_USER_SETTINGS_SCHEMA,
  DESKTOP_LOCAL_USER_SETTINGS_VERSION,
  LOCAL_SETTINGS_FILENAME,
  resolveSettingsFileContext,
  getLocalUserSettings,
  setLocalUserSettings,
} = require("../../../desktop/foundation/localSettingsStore.cjs");

function createContractOptions(homeDir) {
  return {
    platform: "linux",
    homeDir,
    env: {
      XDG_CONFIG_HOME: path.join(homeDir, ".xdg"),
    },
  };
}

describe("desktop local settings store", () => {
  let tmpRoot;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "swarmsy-desktop-settings-"));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("creates and uses a settings file path under layout.paths.settings", async () => {
    const context = await resolveSettingsFileContext({
      contractOptions: createContractOptions(tmpRoot),
    });

    expect(context.settingsFilePath).toBe(
      path.join(context.layout.paths.settings, LOCAL_SETTINGS_FILENAME)
    );

    const writeResult = await setLocalUserSettings(
      { ollamaModel: "llama3.1:8b", provider: "ollama" },
      { contractOptions: createContractOptions(tmpRoot) }
    );
    expect(writeResult.ok).toBe(true);
    expect(writeResult.path.startsWith(context.layout.paths.settings)).toBe(true);
  });

  it("returns safe empty/default state when settings file is missing", async () => {
    const result = await getLocalUserSettings({
      contractOptions: createContractOptions(tmpRoot),
    });
    expect(result.ok).toBe(true);
    expect(result.settings).toEqual(
      expect.objectContaining({
        schema: DESKTOP_LOCAL_USER_SETTINGS_SCHEMA,
        version: DESKTOP_LOCAL_USER_SETTINGS_VERSION,
        state: {},
      })
    );
  });

  it("reads a valid settings file", async () => {
    await setLocalUserSettings(
      { ollamaModel: "phi3:mini", provider: "ollama" },
      { contractOptions: createContractOptions(tmpRoot) }
    );

    const result = await getLocalUserSettings({
      contractOptions: createContractOptions(tmpRoot),
    });

    expect(result.ok).toBe(true);
    expect(result.settings.state).toEqual({
      ollamaModel: "phi3:mini",
      provider: "ollama",
    });
  });

  it("rejects malformed JSON safely", async () => {
    const context = await resolveSettingsFileContext({
      contractOptions: createContractOptions(tmpRoot),
    });
    await fs.writeFile(context.settingsFilePath, "{bad-json", "utf8");

    const result = await getLocalUserSettings({
      contractOptions: createContractOptions(tmpRoot),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("settings_parse_error");
  });

  it("rejects wrong schema/version safely", async () => {
    const context = await resolveSettingsFileContext({
      contractOptions: createContractOptions(tmpRoot),
    });
    await fs.writeFile(
      context.settingsFilePath,
      JSON.stringify({
        schema: "bad_schema",
        version: 999,
        updatedAt: new Date().toISOString(),
        state: {},
      }),
      "utf8"
    );

    const result = await getLocalUserSettings({
      contractOptions: createContractOptions(tmpRoot),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("settings_validation_error");
  });

  it("rejects forbidden fields", async () => {
    const result = await setLocalUserSettings(
      { ollamaModel: "llama3.1:8b", authToken: "secret-token" },
      { contractOptions: createContractOptions(tmpRoot) }
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("settings_validation_error");
  });

  it("rejects writes when settings directory is a symlink escape", async () => {
    const context = await resolveSettingsFileContext({
      contractOptions: createContractOptions(tmpRoot),
    });
    const escapedDir = path.join(tmpRoot, "outside-root");
    await fs.mkdir(escapedDir, { recursive: true });
    await fs.rm(context.layout.paths.settings, { recursive: true, force: true });
    await fs.symlink(escapedDir, context.layout.paths.settings);

    const result = await setLocalUserSettings(
      { ollamaModel: "llama3.1:8b" },
      { contractOptions: createContractOptions(tmpRoot) }
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("settings_path_invalid");
  });
});
