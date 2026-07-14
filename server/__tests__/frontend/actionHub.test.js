const fs = require("fs");
const path = require("path");
const vm = require("vm");

function readFrontendModule(relativePath) {
  return fs
    .readFileSync(
      path.resolve(__dirname, "../../../frontend/src", relativePath),
      "utf8"
    )
    .replace(/import\s*{[\s\S]*?}\s*from\s*".*?";\r?\n/g, "")
    .replace(/import .* from ".*?";\r?\n/g, "")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
}

function loadActionHubModule() {
  const source = [
    readFrontendModule("components/SwarmsyFirstRunOnboarding/handoff.js"),
    readFrontendModule(
      "components/SwarmsyFirstRunOnboarding/campaignCalendar.js"
    ),
    readFrontendModule("components/SwarmsyFirstRunOnboarding/memoryLock.js"),
    readFrontendModule("components/SwarmsyFirstRunOnboarding/proofTracker.js"),
    readFrontendModule("components/SwarmsyFirstRunOnboarding/actionHub.js"),
  ].join("\n");

  const script = new vm.Script(
    `${source}
module.exports = {
  ACTION_HUB_TITLE,
  ACTION_HUB_HELPER_COPY,
  ACTION_BUSY_MESSAGE,
  ACTION_HUB_GROUPS,
  isActionHubReady,
  getIntakeDisabledMessage,
  getActionHubActionState
};`
  );
  const sandbox = {
    module: { exports: {} },
    exports: {},
  };
  vm.createContext(sandbox);
  script.runInContext(sandbox);
  return sandbox.module.exports;
}

function buildReadyStatus(overrides = {}) {
  return {
    workspace: {
      exists: true,
      ready: true,
      slug: "swarmsy-hive",
      ...overrides.workspace,
    },
    doctrine: {
      statusAvailable: true,
      docsRootAvailable: true,
      requiredMissing: 0,
      requiredNonLoadable: 0,
      ...overrides.doctrine,
    },
  };
}

