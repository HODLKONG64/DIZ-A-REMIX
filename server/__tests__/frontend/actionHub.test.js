const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

async function loadActionHubModule() {
  const modulePath = path.resolve(
    __dirname,
    "../../../frontend/src/components/SwarmsyFirstRunOnboarding/actionHub.js"
  );

  return import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);
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
  it("shows the ready hub structure with all grouped actions", async () => {
    const actionHub = await loadActionHubModule();
    const readyStatus = buildReadyStatus();
    const state = actionHub.getActionHubActionState({
      status: readyStatus,
      selectedMode: "face",
      busyAction: null,
    });

    expect(actionHub.ACTION_HUB_TITLE).toBe("SWARMSY HIVE Action Hub");
    expect(actionHub.ACTION_HUB_HELPER_COPY).toContain(
      "Choose the next command for SPARKY."
    );
    expect(actionHub.ACTION_HUB_GROUPS.map((group) => group.title)).toEqual([
      "Build",
      "Continue",
      "Launch",
      "Verify",
    ]);
    expect(
      actionHub.ACTION_HUB_GROUPS.flatMap((group) => group.actions)
    ).toEqual([
      "Start Intake",
      "Existing Project",
      "Load Memory Lock",
      "Campaign Calendar",
      "Review Proof / Find Proof Gaps",
    ]);
    expect(actionHub.isActionHubReady(readyStatus)).toBe(true);
    expect(state.ready).toBe(true);
    expect(state.actions.startIntake.disabled).toBe(false);
    expect(state.actions.loadMemoryLock.disabled).toBe(false);
    expect(state.actions.campaignCalendar.disabled).toBe(false);
    expect(state.actions.reviewProof.disabled).toBe(false);
  });

  it("keeps the no-HIVE state in the create flow", async () => {
    const actionHub = await loadActionHubModule();
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

  it("keeps the underloaded state in the load-docs flow", async () => {
    const actionHub = await loadActionHubModule();
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

  it("does not expose ready actions when doctrine is unavailable", async () => {
    const actionHub = await loadActionHubModule();
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

  it("keeps actions disabled during busy states", async () => {
    const actionHub = await loadActionHubModule();
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
    expect(source).not.toContain("/admin/");
  });

  it("includes action hub copy in the onboarding component", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("SWARMSY HIVE Action Hub");
    expect(source).toContain("Choose the next command for SPARKY.");
  });
});
