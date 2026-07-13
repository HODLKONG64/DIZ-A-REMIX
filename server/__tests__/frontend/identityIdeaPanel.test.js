const fs = require("fs");
const path = require("path");

const panelPath = path.resolve(
  __dirname,
  "../../../frontend/src/components/SwarmsyFirstRunOnboarding/IdentityIdeaPanel.jsx"
);
const onboardingPath = path.resolve(
  __dirname,
  "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
);

describe("visible SWARMSY Identity Idea panel", () => {
  const panelSource = fs.readFileSync(panelPath, "utf8");
  const onboardingSource = fs.readFileSync(onboardingPath, "utf8");

  it("renders a plain-language Identity Ideas section", () => {
    expect(panelSource).toContain("Your Identity Ideas");
    expect(panelSource).toContain("No identity ideas yet.");
    expect(panelSource).toMatch(
      /Your ideas will appear here when they\s+are ready for you to choose\./
    );
    expect(panelSource).not.toContain("Prisma");
    expect(panelSource).not.toContain("database");
    expect(panelSource).not.toContain("provider key");
  });

  it("loads scoped ideas and uses the tested beginner action contract", () => {
    expect(panelSource).toContain(
      "SwarmsyOnboarding.identityIdeas(workspaceSlug)"
    );
    expect(panelSource).toContain("getIdentityIdeaActions(idea)");
    expect(panelSource).toContain("SwarmsyOnboarding.decideIdentityIdea(");
    expect(panelSource).toContain(
      "buildIdentityIdeaSparkyMessage(idea, { tryAnother })"
    );
    expect(panelSource).toContain("identityIdea: tryAnother");
    expect(panelSource).toContain("id: idea.id");
  });

  it("blocks idea decisions and chat when no workspace is open", () => {
    const decisionGuard = panelSource.indexOf(
      'setError("Open your SWARMSY workspace before updating this idea.")'
    );
    const decisionRequest = panelSource.indexOf(
      "SwarmsyOnboarding.decideIdentityIdea("
    );
    const chatGuard = onboardingSource.indexOf(
      '"Open your SWARMSY workspace before continuing with SPARKY."'
    );
    const chatPayload = onboardingSource.indexOf(
      "buildOnboardingChatHandoffPayload({",
      onboardingSource.indexOf("function openIdentityIdeaChat")
    );

    expect(decisionGuard).toBeGreaterThan(-1);
    expect(decisionGuard).toBeLessThan(decisionRequest);
    expect(chatGuard).toBeGreaterThan(-1);
    expect(chatGuard).toBeLessThan(chatPayload);
  });

  it("requires deliberate confirmation before deleting an idea", () => {
    expect(panelSource).toContain('if (decision === "delete")');
    expect(panelSource).toContain("confirmDelete(");
    expect(panelSource).toContain("if (!confirmed) return;");
  });

  it("wires brainstorming and Try Another back through SPARKY chat", () => {
    expect(onboardingSource).toContain(
      'import IdentityIdeaPanel from "./IdentityIdeaPanel"'
    );
    expect(onboardingSource).toContain("<IdentityIdeaPanel");
    expect(onboardingSource).toContain("onOpenChat={openIdentityIdeaChat}");
    expect(onboardingSource).toContain("buildOnboardingChatHandoffPayload({");
    expect(onboardingSource).toContain(
      'mode: isLocalUserMode ? "local_user" : "hosted_admin"'
    );
  });

  it("preserves the local-user model safety check before opening chat", () => {
    expect(onboardingSource).toContain("if (!hasVerifiedLocalOllamaModels)");
    expect(onboardingSource).toContain(
      "if (!selectedLocalOllamaModel || !selectedLocalOllamaModelIsInstalled)"
    );
  });
});
