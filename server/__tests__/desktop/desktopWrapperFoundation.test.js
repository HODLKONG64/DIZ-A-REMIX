const fs = require("fs");
const path = require("path");
const {
  validateLocalUserStorageManifest,
} = require("../../../utils/swarmsy/localUserStorageContract");

describe("SWARMSY desktop wrapper foundation", () => {
  const repoRoot = path.resolve(__dirname, "../../..");

  it("registers desktop foundation scripts at repo root", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(repoRoot, "../package.json"), "utf8")
    );

    expect(packageJson.scripts["desktop:dev"]).toBe(
      "node desktop/scripts/run-desktop-dev.cjs"
    );
    expect(packageJson.scripts["desktop:smoke"]).toBe(
      "node desktop/scripts/desktop-smoke-check.cjs"
    );
  });

  it("keeps desktop entrypoint sandboxed with secure BrowserWindow defaults", () => {
    const source = fs.readFileSync(
      path.resolve(repoRoot, "../desktop/electron/main.cjs"),
      "utf8"
    );

    expect(source).toContain("contextIsolation: true");
    expect(source).toContain("nodeIntegration: false");
    expect(source).toContain("sandbox: true");
    expect(source).toContain("SWARMSY_DESKTOP_START_URL");
  });

  it("builds desktop storage contract data from the Local User manifest contract", () => {
    const {
      getDesktopStorageContract,
    } = require(path.resolve(
      repoRoot,
      "../desktop/foundation/storageContractBridge.cjs"
    ));

    const contract = getDesktopStorageContract({
      platform: "linux",
      homeDir: "/tmp/swarmsy-home",
    });

    expect(contract.layout.mode).toBe("local_user");
    expect(contract.layout.root).toContain("/tmp/swarmsy-home/.config/swarmsy");

    const validation = validateLocalUserStorageManifest(contract.manifest, {
      layout: contract.layout,
    });
    expect(validation.valid).toBe(true);
  });
});
