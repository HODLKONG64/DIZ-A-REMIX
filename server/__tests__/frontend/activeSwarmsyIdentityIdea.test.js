const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadHelpers() {
  const source = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/utils/activeSwarmsyIdentityIdea.js"
      ),
      "utf8"
    )
    .replace(/export function /g, "function ")
    .replace(/export \{ ACTIVE_SWARMSY_IDENTITY_IDEA \};?/, "").concat(`
module.exports = {
  ACTIVE_SWARMSY_IDENTITY_IDEA,
  clearActiveSwarmsyIdentityIdea,
  getActiveSwarmsyIdentityIdea,
  storeActiveSwarmsyIdentityIdea,
};`);
  const sandbox = { module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  new vm.Script(source).runInContext(sandbox);
  return sandbox.module.exports;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("active SWARMSY Identity Idea continuity", () => {
  it("restores only the idea for the same workspace and thread", () => {
    const { getActiveSwarmsyIdentityIdea, storeActiveSwarmsyIdentityIdea } =
      loadHelpers();
    const storage = memoryStorage();
    const scope = { workspaceSlug: "swarmsy-hive", threadSlug: "brainstorm" };
    const idea = { id: 42, status: "kept", title: "The Quiet Signal" };

    expect(storeActiveSwarmsyIdentityIdea(scope, idea, storage)).toBe(true);
    expect(getActiveSwarmsyIdentityIdea(scope, storage)).toEqual(idea);
    expect(
      getActiveSwarmsyIdentityIdea(
        { workspaceSlug: "another-workspace", threadSlug: "brainstorm" },
        storage
      )
    ).toBeNull();
    expect(
      getActiveSwarmsyIdentityIdea(
        { workspaceSlug: "swarmsy-hive", threadSlug: "another-thread" },
        storage
      )
    ).toBeNull();
  });

  it("clears only the matching chat scope", () => {
    const {
      clearActiveSwarmsyIdentityIdea,
      getActiveSwarmsyIdentityIdea,
      storeActiveSwarmsyIdentityIdea,
    } = loadHelpers();
    const storage = memoryStorage();
    const scope = { workspaceSlug: "swarmsy-hive", threadSlug: null };
    storeActiveSwarmsyIdentityIdea(scope, { id: 42 }, storage);

    clearActiveSwarmsyIdentityIdea(
      { workspaceSlug: "another-workspace", threadSlug: null },
      storage
    );
    expect(getActiveSwarmsyIdentityIdea(scope, storage)).toEqual({ id: 42 });

    clearActiveSwarmsyIdentityIdea(scope, storage);
    expect(getActiveSwarmsyIdentityIdea(scope, storage)).toBeNull();
  });
});
