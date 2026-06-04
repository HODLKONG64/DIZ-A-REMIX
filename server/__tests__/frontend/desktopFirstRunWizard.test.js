const fs = require("fs");
const path = require("path");

function wizardSource() {
  return fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../frontend/src/components/SwarmsyDesktopFirstRunWizard/index.jsx"
    ),
    "utf8"
  );
}

describe("SWARMSY Desktop first-run wizard frontend", () => {
  it("first launch displays wizard until desktopFirstRunCompleted is stored", () => {
    const source = wizardSource();
    expect(source).toContain("readDesktopLocalUserFirstRunCompleted");
    expect(source).toContain("mirrorDesktopLocalUserFirstRunCompleted");
    expect(source).toContain("setVisible(true)");
    expect(source).toContain("!completed");
  });

  it("completed launch skips the wizard", () => {
    const source = wizardSource();
    expect(source).toContain("desktopCompletion.completed");
    expect(source).toContain("if (!completed)");
    expect(source).toContain("return null");
  });

  it("manual relaunch works from the shared settings event", () => {
    const source = wizardSource();
    expect(source).toContain("DESKTOP_FIRST_RUN_RELAUNCH_EVENT");
    expect(source).toContain("window.addEventListener(DESKTOP_FIRST_RUN_RELAUNCH_EVENT, relaunch)");
    expect(source).toContain("setManualLaunch(true)");
  });

  it("runs readiness checks and maps failures to existing diagnostics", () => {
    const source = wizardSource();
    expect(source).toContain("getRuntimeStatus");
    expect(source).toContain("getStorageContract");
    expect(source).toContain("localUserOllamaStatus");
    expect(source).toContain("runtime_healthcheck_failed");
    expect(source).toContain("ollama_unreachable");
    expect(source).toContain("selected_model_missing");
  });

  it("shows manual Ollama and model install actions without automatic installs", () => {
    const source = wizardSource();
    expect(source).toContain("https://ollama.com");
    expect(source).toContain("ollama pull");
    expect(source).toContain("never installs software");
    expect(source).toContain("downloads");
    expect(source).not.toContain("auto-pull");
  });
});
