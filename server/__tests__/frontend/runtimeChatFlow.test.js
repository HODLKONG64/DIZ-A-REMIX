const fs = require("fs");
const path = require("path");

describe("SWARMSY runtime chat flow wiring", () => {
  it("passes pending runtime handoff from chat container into stream execution", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/WorkspaceChat/ChatContainer/index.jsx"
      ),
      "utf8"
    );

    expect(source).toContain("normalizeLocalUserOllamaRuntimeSelection");
    expect(source).toContain("runtime: lastUserMessage?.runtime");
    expect(source).toContain("runtime: promptMessage?.runtime");
    expect(source).toContain("const runtime = normalizeLocalUserOllamaRuntimeSelection");
    expect(source).toContain("isLocalUserSessionRef.current");
    expect(source).toContain("activeLocalUserRuntimeRef.current");
    expect(source).toContain("isLocalUserSessionRef.current = false");
    expect(source).toContain("sessionStorage.removeItem(SWARMSY_LOCAL_USER_ACTIVE_RUNTIME)");
    expect(source).toContain("storedRuntime?.workspaceSlug");
    expect(source).toContain("storedRuntimeWorkspaceSlug !== normalizedWorkspaceSlug");
    expect(source).toContain("workspaceSlug: workspace.slug");
    expect(source).toContain("const result = await sendCommand");
    expect(source).toContain("if (result !== false)");
    expect(source).toContain("sessionStorage.removeItem(PENDING_HOME_MESSAGE)");
  });

  it("sends runtime overrides in workspace and thread chat requests", () => {
    const workspaceSource = fs.readFileSync(
      path.resolve(__dirname, "../../../frontend/src/models/workspace.js"),
      "utf8"
    );
    const threadSource = fs.readFileSync(
      path.resolve(__dirname, "../../../frontend/src/models/workspaceThread.js"),
      "utf8"
    );

    expect(workspaceSource).toContain("body: JSON.stringify({ message, attachments, runtime })");
    expect(threadSource).toContain("body: JSON.stringify({ message, attachments, runtime })");
  });

  it("applies runtime overrides before server chat execution", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../../server/endpoints/chat.js"),
      "utf8"
    );

    expect(source).toContain("applyRuntimeSelectionToWorkspace");
    expect(source).toContain("const { workspace: runtimeWorkspace } =");
    expect(source).toContain("workspaceName: workspace?.name");
    expect(source).toContain("runtimeWorkspace?.chatModel || \"System Default\"");
  });
});
