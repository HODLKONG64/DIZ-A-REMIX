const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadReturningUserHelpers() {
  const source = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/returningUser.js"
      ),
      "utf8"
    )
    .replace(/export function /g, "function ")
    .concat("\nmodule.exports = { getReturningUserStep };");

  const sandbox = { module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  new vm.Script(source).runInContext(sandbox);
  return sandbox.module.exports;
}

describe("SWARMSY returning-user home", () => {
  const { getReturningUserStep } = loadReturningUserHelpers();
  const componentPath = path.resolve(
    __dirname,
    "../../../frontend/src/components/SwarmsyFirstRunOnboarding/ReturningUserHome.jsx"
  );
  const onboardingPath = path.resolve(
    __dirname,
    "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
  );

  it("continues unfinished questions before any stored idea", () => {
    const session = { id: 9, mode: "hidden" };
    expect(
      getReturningUserStep({
        session,
        ideas: [{ id: 4, status: "saved" }],
      })
    ).toEqual({ kind: "intake", session });
  });

  it("prefers a kept working idea over an older saved idea", () => {
    const kept = { id: 7, status: "kept", title: "Working idea" };
    expect(
      getReturningUserStep({
        ideas: [{ id: 4, status: "saved" }, kept],
      })
    ).toEqual({ kind: "idea", idea: kept });
  });

  it("routes a proposed idea to the decision surface", () => {
    const idea = { id: 8, status: "proposed", title: "New direction" };
    expect(getReturningUserStep({ ideas: [idea] })).toEqual({
      kind: "review",
      idea,
    });
  });

  it("stays hidden when there is nothing to continue", () => {
    expect(getReturningUserStep()).toBeNull();
  });

  it("uses only plain returning-user actions and safe SPARKY handoffs", () => {
    const source = fs.readFileSync(componentPath, "utf8");
    expect(source).toContain("Continue your questions");
    expect(source).toContain("Continue with SPARKY");
    expect(source).toContain("Review my idea");
    expect(source).toContain("SPARKY is finding where you left off");
    expect(source).toContain("SwarmsyOnboarding.activeIntakeSession");
    expect(source).toContain("SwarmsyOnboarding.identityIdeas");
    expect(source).toContain("buildIdentityIdeaSparkyMessage(step.idea)");
    expect(source).toContain("identityIdea:");
    expect(source).not.toMatch(/database|Prisma|API key|vector database/i);
  });

  it("wires the returning card above the existing Action Hub", () => {
    const source = fs.readFileSync(onboardingPath, "utf8");
    const returningCard = source.indexOf("<ReturningUserHome");
    const actionHub = source.indexOf('id="swarmsy-action-hub"');
    expect(returningCard).toBeGreaterThan(-1);
    expect(actionHub).toBeGreaterThan(returningCard);
    expect(source).toContain("onContinueIntake={continueReturningIntake}");
    expect(source).toContain("onContinueIdea={openIdentityIdeaChat}");
    expect(source).toContain("getIntakeDisabledMessage(activeStatus, mode");
  });
});
