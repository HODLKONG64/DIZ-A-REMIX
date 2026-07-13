const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadFrontendHelpers(relativePath, exportedNames) {
  const source = fs
    .readFileSync(
      path.resolve(__dirname, `../../../frontend/src/${relativePath}`),
      "utf8"
    )
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ")
    .concat(`\nmodule.exports = { ${exportedNames.join(", ")} };`);
  const sandbox = { module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  new vm.Script(source).runInContext(sandbox);
  return sandbox.module.exports;
}

function loadSwarmsyOnboardingModel(fetchImpl) {
  const source = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/models/swarmsyOnboarding.js"
      ),
      "utf8"
    )
    .replace(/import\s*{[\s\S]*?}\s*from\s*".*?";\r?\n/g, "")
    .replace(/import .* from ".*?";\r?\n/g, "")
    .replace(/export default SwarmsyOnboarding;\r?\n?/, "")
    .concat("\nmodule.exports = SwarmsyOnboarding;");
  const sandbox = {
    module: { exports: {} },
    exports: {},
    __mockFetch: fetchImpl,
  };

  vm.createContext(sandbox);
  new vm.Script(
    `const API_BASE = "http://localhost/api";
const baseHeaders = () => ({});
const fetch = __mockFetch;
${source}`
  ).runInContext(sandbox);
  return sandbox.module.exports;
}

function successfulResponse(payload) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue(payload),
  };
}

function createBeginnerJourneyApi() {
  const state = {
    workspaceExists: false,
    sparkyPromptMissing: true,
    doctrineReady: false,
    session: null,
    idea: null,
  };

  const status = () => ({
    success: true,
    mode: "swarmsy_onboarding",
    workspace: {
      exists: state.workspaceExists,
      slug: state.workspaceExists ? "swarmsy-hive" : null,
      ready: state.doctrineReady,
    },
    sparkyPrompt: {
      missing: state.sparkyPromptMissing,
      available: true,
      status: state.sparkyPromptMissing ? "generic_prompt" : "applied",
    },
    doctrine: {
      statusAvailable: true,
      docsRootAvailable: true,
      requiredMissing: 0,
      requiredNonLoadable: 0,
    },
  });

  const fetchImpl = jest.fn(async (url, options = {}) => {
    const requestPath = String(url).replace("http://localhost/api", "");
    const body = options.body ? JSON.parse(options.body) : {};

    if (requestPath === "/swarmsy/onboarding/status") {
      return successfulResponse(status());
    }
    if (requestPath === "/swarmsy/onboarding/create-hive") {
      state.workspaceExists = true;
      return successfulResponse({
        success: true,
        workspace: status().workspace,
      });
    }
    if (
      requestPath === "/swarmsy/workspaces/swarmsy-hive/sparky-prompt/apply"
    ) {
      if (body.confirmApply !== true) {
        return successfulResponse({
          success: false,
          message: "Confirmation required.",
        });
      }
      state.sparkyPromptMissing = false;
      return successfulResponse({ success: true });
    }
    if (requestPath === "/swarmsy/onboarding/ingest-required-docs") {
      state.doctrineReady = true;
      return successfulResponse({ success: true });
    }
    if (
      requestPath === "/swarmsy/workspaces/swarmsy-hive/intake-session/start"
    ) {
      state.session = {
        id: 76,
        mode: body.mode,
        status: "active",
        currentStep: 0,
        answers: {},
      };
      return successfulResponse({
        success: true,
        session: state.session,
        resumed: false,
      });
    }
    if (
      requestPath ===
      "/swarmsy/workspaces/swarmsy-hive/intake-session/76/progress"
    ) {
      state.session = {
        ...state.session,
        currentStep: body.currentStep,
        answers: body.answers,
      };
      return successfulResponse({ success: true, session: state.session });
    }
    if (
      requestPath === "/swarmsy/workspaces/swarmsy-hive/identity-ideas/propose"
    ) {
      state.idea = { id: 51, status: "proposed", ...body };
      return successfulResponse({ success: true, idea: state.idea });
    }
    if (
      requestPath ===
      "/swarmsy/workspaces/swarmsy-hive/intake-session/76/complete"
    ) {
      state.session = { ...state.session, status: "completed" };
      return successfulResponse({ success: true, session: state.session });
    }
    if (
      requestPath ===
      "/swarmsy/workspaces/swarmsy-hive/identity-ideas/51/decision"
    ) {
      const statuses = { keep: "kept", save: "saved", delete: "deleted" };
      state.idea = { ...state.idea, status: statuses[body.decision] };
      return successfulResponse({ success: true, idea: state.idea });
    }
    if (requestPath === "/swarmsy/workspaces/swarmsy-hive/identity-ideas") {
      return successfulResponse({ success: true, ideas: [state.idea] });
    }

    throw new Error(`Unexpected beginner journey request: ${requestPath}`);
  });

  return { fetchImpl, state };
}

