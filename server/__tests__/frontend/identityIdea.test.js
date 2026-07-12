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
      "\nmodule.exports = { IDENTITY_IDEA_ACTION_LABELS, getIdentityIdeaActions, buildIdentityIdeaSparkyMessage };"
    );

  const sandbox = { module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  new vm.Script(source).runInContext(sandbox);
  return sandbox.module.exports;
}

describe("SWARMSY Identity Idea frontend contract", () => {
  const helpers = loadIdentityIdeaHelpers();

  it("offers beginner decisions for a new proposal", () => {
    expect(
      helpers.getIdentityIdeaActions({ id: 1, status: "proposed" })
    ).toEqual([
      { id: "keep", label: "Keep this idea" },
      { id: "try-another", label: "Try another" },
      { id: "delete", label: "Delete" },
    ]);
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

  it("does not create a chat handoff from an incomplete idea", () => {
    expect(
      helpers.buildIdentityIdeaSparkyMessage({
        title: "Missing content",
        content: " ",
      })
    ).toBeNull();
  });
});
