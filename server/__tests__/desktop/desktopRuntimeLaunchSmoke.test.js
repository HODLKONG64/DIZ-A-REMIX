const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  findLoadedDesktopPage,
  firstRunPaths,
  stopWindowsProcessTree,
  validateFirstRunFiles,
} = require("../../../desktop/scripts/desktop-runtime-launch-smoke.cjs");

describe("packaged desktop runtime launch smoke", () => {
  it("matches only the Electron page loaded from the fresh local runtime", () => {
    const targets = [
      { type: "service_worker", url: "http://127.0.0.1:3210/sw.js" },
      { type: "page", url: "devtools://devtools/bundled/inspector.html" },
      { type: "page", url: "http://127.0.0.1:3210/" },
    ];

    expect(findLoadedDesktopPage(targets, "http://127.0.0.1:3210")).toEqual(
      targets[2]
    );
    expect(
      findLoadedDesktopPage(targets, "http://127.0.0.1:9999")
    ).toBeUndefined();
  });

  it("requires the database, generated secrets, and managed runtime manifest", () => {
    const userDataRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "swarmsy-launch-smoke-test-")
    );
    const files = firstRunPaths(userDataRoot);
    for (const file of Object.values(files)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "created");
    }

    expect(validateFirstRunFiles(userDataRoot)).toEqual(files);
    fs.rmSync(files.database);
    expect(() => validateFirstRunFiles(userDataRoot)).toThrow(
      "First-run database was not created"
    );
    fs.rmSync(userDataRoot, { recursive: true, force: true });
  });

  it("stops the entire Windows desktop process tree", () => {
    const spawnSyncImpl = jest.fn(() => ({ status: 0, error: null }));

    expect(stopWindowsProcessTree(1234, { spawnSyncImpl })).toBe(true);
    expect(spawnSyncImpl).toHaveBeenCalledWith(
      "taskkill",
      ["/pid", "1234", "/t", "/f"],
      { stdio: "inherit", windowsHide: true }
    );
    expect(stopWindowsProcessTree(null, { spawnSyncImpl })).toBe(false);
  });

  it("wires the real launch check after structural artifact validation", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const workflow = fs.readFileSync(
      path.join(repoRoot, ".github/workflows/desktop-artifact-build.yml"),
      "utf8"
    );
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
    );

    expect(packageJson.scripts["desktop:runtime:smoke:win"]).toBe(
      "node desktop/scripts/desktop-runtime-launch-smoke.cjs"
    );
    expect(workflow).toContain(
      "name: Launch packaged desktop and verify fresh first run"
    );
    expect(workflow).toContain("npm run desktop:runtime:smoke:win");
    expect(workflow.indexOf("npm run desktop:artifact:smoke")).toBeLessThan(
      workflow.indexOf("npm run desktop:runtime:smoke:win")
    );
  });
});
