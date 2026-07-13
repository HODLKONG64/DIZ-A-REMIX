const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadIdentityIdeaHelpers() {
  const source = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/identityIdea.js"
      ),
      "utf8"
    )
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ")
    .concat(
      "\nmodule.exports = { IDENTITY_IDEA_ACTION_LABELS, IDENTITY_IMAGE_SUCCESS_MESSAGE, IDENTITY_IMAGE_FALLBACK_MESSAGE, getIdentityIdeaActions, buildIdentityIdeaImagePrompt, getIdentityIdeaImageMessage, buildIdentityIdeaSparkyMessage, isExplicitIdentityIdeaSaveMessage };"
    );

  const sandbox = { module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  new vm.Script(source).runInContext(sandbox);
  return sandbox.module.exports;
}

describe("SWARMSY Identity Idea frontend contract", () => {
  const helpers = loadIdentityIdeaHelpers();

  it("only attempts automatic images in the supported local-user runtime", () => {
    const panelSource = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/IdentityIdeaPanel.jsx"
      ),
      "utf8"
    );
    const onboardingSource = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyFirstRunOnboarding/index.jsx"
      ),
      "utf8"
    );

    expect(panelSource).toContain("if (!prompt || !canGenerateImages) return;");
    expect(onboardingSource).toContain("canGenerateImages={isLocalUserMode}");
  });

  it("offers beginner decisions for a new proposal", () => {
    expect(
      helpers.getIdentityIdeaActions({ id: 1, status: "proposed" })
    ).toEqual([
      { id: "keep", label: "Keep this idea" },
      { id: "try-another", label: "Try another" },
      { id: "delete", label: "Delete" },
    ]);
  });

  it("uses action ids as label keys for every proposal action", () => {
    const actions = helpers.getIdentityIdeaActions({
      id: 1,
      status: "proposed",
    });

    for (const action of actions) {
      expect(helpers.IDENTITY_IDEA_ACTION_LABELS[action.id]).toBe(action.label);
    }
  });

  it("offers brainstorming and explicit save only after an idea is kept", () => {
    expect(helpers.getIdentityIdeaActions({ id: 1, status: "kept" })).toEqual([
      { id: "brainstorm", label: "Talk it through with SPARKY" },
      { id: "save", label: "Save this idea" },
      { id: "delete", label: "Delete" },
    ]);
  });

  it("keeps SPARKY in control of brainstorming regardless of provider", () => {
    const message = helpers.buildIdentityIdeaSparkyMessage({
      title: "Visible Builder",
      content: "Show the process and let proof build the identity.",
    });

    expect(message).toContain("You remain my SWARMSY guide");
    expect(message).toContain("regardless of which AI provider");
    expect(message).toContain("Do not mark the idea as finally saved");
  });

  it("creates a different proposal without overwriting the current idea", () => {
    const message = helpers.buildIdentityIdeaSparkyMessage(
      {
        title: "Visible Builder",
        content: "Show the process and let proof build the identity.",
      },
      { tryAnother: true }
    );

    expect(message).toContain("create a clearly different identity idea");
    expect(message).toContain("Do not overwrite or save the current idea");
    expect(message).toContain("Keep, Delete, or Try Another");
  });

  it("builds every mockup prompt around message, doodad, and placement", () => {
    const prompt = helpers.buildIdentityIdeaImagePrompt({
      title: "River Warning",
      content:
        "WTF mode. A melting smiley beside a rising river and the line THE WATER REMEMBERS.",
    });

    expect(prompt).toContain("MESSAGE");
    expect(prompt).toContain("DOODAD");
    expect(prompt).toContain("PLACEMENT");
    expect(prompt).toContain("fictional, legal mockup location");
    expect(prompt).toContain("SAFE or WTF intensity");
    expect(prompt).toContain("do not depict instructions for trespass");
  });

  it("always gives users plain image guidance whether generation works or not", () => {
    expect(
      helpers.getIdentityIdeaImageMessage({
        success: true,
        image: { url: "http://localhost/image.png" },
      })
    ).toContain("SPARKY created this version");
    expect(helpers.getIdentityIdeaImageMessage({ success: false })).toContain(
      "your exact prompt is ready"
    );
  });

  it("does not build an image prompt from an incomplete idea", () => {
    expect(
      helpers.buildIdentityIdeaImagePrompt({
        title: "Missing content",
        content: " ",
      })
    ).toBeNull();
  });

  it("does not create a chat handoff from an incomplete idea", () => {
    expect(
      helpers.buildIdentityIdeaSparkyMessage({
        title: "Missing content",
        content: " ",
      })
    ).toBeNull();
  });

  it.each([
    "save this idea",
    "Great, save that idea to workspace.",
    "save this idea to my workspace",
    "save this idea please",
    "save that idea, please",
    "save it to workspace, please!",
    "perfect save it",
    "Please lock it in!",
  ])("recognises the explicit save instruction: %s", (message) => {
    expect(helpers.isExplicitIdentityIdeaSaveMessage(message)).toBe(true);
  });

  it.each([
    "I might save this idea later",
    "Don't save this idea",
    "Should I save this idea?",
    "Why save this idea?",
    "This idea could work",
    "save the image prompt",
    "please don't save this idea",
  ])("does not treat discussion as approval: %s", (message) => {
    expect(helpers.isExplicitIdentityIdeaSaveMessage(message)).toBe(false);
  });
});
