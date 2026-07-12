const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadSwarmsyOnboardingModule(fetchImpl) {
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

  const script = new vm.Script(
    `const API_BASE = "http://localhost/api";
const baseHeaders = () => ({});
const fetch = __mockFetch;
${source}`
  );
  const sandbox = {
    module: { exports: {} },
    exports: {},
    __mockFetch: fetchImpl,
  };
  vm.createContext(sandbox);
  script.runInContext(sandbox);
  return sandbox.module.exports;
}

describe("Swarmsy onboarding model", () => {
  it("returns an unknown/fallback shape on network failure (not local_user mode)", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response = await onboardingModel.localUserOllamaStatus();

    expect(response).toEqual({
      success: false,
      mode: "unknown",
      provider: "ollama",
      status: "error",
      reachable: false,
      models: [],
      source: "fallback",
      message: "Failed to resolve SWARMSY local-user Ollama status.",
    });
    expect(response.mode).not.toBe("local_user");
    expect(response.source).toBe("fallback");
  });

  it("returns an image engine fallback shape on network failure without API keys", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response = await onboardingModel.localUserImageEngineStatus();

    expect(response).toEqual({
      success: false,
      mode: "unknown",
      available: false,
      engine: "comfyui",
      url: "http://localhost:8188",
      configuredBy: "default",
      explanation: "Desktop/local mode checks ComfyUI on this computer.",
      source: "fallback",
      message: "Failed to resolve SWARMSY local image engine status.",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/local-user/image-engine/status",
      expect.objectContaining({ headers: {} })
    );
  });

  it("calls the hosted ComfyUI status endpoint without API keys", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        mode: "hosted_server",
        available: false,
        engine: "comfyui",
        url: "http://comfyui:8188",
        configuredBy: "SWARMSY_LOCAL_COMFYUI_URL",
        explanation:
          "Hosted/server mode checks the configured server-side ComfyUI URL.",
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response = await onboardingModel.hostedImageEngineStatus();

    expect(response).toMatchObject({
      mode: "hosted_server",
      configuredBy: "SWARMSY_LOCAL_COMFYUI_URL",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/hosted/image-engine/status",
      expect.objectContaining({ headers: {} })
    );
  });

  it("posts local ComfyUI generation requests without API keys", async () => {
    const payload = {
      prompt: "street art poster",
      negativePrompt: "blurry",
      workflowJson: { "1": {} },
    };
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        mode: "local_user",
        engine: "comfyui",
        status: "completed",
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response =
      await onboardingModel.localUserImageEngineGenerate(payload);

    expect(response.status).toBe("completed");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/local-user/image-engine/generate",
      {
        method: "POST",
        headers: {},
        body: JSON.stringify(payload),
        signal: undefined,
      }
    );
  });

  it("returns the clear local ComfyUI missing-engine message on generation network failure", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response = await onboardingModel.localUserImageEngineGenerate({
      prompt: "poster",
    });

    expect(response).toEqual({
      success: false,
      mode: "unknown",
      engine: "comfyui",
      status: "unavailable",
      source: "fallback",
      message:
        "ComfyUI is not connected. Start your local image engine before image generation.",
    });
  });

  it("defaults SPARKY prompt apply calls to confirmation=false", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    await onboardingModel.applySparkyPrompt("swarmsy-hive");

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/sparky-prompt/apply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ confirmApply: false }),
      })
    );
  });

  it("allows explicit SPARKY prompt confirmation when callers opt in", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    await onboardingModel.applySparkyPrompt("swarmsy-hive", true);

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(
        "/swarmsy/workspaces/swarmsy-hive/sparky-prompt/apply"
      ),
      expect.objectContaining({
        body: JSON.stringify({ confirmApply: true }),
      })
    );
  });

  it("lists saved Memory Locks for a selected SWARMSY workspace", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        locks: [{ id: 1, version: 2, isActive: true }],
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response = await onboardingModel.memoryLocks("swarmsy-hive");

    expect(response.locks).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/memory-locks",
      expect.objectContaining({ headers: {} })
    );
  });

  it("retrieves a single saved Memory Lock before chat handoff", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        lock: { id: 7, content: "Memory Lock: current priority" },
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response = await onboardingModel.memoryLock("swarmsy-hive", 7);

    expect(response.lock.id).toBe(7);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/memory-locks/7",
      expect.objectContaining({ headers: {} })
    );
  });

  it("imports pasted Memory Locks as active user-scoped storage records", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        lock: { id: 8, version: 3, isActive: true },
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    await onboardingModel.importMemoryLock(
      "swarmsy-hive",
      "Memory Lock: active state"
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/memory-locks/import",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          content: "Memory Lock: active state",
          source: "pasted",
          isActive: true,
        }),
      })
    );
  });

  it("loads saved beginner question progress for the selected workspace", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        session: { id: 61, currentStep: 2 },
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response =
      await onboardingModel.activeIntakeSession("swarmsy-hive");

    expect(response.session.currentStep).toBe(2);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/intake-session",
      expect.objectContaining({ headers: {} })
    );
  });

  it("starts the beginner question path using only the selected mode", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        session: { id: 61, mode: "hidden" },
        resumed: false,
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    await onboardingModel.startIntakeSession("swarmsy-hive", "hidden");

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/intake-session/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mode: "hidden" }),
      })
    );
  });

  it("saves the current answer and question position", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        session: { id: 61, currentStep: 3 },
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);
    const answers = { goal: "build trust" };

    await onboardingModel.saveIntakeProgress(
      "swarmsy-hive",
      61,
      3,
      answers
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/intake-session/61/progress",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ currentStep: 3, answers }),
      })
    );
  });

  it("finishes questions without sending technical configuration", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        nextAction: {
          type: "create_identity_idea",
          label: "Show me my idea",
        },
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response = await onboardingModel.completeIntakeSession(
      "swarmsy-hive",
      61
    );

    expect(response.nextAction.label).toBe("Show me my idea");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/intake-session/61/complete",
      {
        method: "POST",
        headers: {},
      }
    );
    expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty("body");
  });

  it("returns a plain SPARKY recovery message when progress cannot load", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    await expect(
      onboardingModel.activeIntakeSession("swarmsy-hive")
    ).resolves.toEqual({
      success: false,
      session: null,
      message: "SPARKY could not resume your questions.",
    });
  });

  it("lists the current user's Identity Ideas for a workspace", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        ideas: [{ id: 51, status: "proposed", title: "Visible Builder" }],
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response = await onboardingModel.identityIdeas("swarmsy-hive");

    expect(response.ideas).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/identity-ideas",
      expect.objectContaining({ headers: {} })
    );
  });

  it("retrieves one Identity Idea before showing its actions", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        idea: { id: 51, status: "kept", title: "Visible Builder" },
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    const response = await onboardingModel.identityIdea("swarmsy-hive", 51);

    expect(response.idea.id).toBe(51);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/identity-ideas/51",
      expect.objectContaining({ headers: {} })
    );
  });

  it("creates a SPARKY Identity Idea proposal", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        idea: { id: 51, status: "proposed" },
      }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);
    const proposal = {
      mode: "face",
      title: "Visible Builder",
      content: "Show the process and let proof build the identity.",
    };

    await onboardingModel.proposeIdentityIdea("swarmsy-hive", proposal);

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/workspaces/swarmsy-hive/identity-ideas/propose",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(proposal),
      })
    );
  });

  it.each(["keep", "save", "delete"])(
    "sends the plain %s decision for an Identity Idea",
    async (decision) => {
      const fetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          idea: { id: 51 },
        }),
      });
      const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

      await onboardingModel.decideIdentityIdea(
        "swarmsy-hive",
        51,
        decision
      );

      expect(fetchImpl).toHaveBeenCalledWith(
        "http://localhost/api/swarmsy/workspaces/swarmsy-hive/identity-ideas/51/decision",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ decision }),
        })
      );
    }
  );

  it("passes local ComfyUI generation abort signals to fetch", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true }),
    });
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);
    const signal = { aborted: false };

    await onboardingModel.localUserImageEngineGenerate(
      { prompt: "poster" },
      { signal }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/local-user/image-engine/generate",
      expect.objectContaining({ signal })
    );
  });

  it("rethrows local ComfyUI generation abort errors", async () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    const fetchImpl = jest.fn().mockRejectedValue(abortError);
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);

    await expect(
      onboardingModel.localUserImageEngineGenerate({ prompt: "poster" })
    ).rejects.toBe(abortError);
  });

  it("rethrows abort errors so callers can bail out safely", async () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    const fetchImpl = jest.fn().mockRejectedValue(abortError);
    const onboardingModel = loadSwarmsyOnboardingModule(fetchImpl);
    const signal = { aborted: false };

    await expect(
      onboardingModel.localUserOllamaStatus({ signal })
    ).rejects.toBe(abortError);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/api/swarmsy/local-user/ollama/status",
      expect.objectContaining({ signal })
    );
  });
});
