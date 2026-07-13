const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadSetupRecoveryHelpers() {
  const source = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/setupRecovery.js"
      ),
      "utf8"
    )
    .replace(/export function /g, "function ")
    .concat("\nmodule.exports = { getSparkySetupRecovery };");
  const sandbox = { module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  new vm.Script(source).runInContext(sandbox);
  return sandbox.module.exports;
}

describe("SPARKY automatic setup recovery", () => {
  const { getSparkySetupRecovery } = loadSetupRecoveryHelpers();

  it("offers one automatic setup action when the workspace is missing", () => {
    expect(
      getSparkySetupRecovery({ workspace: { exists: false, ready: false } })
    ).toMatchObject({
      title: "Let's get SPARKY ready",
      buttonLabel: "Set up SPARKY",
    });
  });

  it("offers a plain repair when SPARKY's guide is missing", () => {
    expect(
      getSparkySetupRecovery({
        success: true,
        workspace: { exists: true, ready: false },
        sparkyPrompt: { missing: true },
      })
    ).toMatchObject({
      title: "SPARKY needs a quick repair",
      buttonLabel: "Fix SPARKY",
    });
  });

  it("still offers prompt repair when the workspace documents are ready", () => {
    expect(
      getSparkySetupRecovery({
        success: true,
        workspace: { exists: true, ready: true },
        sparkyPrompt: { missing: true },
      })
    ).toMatchObject({
      title: "SPARKY needs a quick repair",
      buttonLabel: "Fix SPARKY",
    });
  });

  it("does not claim the workspace is missing when the status check failed", () => {
    expect(
      getSparkySetupRecovery({
        success: false,
        workspace: { exists: false, ready: false },
      })
    ).toMatchObject({
      title: "SPARKY could not finish checking the app",
      buttonLabel: "Try the fix again",
    });
  });

  it("does not show recovery after setup is ready", () => {
    expect(
      getSparkySetupRecovery({ workspace: { exists: true, ready: true } })
    ).toBeNull();
  });

  it("keeps the default recovery card free of implementation language", () => {
    const component = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/SparkySetupRecovery.jsx"
      ),
      "utf8"
    );
    const helper = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/setupRecovery.js"
      ),
      "utf8"
    );
    expect(`${component}\n${helper}`).not.toMatch(
      /doctrine|collector|database|Prisma|API key|vector|system prompt/i
    );
    expect(component).toContain("SPARKY is fixing this");
  });

  it("chains safe setup actions and hides manual controls by default", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );
    const create = source.indexOf("SwarmsyOnboarding.createHive()");
    const prompt = source.indexOf("SwarmsyOnboarding.applySparkyPrompt(");
    const docs = source.indexOf("SwarmsyOnboarding.ingestRequiredDocs()");
    expect(create).toBeGreaterThan(-1);
    expect(prompt).toBeGreaterThan(create);
    expect(docs).toBeGreaterThan(prompt);
    expect(source).toContain("Advanced setup details");
    expect(source).toContain("Advanced setup controls");
    expect(source).toContain('busyAction === "automatic-setup"');
    expect(source).toContain("const sparkyExperienceReady = Boolean(");
    expect(source).toContain("!activeStatus?.sparkyPrompt?.missing");
    expect(source.match(/\{sparkyExperienceReady && \(/g)).toHaveLength(2);
    expect(source).toContain("const workspaceSlug = String(");
    expect(source).toContain("if (!workspaceSlug)");
    expect(source).toContain("const customPromptConfirmed =");
    expect(source).toContain('typeof window.confirm === "function"');
    expect(source).toContain("if (!customPromptConfirmed)");
    expect(source.indexOf("<SparkySetupRecovery")).toBeGreaterThan(
      source.indexOf("Welcome to SWARMSY HIVE")
    );
  });
});