describe("SWARMSY HIVE action hub", () => {
  it("shows the ready hub structure with all grouped actions", () => {
    const actionHub = loadActionHubModule();
    const readyStatus = buildReadyStatus();
    const state = actionHub.getActionHubActionState({
      status: readyStatus,
      selectedMode: "face",
      busyAction: null,
    });

    expect(actionHub.ACTION_HUB_TITLE).toBe("Your SWARMSY home");
    expect(actionHub.ACTION_HUB_HELPER_COPY).toContain(
      "SPARKY will guide you and remember the work."
    );
    expect(actionHub.ACTION_HUB_GROUPS.map((group) => group.title)).toEqual([
      "Create or improve an identity",
      "Continue saved work",
      "Plan one campaign day",
      "Check proof before posting",
    ]);
    expect(
      actionHub.ACTION_HUB_GROUPS.flatMap((group) => group.actions)
    ).toEqual([
      "New identity",
      "Existing project",
      "Use saved progress",
      "Plan a campaign day",
      "Check my proof",
    ]);
    expect(actionHub.isActionHubReady(readyStatus)).toBe(true);
    expect(state.ready).toBe(true);
    expect(state.actions.startIntake.disabled).toBe(false);
    expect(state.actions.loadMemoryLock.disabled).toBe(false);
    expect(state.actions.campaignCalendar.disabled).toBe(false);
    expect(state.actions.reviewProof.disabled).toBe(false);
  });

  it("uses the same plain labels when no starting choice is selected", () => {
    const actionHub = loadActionHubModule();

    expect(
      actionHub.getIntakeDisabledMessage(buildReadyStatus(), null)
    ).toBe(
      "Choose whether SPARKY should build around you, create a hidden identity, or improve an existing project."
    );
  });

  it("blocks local-user intake without a selected installed Ollama model", () => {
    const actionHub = loadActionHubModule();
    const state = actionHub.getActionHubActionState({
      status: buildReadyStatus(),
      selectedMode: "face",
      busyAction: null,
      runtimeMode: "local_user",
      localOllamaStatus: "reachable",
      selectedLocalOllamaModel: "",
      localOllamaModels: [{ id: "llama3.1:8b" }],
    });

    expect(state.actions.startIntake.disabled).toBe(true);
    expect(state.actions.startIntake.disabledReason).toBe(
      "Select an installed Ollama model before starting intake."
    );
  });

  it("blocks local-user intake when selected model is not in verified model list", () => {
    const actionHub = loadActionHubModule();
    const state = actionHub.getActionHubActionState({
      status: buildReadyStatus(),
      selectedMode: "face",
      busyAction: null,
      runtimeMode: "local_user",
      localOllamaStatus: "reachable",
      selectedLocalOllamaModel: "missing:model",
      localOllamaModels: [{ id: "llama3.1:8b" }],
    });

    expect(state.actions.startIntake.disabled).toBe(true);
    expect(state.actions.startIntake.disabledReason).toBe(
      "Select an installed Ollama model before starting intake."
    );
  });

  it("blocks local-user intake when Ollama model list is not verified yet", () => {
    const actionHub = loadActionHubModule();
    const state = actionHub.getActionHubActionState({
      status: buildReadyStatus(),
      selectedMode: "face",
      busyAction: null,
      runtimeMode: "local_user",
      localOllamaStatus: "checking",
      selectedLocalOllamaModel: "llama3.1:8b",
      localOllamaModels: [{ id: "llama3.1:8b" }],
    });

    expect(state.actions.startIntake.disabled).toBe(true);
    expect(state.actions.startIntake.disabledReason).toBe(
      "Check Local User Mode Ollama status and select an installed model before starting intake."
    );
  });

  it("blocks local-user memory lock continuation without a selected installed Ollama model", () => {
    const actionHub = loadActionHubModule();
    const state = actionHub.getActionHubActionState({
      status: buildReadyStatus(),
      selectedMode: "memory-lock",
      busyAction: null,
      runtimeMode: "local_user",
      localOllamaStatus: "reachable",
      selectedLocalOllamaModel: "",
      localOllamaModels: [{ id: "llama3.1:8b" }],
    });

    expect(state.actions.loadMemoryLock.disabled).toBe(true);
    expect(state.actions.loadMemoryLock.disabledReason).toBe(
      "Select an installed Ollama model before continuing from a memory lock."
    );
  });

  it("blocks local-user memory lock continuation when Ollama model list is not verified yet", () => {
    const actionHub = loadActionHubModule();
    const state = actionHub.getActionHubActionState({
      status: buildReadyStatus(),
      selectedMode: "memory-lock",
      busyAction: null,
      runtimeMode: "local_user",
      localOllamaStatus: "checking",
      selectedLocalOllamaModel: "llama3.1:8b",
      localOllamaModels: [{ id: "llama3.1:8b" }],
    });

    expect(state.actions.loadMemoryLock.disabled).toBe(true);
    expect(state.actions.loadMemoryLock.disabledReason).toBe(
      "Check Local User Mode Ollama status and select an installed model before continuing from a memory lock."
    );
  });

  it("blocks local-user memory lock continuation when selected model is stale or missing from verified installs", () => {
    const actionHub = loadActionHubModule();
    const state = actionHub.getActionHubActionState({
      status: buildReadyStatus(),
      selectedMode: "memory-lock",
      busyAction: null,
      runtimeMode: "local_user",
      localOllamaStatus: "reachable",
      selectedLocalOllamaModel: "stale:model",
      localOllamaModels: [{ id: "llama3.1:8b" }],
    });

    expect(state.actions.loadMemoryLock.disabled).toBe(true);
    expect(state.actions.loadMemoryLock.disabledReason).toBe(
      "Select an installed Ollama model before continuing from a memory lock."
    );
  });

  it("keeps the no-HIVE state in the create flow", () => {
    const actionHub = loadActionHubModule();
    const status = buildReadyStatus({ workspace: { exists: false } });
    const state = actionHub.getActionHubActionState({
      status,
      selectedMode: "face",
      busyAction: null,
    });

    expect(actionHub.isActionHubReady(status)).toBe(false);
    expect(state.ready).toBe(false);
    expect(state.actions.startIntake.disabledReason).toBe(
      "Create your SWARMSY HIVE before starting intake."
    );
    expect(state.actions.loadMemoryLock.disabledReason).toBe(
      "Create and load your SWARMSY HIVE before continuing from a memory lock."
    );
  });

  it("keeps the underloaded state in the load-docs flow", () => {
    const actionHub = loadActionHubModule();
    const status = buildReadyStatus({
      workspace: { ready: false },
      doctrine: { requiredMissing: 1 },
    });
    const state = actionHub.getActionHubActionState({
      status,
      selectedMode: "face",
      busyAction: null,
    });

    expect(actionHub.isActionHubReady(status)).toBe(false);
    expect(state.actions.startIntake.disabledReason).toBe(
      "Load required doctrine docs before starting intake."
    );
    expect(state.actions.campaignCalendar.disabledReason).toBe(
      "Load required doctrine docs before using the campaign calendar."
    );
  });

  it("does not expose ready actions when doctrine is unavailable", () => {
    const actionHub = loadActionHubModule();
    const status = buildReadyStatus({
      doctrine: { statusAvailable: false },
    });
    const state = actionHub.getActionHubActionState({
      status,
      selectedMode: "face",
      busyAction: null,
    });

    expect(actionHub.isActionHubReady(status)).toBe(false);
    expect(state.actions.reviewProof.disabledReason).toBe(
      "Doctrine readiness cannot be confirmed. Check HIVE readiness before reviewing proof."
    );
  });

  it("keeps actions disabled during busy states", () => {
    const actionHub = loadActionHubModule();
    const state = actionHub.getActionHubActionState({
      status: buildReadyStatus(),
      selectedMode: "hidden",
      busyAction: "proof-review",
    });

    expect(state.actions.startIntake.disabled).toBe(true);
    expect(state.actions.loadMemoryLock.disabled).toBe(true);
    expect(state.actions.campaignCalendar.disabled).toBe(true);
    expect(state.actions.reviewProof.disabled).toBe(true);
    expect(state.actions.reviewProof.busy).toBe(true);
    expect(state.actions.startIntake.disabledReason).toBe(
      actionHub.ACTION_BUSY_MESSAGE
    );
  });

  it("only offers SPARKY prompt repair when the preset prompt is available", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("Apply/Repair SPARKY prompt");
    expect(source).toContain("sparkyPromptStatus?.available &&");
    expect(source).toContain("SwarmsyOnboarding.applySparkyPrompt(");
    expect(source).toContain(`workspaceSlug,
      true`);
  });

  it("keeps the Windows desktop artifact workflow relaxed and path-gated", () => {
    const workflow = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../.github/workflows/desktop-artifact-build.yml"
      ),
      "utf8"
    );
    const pathsBlock = workflow.slice(
      workflow.indexOf("    paths:"),
      workflow.indexOf("  workflow_dispatch:")
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(pathsBlock).toContain('"desktop/**"');
    expect(pathsBlock).toContain('"frontend/**"');
    expect(pathsBlock).toContain('"server/**"');
    expect(pathsBlock).toContain('"collector/**"');
    expect(pathsBlock).not.toContain(".nvmrc");
    expect(workflow).toContain(
      "path: desktop/artifacts/swarmsy-desktop-win32-x64.zip"
    );
    expect(workflow).toContain("compression-level: 0");
    expect(workflow).not.toContain(`path: |
            desktop/artifacts/swarmsy-desktop-win32-x64`);
  });

  it("keeps the onboarding model on user-safe routes only", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/models/swarmsyOnboarding.js"
      ),
      "utf8"
    );

    expect(source).toContain("/swarmsy/onboarding/status");
    expect(source).toContain("/swarmsy/onboarding/create-hive");
    expect(source).toContain("/swarmsy/onboarding/ingest-required-docs");
    expect(source).toContain("/swarmsy/local-user/ollama/status");
    expect(source).not.toContain("/admin/");
  });

  it("keeps the main beginner choices plain and free of duplicate saved-work cards", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("ACTION_HUB_TITLE");
    expect(source).toContain("SPARKY helps build your identity.");
    expect(source).toContain("What would you like to do?");
    expect(source).toContain("Start with SPARKY");
    expect(source).toContain('label: "Build around me"');
    expect(source).toContain('label: "Build a hidden identity"');
    expect(source).toContain('label: "Bring in an existing project"');
    expect(source).not.toContain('label: "Load Memory Lock"');
    expect(source).not.toContain("Choose the next command for SPARKY.");
    expect(source).not.toContain("Choose Face Identity Mode");
    expect(source).toContain("SwarmsyLocalUserSettingsHub");
  });

  it("wires abort-safe local-user Ollama sync in onboarding mount effect", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain(
      "const controller = beginLocalUserOllamaRequest();"
    );
    expect(source).toContain(
      "syncLocalUserOllamaStatus({ signal: controller.signal });"
    );
    expect(source).toContain("releaseLocalUserOllamaRequest(controller);");
    expect(source).toContain(
      "if (signal?.aborted || !isLatestLocalUserOllamaRequest(signal))"
    );
    expect(source).toContain("return null;");
  });

  it("uses abort-safe manual refresh with shared ref in checkLocalUserOllama", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("localOllamaRefreshControllerRef");
    expect(source).toContain(
      "const controller = beginLocalUserOllamaRequest();"
    );
    expect(source).toContain("} finally {");
    expect(source).toContain("releaseLocalUserOllamaRequest(controller)");
    expect(source).toContain("!controller.signal.aborted");
  });

  it("guards Local Ollama updates so only the latest request may set state", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("isLatestLocalUserOllamaRequest");
    expect(source).toContain(
      "localOllamaRefreshControllerRef.current?.signal === signal"
    );
    expect(source).toContain("releaseLocalUserOllamaRequest");
  });

  it("clears stale fields when transitioning to checking state", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain('status: "checking"');
    expect(source).toContain("models: [],");
    expect(source).toContain("endpoint: null,");
    expect(source).toContain("message: null,");
  });

  it("trims model.id before falling back to name in normalizeLocalUserModel", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain('const rawId = String(model?.id ?? "").trim();');
    expect(source).toContain("id: rawId || name ||");
  });

  it("normalizeLocalUserOllamaStatus rejects fallback/unknown mode responses", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain('response?.mode !== "local_user"');
    expect(source).toContain('response?.source === "fallback"');
  });

  it("network failure fallback uses mode unknown with source fallback, not local_user", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/models/swarmsyOnboarding.js"
      ),
      "utf8"
    );

    expect(source).toContain('mode: "unknown"');
    expect(source).toContain('source: "fallback"');
    expect(source).not.toMatch(/catch[\s\S]*?mode:\s*"local_user"/);
  });

  it("tracks confirmed local-user mode via hasConfirmedLocalUserModeRef", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("hasConfirmedLocalUserModeRef");
    expect(source).toContain("hasConfirmedLocalUserModeRef.current = true");
    expect(source).toContain("hasConfirmedLocalUserModeRef.current");
  });

  it("persists and restores local-user model selection via dedicated helper", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("readLocalUserOllamaModelSelection");
    expect(source).toContain("resolveLocalUserOllamaModelSelection");
    expect(source).toContain("persistLocalUserOllamaModelSelection");
    expect(source).toContain("stale_missing");
  });

  it("restores create-hive busy state before awaiting the request", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toMatch(
      /async function createHive\(\) \{\s*setBusyAction\("create-hive"\);\s*setLastActionResult\(null\);\s*const result = await SwarmsyOnboarding\.createHive\(\);[\s\S]*setBusyAction\(null\);/m
    );
  });

  it("applies imported backups to live local-user model state immediately when already verified", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain(
      'const browserModelWasRestored = result?.restored?.includes("ollamaModel")'
    );
    expect(source).toContain(
      "const browserRestoredModelId = browserModelWasRestored"
    );
    expect(source).toContain(
      "const importModelState = resolveLocalUserBackupImportModelState({"
    );
    expect(source).toContain(
      "const restoredModelId = importModelState.restoredModelId;"
    );
    expect(source).toContain(
      "if (importModelState.shouldPersistBrowserModel) {"
    );
    expect(source).toContain("importModelState.browserModelIdToPersist");
    expect(source).toContain(
      "if (importModelState.shouldMirrorBrowserModel) {"
    );
    expect(source).toContain("} else if (hasVerifiedLocalOllamaModels) {");
    expect(source).toContain(
      "const importedModelIsInstalled = localOllamaStatus.models.some("
    );
    expect(source).toContain("setSelectedLocalOllamaModel(restoredModelId);");
    expect(source).toContain("IMPORTED_LOCAL_OLLAMA_MODEL_MISSING_MESSAGE");
  });

  it("preserves imported model storage until verification finishes and then refreshes status", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("IMPORTED_LOCAL_OLLAMA_MODEL_PENDING_MESSAGE");
    expect(source).toContain(
      "const controller = beginLocalUserOllamaRequest();"
    );
    expect(source).toContain(
      "await syncLocalUserOllamaStatus({ signal: controller.signal });"
    );
    expect(source).toContain("releaseLocalUserOllamaRequest(controller);");
  });

  it("shows backup controls only in local-user mode", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toMatch(
      /isLocalUserMode && \([\s\S]*SwarmsyLocalUserSettingsHub/
    );
  });

  it("uses a shared onboarding handoff payload builder for chat runtime selection", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("buildOnboardingChatHandoffPayload");
    expect(source).toContain(
      'mode: isLocalUserMode ? "local_user" : "hosted_admin"'
    );
    expect(source).toMatch(
      /function startIntakeForMode\([\s\S]*?const handoffPayload = buildOnboardingChatHandoffPayload\({[\s\S]*?mode: isLocalUserMode \? "local_user" : "hosted_admin",[\s\S]*?model: selectedLocalOllamaModel,[\s\S]*?}\);/m
    );
    expect(source).toMatch(
      /function continueFromMemoryLock\(\)[\s\S]*?const handoffPayload = buildOnboardingChatHandoffPayload\({[\s\S]*?mode: isLocalUserMode \? "local_user" : "hosted_admin",[\s\S]*?model: selectedLocalOllamaModel,[\s\S]*?}\);/m
    );
    expect(source).toMatch(
      /function continueFromSavedLock\(\)[\s\S]*?const handoffPayload = buildOnboardingChatHandoffPayload\({[\s\S]*?mode: isLocalUserMode \? "local_user" : "hosted_admin",[\s\S]*?model: selectedLocalOllamaModel,[\s\S]*?}\);/m
    );
    expect(source).toMatch(
      /\.\.\.handoffPayload,[\s\S]*?workspaceSlug: activeStatus\.workspace\.slug,[\s\S]*?threadSlug: null,/m
    );
    expect(source).not.toContain("getLocalUserOllamaRuntimeSelection");
  });

  it("preserves saved local-user model selection through unverified status states", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain('localOllamaStatus.status === "reachable"');
    expect(source).toContain('localOllamaStatus.status === "no_models"');
    expect(source).toContain("if (!hasVerifiedLocalOllamaModels)");
    expect(source).not.toContain(
      "} else {\n      clearLocalUserOllamaModelSelection();"
    );
  });

  it("fallback before local-user mode confirmed hides the panel; fallback after confirmed keeps panel with error state", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain('response?.source === "fallback"');
    expect(source).toContain("hasConfirmedLocalUserModeRef.current");
    expect(source).toContain('status: "error"');
  });

  it("setup guidance for unreachable only, not for error state", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyLocalUserSettingsHub/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain('localOllamaStatus.status === "unreachable"');
    expect(source).not.toMatch(
      /localOllamaStatus\.status === "unreachable"[\s\S]*?localOllamaStatus\.status === "error"[\s\S]*?LOCAL_OLLAMA_SETUP_GUIDANCE/
    );
    expect(source).not.toMatch(
      /\(localOllamaStatus\.status === "unreachable" \|\|\s*localOllamaStatus\.status === "error"\)/
    );
  });

  it("exposes Local User Settings Hub in chat settings menu", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/index.jsx"
      ),
      "utf8"
    );
    expect(source).toContain("LocalUserSettingsHubRow");
    expect(source).toContain(
      "const [showLocalUserSettingsHub, setShowLocalUserSettingsHub]"
    );
    expect(source).toContain("setShowMenu(false);");
    expect(source).toContain("setShowLocalUserSettingsHub(true);");
    expect(source).toContain("<LocalUserSettingsHubModal");
    expect(source).toContain("if (!isOpen) return null;");
    expect(source).toContain(
      "const localUserSettingsHubController = useLocalUserSettingsHub();"
    );
  });

  it("mounts Local User controller only while chat settings modal is open", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/index.jsx"
      ),
      "utf8"
    );
    const lazyMountGateIndex = source.indexOf("if (!isOpen) return null;");
    const hookMountIndex = source.indexOf(
      "const localUserSettingsHubController = useLocalUserSettingsHub();"
    );
    expect(lazyMountGateIndex).toBeGreaterThan(-1);
    expect(hookMountIndex).toBeGreaterThan(lazyMountGateIndex);
  });

  it("keeps Local User Settings Hub row as an entrypoint only (no row-local modal state)", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/LocalUserSettingsHubRow.jsx"
      ),
      "utf8"
    );
    expect(source).toContain("onOpen?.()");
    expect(source).toContain("<button");
    expect(source).toContain('type="button"');
    expect(source).not.toContain("useState(");
    expect(source).not.toContain("ModalWrapper");
  });

  it("resets chat-settings menu and Local User modal state on route navigation", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/index.jsx"
      ),
      "utf8"
    );
    expect(source).toContain("useLocation");
    expect(source).toContain("setShowLocalUserSettingsHub(false);");
    expect(source).toContain("}, [location.pathname]);");
  });

  it("shows hosted/admin boundary copy in Local User Settings Hub", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyLocalUserSettingsHub/index.jsx"
      ),
      "utf8"
    );
    expect(source).toContain(
      "Local User Mode is not active in this hosted/admin environment."
    );
    expect(source).toMatch(
      /browser-side SWARMSY Local User settings[\s\S]*only/
    );
  });

  it("surfaces read-only Local Image Engine status in Local User Settings Hub", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyLocalUserSettingsHub/index.jsx"
      ),
      "utf8"
    );
    const hookSource = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyLocalUserSettingsHub/useLocalUserSettingsHub.js"
      ),
      "utf8"
    );

    expect(source).toContain("Local Image Engine");
    expect(source).toContain("Connected");
    expect(source).toContain("Not connected");
    expect(source).toContain("Engine: {safeLocalImageEngineStatus.engine");
    expect(source).toContain("Current ComfyUI URL:");
    expect(source).toContain("Configured by:");
    expect(source).toContain(
      "This hosted app cannot see ComfyUI running on your home PC."
    );
    expect(source).toContain("Start ComfyUI locally at http://localhost:8188.");
    expect(source).toContain("Check image engine");
    expect(hookSource).toContain("SwarmsyOnboarding.hostedImageEngineStatus");
    expect(hookSource).toContain(
      "SwarmsyOnboarding.localUserImageEngineStatus"
    );
    expect(hookSource).toContain("isHostedAdminMode");
    expect(hookSource).toContain('url: "http://localhost:8188"');
  });

  it("wires first-run Local Image Engine checks instead of exposing a no-op action", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyLocalUserSettingsHub/index.jsx"
      ),
      "utf8"
    );
    const onboardingSource = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("const safeLocalImageEngineStatus =");
    expect(source).toContain(
      "Local image engine status has not been checked yet."
    );
    expect(source).toContain("const safeCheckLocalImageEngine =");
    expect(source).toContain('typeof checkLocalImageEngine === "function"');
    expect(source).toContain("onClick={safeCheckLocalImageEngine}");
    expect(source).not.toContain("localImageEngineStatus.available");
    expect(onboardingSource).toContain(
      "SwarmsyOnboarding.localUserImageEngineStatus"
    );
    expect(onboardingSource).toContain("isCheckingLocalImageEngine,");
    expect(onboardingSource).toContain("localImageEngineStatus,");
    expect(onboardingSource).toContain("checkLocalImageEngine,");
    expect(onboardingSource).not.toContain("checkLocalImageEngine: () => {}");
  });

  it("shows the desktop first-run wizard button only when the desktop bridge exists", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyLocalUserSettingsHub/index.jsx"
      ),
      "utf8"
    );
    expect(source).toContain("hasDesktopLocalSettingsBridge");
    expect(source).toContain("const hasTrustedDesktopBridge =");
    expect(source).toContain("{hasTrustedDesktopBridge && (");
    expect(source).toContain("First-run wizard");
  });

  it("renders model placeholder when selection is empty even with one installed model", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyLocalUserSettingsHub/index.jsx"
      ),
      "utf8"
    );
    expect(source).toMatch(
      /\(localOllamaStatus\.models\.length > 1 \|\|\s*!selectedLocalOllamaModel\) &&/
    );
    expect(source).not.toContain("localOllamaStatus.models.length > 1 && (");
  });

  it("avoids Local User status fetches in hosted/admin mode", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyLocalUserSettingsHub/useLocalUserSettingsHub.js"
      ),
      "utf8"
    );
    expect(source).toContain("const isLoginModePending = loginMode === null");
    expect(source).toContain('const isHostedAdminMode = loginMode === "multi"');
    expect(source).toContain(
      "if (isLoginModePending || isHostedAdminMode) return;"
    );
    expect(source).toContain("if (isLoginModePending) {");
    expect(source).toContain("if (isHostedAdminMode) {");
  });

  it("keeps onboarding and settings hub synchronized via shared local-user settings sync event", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyLocalUserSettingsHub/useLocalUserSettingsHub.js"
      ),
      "utf8"
    );
    expect(source).toContain("dispatchLocalUserSettingsSync({");
    expect(source).toContain('reason: "model_selection"');
    expect(source).toContain('reason: "backup_import"');
    expect(source).toContain("function syncFromBroadcast(event) {");
    expect(source).toContain(
      "const hasEventModel = Object.prototype.hasOwnProperty.call("
    );
    expect(source).toContain(
      "window.addEventListener(LOCAL_USER_SETTINGS_SYNC_EVENT"
    );
    expect(source).toContain("window.removeEventListener(");
  });

  it("uses declared onboarding dependencies for local-user sync event effect", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );
    expect(source).toContain(
      "}, [localOllamaStatus.status, localOllamaStatus.models]);"
    );
    expect(source).not.toContain(
      "}, [hasVerifiedLocalOllamaModels, localOllamaStatus.models]);"
    );
  });

  it("includes saved Memory Lock history state in the action hub component", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("const [savedLocks, setSavedLocks]");
    expect(source).toContain("const [savedLocksLoading, setSavedLocksLoading]");
    expect(source).toContain("const [selectedLockId, setSelectedLockId]");
  });

  it("includes loadSavedLocks that calls memoryLocks and selects the active/newest lock", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("async function loadSavedLocks()");
    expect(source).toContain("SwarmsyOnboarding.memoryLocks(workspaceSlug)");
    expect(source).toContain("const activeLock = result.locks.find(");
    expect(source).toContain(
      "const defaultLock = activeLock || result.locks[0]"
    );
    expect(source).toContain("setSelectedLockId(defaultLock?.id ?? null)");
    expect(source).toContain("setSavedLocksLoading(true)");
    expect(source).toContain("setSavedLocksLoading(false)");
  });

  it("includes a Refresh control that triggers loadSavedLocks in the Memory Lock panel", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain('aria-label="Refresh saved Memory Locks"');
    expect(source).toContain("Refresh");
    expect(source).toContain("onClick={loadSavedLocks}");
  });

  it("includes continueFromSavedLock that fetches lock detail and builds the starter message", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("async function continueFromSavedLock()");
    expect(source).toContain(
      "SwarmsyOnboarding.memoryLock(\n      workspaceSlug,\n      selectedLockId\n    )"
    );
    expect(source).toContain(
      "buildMemoryLockStarterMessage(result.lock.content, {"
    );
    expect(source).toContain("lock: result.lock,");
    expect(source).toContain("Continue from saved lock");
    expect(source).toContain("onClick={continueFromSavedLock}");
  });

  it("includes runtime handoff in continueFromSavedLock for local-user ollama selection", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    const fnStart = source.indexOf("async function continueFromSavedLock()");
    const fnEnd = source.indexOf(
      "\n  async function saveMemoryLockAsActive",
      fnStart
    );
    const fnSource = source.slice(fnStart, fnEnd);

    expect(fnSource).toContain("buildOnboardingChatHandoffPayload");
    expect(fnSource).toContain(
      'mode: isLocalUserMode ? "local_user" : "hosted_admin"'
    );
    expect(fnSource).not.toContain("getLocalUserOllamaRuntimeSelection");
  });

  it("includes saveMemoryLockAsActive that calls importMemoryLock for pasted content", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("async function saveMemoryLockAsActive()");
    expect(source).toContain(
      "SwarmsyOnboarding.importMemoryLock(\n      workspaceSlug,\n      memoryLockInput\n    )"
    );
    expect(source).toContain("Save as active lock");
    expect(source).toContain("onClick={saveMemoryLockAsActive}");
  });

  it("preserves the existing paste-to-chat continue flow alongside the new controls", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("Continue from Memory Lock");
    expect(source).toContain("onClick={continueFromMemoryLock}");
    expect(source).toContain(
      'placeholder="Paste your SWARMSY memory lock here."'
    );
  });

  it("shows MEMORY_LOCK_EMPTY_ERROR when saving an empty paste as an active lock", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain(
      "if (!memoryLockInput.trim()) {\n      setMemoryLockError(MEMORY_LOCK_EMPTY_ERROR);"
    );
  });

  it("resets saved lock state when the Memory Lock panel is closed or becomes unavailable", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toMatch(
      /closeMemoryLockPanel[\s\S]{0,300}setSavedLocks\(\[\]\)/
    );
    expect(source).toMatch(
      /closeMemoryLockPanel[\s\S]{0,300}setSavedLocksLoading\(false\)/
    );
    expect(source).toMatch(
      /closeMemoryLockPanel[\s\S]{0,300}setSelectedLockId\(null\)/
    );
  });

  it("blocks local-user memory lock continuation without a selected installed Ollama model", () => {
    const actionHub = loadActionHubModule();
    const state = actionHub.getActionHubActionState({
      status: buildReadyStatus(),
      selectedMode: "face",
      busyAction: null,
      runtimeMode: "local_user",
      localOllamaStatus: "reachable",
      selectedLocalOllamaModel: "",
      localOllamaModels: [{ id: "llama3.1:8b" }],
    });

    expect(state.actions.loadMemoryLock.disabled).toBe(true);
    expect(state.actions.loadMemoryLock.disabledReason).toBe(
      "Select an installed Ollama model before continuing from a memory lock."
    );
  });

  it("blocks local-user memory lock continuation while Ollama status is unverified", () => {
    const actionHub = loadActionHubModule();
    const state = actionHub.getActionHubActionState({
      status: buildReadyStatus(),
      selectedMode: "face",
      busyAction: null,
      runtimeMode: "local_user",
      localOllamaStatus: "checking",
      selectedLocalOllamaModel: "llama3.1:8b",
      localOllamaModels: [{ id: "llama3.1:8b" }],
    });

    expect(state.actions.loadMemoryLock.disabled).toBe(true);
    expect(state.actions.loadMemoryLock.disabledReason).toBe(
      "Check Local User Mode Ollama status and select an installed model before continuing from a memory lock."
    );
  });

  it("blocks local-user memory lock continuation when selected model is stale or not installed", () => {
    const actionHub = loadActionHubModule();
    const state = actionHub.getActionHubActionState({
      status: buildReadyStatus(),
      selectedMode: "face",
      busyAction: null,
      runtimeMode: "local_user",
      localOllamaStatus: "reachable",
      selectedLocalOllamaModel: "stale:model",
      localOllamaModels: [{ id: "llama3.1:8b" }],
    });

    expect(state.actions.loadMemoryLock.disabled).toBe(true);
    expect(state.actions.loadMemoryLock.disabledReason).toBe(
      "Select an installed Ollama model before continuing from a memory lock."
    );
  });

  it("continueFromSavedLock uses buildOnboardingChatHandoffPayload for the handoff payload", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    const fnStart = source.indexOf("async function continueFromSavedLock()");
    const fnEnd = source.indexOf(
      "\n  async function saveMemoryLockAsActive",
      fnStart
    );
    const fnSource = source.slice(fnStart, fnEnd);

    expect(fnSource).toContain("buildOnboardingChatHandoffPayload");
    expect(fnSource).toContain(
      "actionHubState.actions.loadMemoryLock.disabledReason"
    );
  });

  it("pasted memory lock continueFromMemoryLock uses buildOnboardingChatHandoffPayload and checks disabledReason", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    const fnStart = source.indexOf("function continueFromMemoryLock()");
    const fnEnd = source.indexOf("\n  function createCampaignDay()", fnStart);
    const fnSource = source.slice(fnStart, fnEnd);

    expect(fnSource).toContain("buildOnboardingChatHandoffPayload");
    expect(fnSource).toContain(
      "actionHubState.actions.loadMemoryLock.disabledReason"
    );
    expect(fnSource).not.toContain("getLocalUserOllamaRuntimeSelection");
  });

  it("offers a plain-language WTF or SAFE choice without blocking intake", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("How hard should SPARKY push?");
    expect(source).toContain(
      "Choose now, or SPARKY will ask after your questions."
    );
    expect(source).toContain("CREATIVE_INTENSITY_OPTIONS.map");
    expect(source).toContain("aria-pressed");
    expect(source).toContain("Ask me later");
    expect(source).toContain("Clear choice — ask me later");
    expect(source).not.toMatch(
      /selectedCreativeIntensity\s*&&\s*\(\s*<button[\s\S]{0,500}Ask me later/
    );
    expect(source).toContain("creativeIntensity: selectedCreativeIntensity");
  });
});
