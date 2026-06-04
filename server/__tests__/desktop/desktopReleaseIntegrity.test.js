const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const manifestScriptPath = path.join(
  repoRoot,
  "desktop/scripts/generate-release-manifest.cjs"
);
const validationScriptPath = path.join(
  repoRoot,
  "desktop/scripts/validate-release-integrity.cjs"
);
const packageJsonPath = path.join(repoRoot, "package.json");
const installerWorkflowPath = path.join(
  repoRoot,
  ".github/workflows/desktop-installer-build.yml"
);

const { createReleaseManifest, sha256File } = require(manifestScriptPath);
const { validateReleaseIntegrity } = require(validationScriptPath);

function writeFixtureFile(targetPath, contents) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents);
}

describe("desktop release integrity manifest", () => {
  let tmpRoot;
  let artifactPath;
  let installerPath;
  let manifestPath;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(repoRoot, "desktop/artifacts-test-"));
    artifactPath = path.join(tmpRoot, "swarmsy-desktop-win32-x64.zip");
    installerPath = path.join(tmpRoot, "SWARMSY-Desktop-Setup.exe");
    manifestPath = path.join(tmpRoot, "SWARMSY-Desktop-Release.json");
    writeFixtureFile(artifactPath, "artifact zip bytes");
    writeFixtureFile(installerPath, "installer exe bytes");
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("generates release manifest metadata and SHA256 hashes", () => {
    const manifest = createReleaseManifest({
      artifactPath,
      installerPath,
      outputPath: manifestPath,
      buildDate: "2026-06-04T00:00:00.000Z",
      commitSha: "abc123",
      version: "9.9.9",
      env: {},
    });

    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(manifest).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        productName: "SWARMSY Desktop",
        version: "9.9.9",
        buildDate: "2026-06-04T00:00:00.000Z",
        commitSha: "abc123",
        artifactSHA256: sha256File(artifactPath),
        installerSHA256: sha256File(installerPath),
        signingStatus: "signing_unavailable",
      })
    );
    expect(manifest.artifacts.desktopZip.sha256).toBe(manifest.artifactSHA256);
    expect(manifest.artifacts.installerExe.sha256).toBe(manifest.installerSHA256);
  });

  it("validates a manifest for untampered artifacts", () => {
    createReleaseManifest({
      artifactPath,
      installerPath,
      outputPath: manifestPath,
      buildDate: "2026-06-04T00:00:00.000Z",
      commitSha: "abc123",
      version: "9.9.9",
      env: {},
    });

    expect(() => validateReleaseIntegrity({ manifestPath })).not.toThrow();
  });

  it("fails validation when the desktop artifact is tampered", () => {
    createReleaseManifest({
      artifactPath,
      installerPath,
      outputPath: manifestPath,
      buildDate: "2026-06-04T00:00:00.000Z",
      commitSha: "abc123",
      version: "9.9.9",
      env: {},
    });
    fs.appendFileSync(artifactPath, "tampered");

    expect(() => validateReleaseIntegrity({ manifestPath })).toThrow(
      "Desktop artifact zip SHA256 does not match release manifest."
    );
  });

  it("fails validation when the installer is missing", () => {
    createReleaseManifest({
      artifactPath,
      installerPath,
      outputPath: manifestPath,
      buildDate: "2026-06-04T00:00:00.000Z",
      commitSha: "abc123",
      version: "9.9.9",
      env: {},
    });
    fs.rmSync(installerPath, { force: true });

    expect(() => validateReleaseIntegrity({ manifestPath })).toThrow(
      "Desktop installer exe is missing"
    );
  });

  it("keeps release integrity scripts isolated from Hosted/Admin, backup, and diagnostics behavior", () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const installerWorkflow = fs.readFileSync(installerWorkflowPath, "utf8");

    expect(packageJson.scripts["desktop:release:manifest"]).toBe(
      "node desktop/scripts/generate-release-manifest.cjs"
    );
    expect(packageJson.scripts["desktop:release:validate"]).toBe(
      "node desktop/scripts/validate-release-integrity.cjs"
    );
    expect(installerWorkflow).toContain("Run desktop diagnostics tests");
    expect(installerWorkflow).toContain("Run desktop backup tests");
    expect(installerWorkflow).toContain("Package desktop app artifact");
    expect(installerWorkflow).toContain("Build Windows installer");
    expect(installerWorkflow).not.toMatch(/hosted|admin|auto-update/i);
  });
});
