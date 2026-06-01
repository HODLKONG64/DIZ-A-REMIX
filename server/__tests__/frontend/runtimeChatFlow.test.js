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
    expect(source).toContain("runtimeWorkspace?.chatModel || \"System Default\"");
  });
});
