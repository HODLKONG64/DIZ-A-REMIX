const fs = require("fs");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");
const {
  cleanupFirstRunData,
  findLoadedDesktopPage,
  firstRunPaths,
  requestText,
  stopWindowsProcessTree,
  validateFirstRunFiles,
} = require("../../../desktop/scripts/desktop-runtime-launch-smoke.cjs");

describe("packaged desktop runtime launch smoke", () => {
  it("matches only the Electron page loaded from the fresh local runtime", () => {
    const targets = [
      { type: "service_worker", url: "http://127.0.0.1:3210/sw.js" },
      { type: "page", url: "devtools://devtools/bundled/inspector.html" },
      { type: "page", url: "http://127.0.0.1:3210/" },
      { type: "page", url: "http://127.0.0.1:3210/diagnostics" },
      { type: "page", url: "http://127.0.0.1:3210/onboarding" },
    ];

    expect(
      findLoadedDesktopPage(targets, "http://127.0.0.1:3210/onboarding")
    ).toEqual(targets[4]);
    expect(findLoadedDesktopPage(targets, "http://127.0.0.1:3210/")).toEqual(
      targets[2]
    );
    expect(
      findLoadedDesktopPage(targets, "http://127.0.0.1:3210/missing")
    ).toBeUndefined();
  });

  it("rejects a failed response stream so the readiness loop can retry", async () => {
    const response = new EventEmitter();
    response.statusCode = 200;
    const request = new EventEmitter();
    request.destroy = jest.fn();
    const httpGetImpl = jest.fn((_url, _options, onResponse) => {
      process.nextTick(() => {
        onResponse(response);
        response.emit("error", new Error("connection reset"));
      });
      return request;
    });

    await expect(
      requestText("http://127.0.0.1:3210", { httpGetImpl })
    ).rejects.toThrow("connection reset");
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

  it("removes fresh smoke-test data with Windows retry protection", () => {
    const rmSyncImpl = jest.fn();

    expect(cleanupFirstRunData("C:\\Temp\\swarmsy-smoke", { rmSyncImpl })).toBe(
      true
    );
    expect(rmSyncImpl).toHaveBeenCalledWith("C:\\Temp\\swarmsy-smoke", {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 250,
    });
    expect(
      cleanupFirstRunData("C:\\Temp\\swarmsy-smoke", {
        rmSyncImpl: () => {
          throw new Error("locked");
        },
      })
    ).toBe(false);
    expect(cleanupFirstRunData("", { rmSyncImpl })).toBe(false);
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
