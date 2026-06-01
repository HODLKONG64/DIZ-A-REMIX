const {
  applyRuntimeSelectionToWorkspace,
  normalizeLocalUserOllamaRuntimeSelection,
} = require("../../../utils/swarmsy/runtimeSelection");

describe("SWARMSY runtime selection helper", () => {
  it("normalizes only local-user ollama runtime payloads", () => {
    expect(
      normalizeLocalUserOllamaRuntimeSelection({
        provider: "ollama",
        mode: "local_user",
        model: " llama3.1:8b ",
      })
    ).toEqual({
      provider: "ollama",
      mode: "local_user",
      model: "llama3.1:8b",
    });

    expect(
      normalizeLocalUserOllamaRuntimeSelection({
        provider: "openai",
        mode: "local_user",
        model: "gpt-4o",
      })
    ).toBeNull();
  });

  it("overrides workspace chat provider/model when runtime handoff is valid", () => {
    const workspace = {
      id: 1,
      slug: "swarmsy-hive",
      chatProvider: "openai",
      chatModel: "gpt-4o-mini",
    };

    expect(
      applyRuntimeSelectionToWorkspace(workspace, {
        provider: "ollama",
        mode: "local_user",
        model: "llama3.1:8b",
      })
    ).toEqual({
      workspace: {
        ...workspace,
        chatProvider: "ollama",
        chatModel: "llama3.1:8b",
      },
      runtimeSelection: {
        provider: "ollama",
        mode: "local_user",
        model: "llama3.1:8b",
      },
    });
  });

  it("leaves the workspace unchanged when runtime handoff is invalid", () => {
    const workspace = {
      id: 1,
      slug: "swarmsy-hive",
      chatProvider: "openai",
      chatModel: "gpt-4o-mini",
    };

    expect(
      applyRuntimeSelectionToWorkspace(workspace, {
        provider: "ollama",
        mode: "hosted_admin",
        model: "llama3.1:8b",
      })
    ).toEqual({
      workspace,
      runtimeSelection: null,
    });
  });
});
