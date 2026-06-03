const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadSettingsHubModule() {
  const source = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/components/SwarmsyLocalUserSettingsHub/useLocalUserSettingsHub.js"
      ),
      "utf8"
    )
    .replace(/^import[\s\S]*?;\n/gm, "")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");

  const script = new vm.Script(
    `${source}
module.exports = {
  resolveLocalUserBackupImportModelState
};`
  );

  const sandbox = { module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  script.runInContext(sandbox);
  return sandbox.module.exports;
}

describe("resolveLocalUserBackupImportModelState", () => {
  it("keeps desktop-restored model when browser backup has no model", () => {
    const module = loadSettingsHubModule();
    const result = module.resolveLocalUserBackupImportModelState({
      backupData: { state: {} },
      browserRestoredModelId: "",
      desktopRestoredModelId: "llama3.1:8b",
    });

    expect(result).toEqual({
      restoredModelId: "llama3.1:8b",
      shouldMirrorBrowserModel: false,
      mirrorModelId: "",
    });
  });

  it("mirrors browser model when browser backup includes a model value", () => {
    const module = loadSettingsHubModule();
    const result = module.resolveLocalUserBackupImportModelState({
      backupData: { state: { ollamaModel: "phi3:mini" } },
      browserRestoredModelId: "phi3:mini",
      desktopRestoredModelId: "",
    });

    expect(result).toEqual({
      restoredModelId: "phi3:mini",
      shouldMirrorBrowserModel: true,
      mirrorModelId: "phi3:mini",
    });
  });

  it("does not mirror empty browser fallback over desktop-restored model", () => {
    const module = loadSettingsHubModule();
    const result = module.resolveLocalUserBackupImportModelState({
      backupData: { state: { ollamaModel: null } },
      browserRestoredModelId: "",
      desktopRestoredModelId: "llama3.1:8b",
    });

    expect(result).toEqual({
      restoredModelId: "llama3.1:8b",
      shouldMirrorBrowserModel: false,
      mirrorModelId: "",
    });
  });

  it("mirrors explicit browser clear when no desktop model was restored", () => {
    const module = loadSettingsHubModule();
    const result = module.resolveLocalUserBackupImportModelState({
      backupData: { state: { ollamaModel: null } },
      browserRestoredModelId: "",
      desktopRestoredModelId: "",
    });

    expect(result).toEqual({
      restoredModelId: "",
      shouldMirrorBrowserModel: true,
      mirrorModelId: "",
    });
  });
});