describe("complete beginner SPARKY journey", () => {
  const setup = loadFrontendHelpers(
    "components/SwarmsyFirstRunOnboarding/setupRecovery.js",
    ["getSparkySetupRecovery"]
  );
  const handoff = loadFrontendHelpers(
    "components/SwarmsyFirstRunOnboarding/handoff.js",
    [
      "SWARMSY_INTAKE_COMPLETE_MESSAGE",
      "buildSwarmsyIntakeBatchProgress",
      "buildIdentityIdeaProposalFromSparkyMessage",
      "getIntakeStarterMessage",
    ]
  );
  const identity = loadFrontendHelpers(
    "components/SwarmsyFirstRunOnboarding/identityIdea.js",
    [
      "getIdentityIdeaActions",
      "buildIdentityIdeaImagePrompt",
      "buildIdentityIdeaSparkyMessage",
      "isExplicitIdentityIdeaSaveMessage",
    ]
  );

  it("takes a non-technical user from first setup to a saved identity idea", async () => {
    const { fetchImpl, state } = createBeginnerJourneyApi();
    const api = loadSwarmsyOnboardingModel(fetchImpl);

    let appStatus = await api.status();
    expect(setup.getSparkySetupRecovery(appStatus)).toMatchObject({
      buttonLabel: "Set up SPARKY",
    });

    await api.createHive();
    appStatus = await api.status();
    expect(setup.getSparkySetupRecovery(appStatus)).toMatchObject({
      buttonLabel: "Fix SPARKY",
    });
    await api.applySparkyPrompt(appStatus.workspace.slug, true);
    await api.ingestRequiredDocs();
    appStatus = await api.status();
    expect(setup.getSparkySetupRecovery(appStatus)).toBeNull();

    const starter = handoff.getIntakeStarterMessage("hidden", {
      creativeIntensity: "wtf",
    });
    expect(starter).toContain("full 76-question intake");
    expect(starter).toContain("one reply or several answer batches");
    expect(starter).toContain("Creative intensity: WTF");

    const started = await api.startIntakeSession("swarmsy-hive", "hidden");
    const progress = handoff.buildSwarmsyIntakeBatchProgress(
      started.session,
      "1. I want people to question waste.\n76. Keep me anonymous."
    );
    await api.saveIntakeProgress(
      "swarmsy-hive",
      started.session.id,
      progress.currentStep,
      progress.answers
    );
    expect(state.session.currentStep).toBe(76);
    expect(state.session.answers._submissions).toHaveLength(1);

    const sparkyReply = `${handoff.SWARMSY_INTAKE_COMPLETE_MESSAGE}
TITLE: The Leftover
Creative intensity: WTF
MESSAGE: NOTHING IS AWAY
DOODAD: A grinning bin-bag ghost
PLACEMENT: A fictional legal mockup beside a recycling centre`;
    const proposal = handoff.buildIdentityIdeaProposalFromSparkyMessage(
      sparkyReply,
      "hidden"
    );
    expect(proposal).toMatchObject({
      mode: "hidden",
      title: "The Leftover",
    });

    const proposed = await api.proposeIdentityIdea("swarmsy-hive", proposal);
    await api.completeIntakeSession("swarmsy-hive", started.session.id);
    expect(identity.getIdentityIdeaActions(proposed.idea)).toEqual([
      { id: "keep", label: "Keep this idea" },
      { id: "try-another", label: "Try another" },
      { id: "delete", label: "Delete" },
    ]);
    expect(identity.buildIdentityIdeaImagePrompt(proposed.idea)).toContain(
      "MESSAGE"
    );

    const kept = await api.decideIdentityIdea(
      "swarmsy-hive",
      proposed.idea.id,
      "keep"
    );
    expect(identity.getIdentityIdeaActions(kept.idea)).toEqual([
      { id: "brainstorm", label: "Talk it through with SPARKY" },
      { id: "save", label: "Save this idea" },
      { id: "delete", label: "Delete" },
    ]);
    expect(identity.buildIdentityIdeaSparkyMessage(kept.idea)).toContain(
      "You remain my SWARMSY guide"
    );

    expect(
      identity.isExplicitIdentityIdeaSaveMessage(
        "Great, save that idea to my workspace."
      )
    ).toBe(true);
    const saved = await api.decideIdentityIdea(
      "swarmsy-hive",
      kept.idea.id,
      "save"
    );
    const library = await api.identityIdeas("swarmsy-hive");

    expect(saved.idea.status).toBe("saved");
    expect(library.ideas).toEqual([saved.idea]);
    expect(state.session.status).toBe("completed");
    expect(
      fetchImpl.mock.calls.map(
        ([url, options = {}]) =>
          `${options.method || "GET"} ${String(url).replace(
            "http://localhost/api",
            ""
          )}`
      )
    ).toEqual([
      "GET /swarmsy/onboarding/status",
      "POST /swarmsy/onboarding/create-hive",
      "GET /swarmsy/onboarding/status",
      "POST /swarmsy/workspaces/swarmsy-hive/sparky-prompt/apply",
      "POST /swarmsy/onboarding/ingest-required-docs",
      "GET /swarmsy/onboarding/status",
      "POST /swarmsy/workspaces/swarmsy-hive/intake-session/start",
      "POST /swarmsy/workspaces/swarmsy-hive/intake-session/76/progress",
      "POST /swarmsy/workspaces/swarmsy-hive/identity-ideas/propose",
      "POST /swarmsy/workspaces/swarmsy-hive/intake-session/76/complete",
      "POST /swarmsy/workspaces/swarmsy-hive/identity-ideas/51/decision",
      "POST /swarmsy/workspaces/swarmsy-hive/identity-ideas/51/decision",
      "GET /swarmsy/workspaces/swarmsy-hive/identity-ideas",
    ]);
  });
});
