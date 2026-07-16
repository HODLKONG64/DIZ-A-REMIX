const fs = require("fs");
const path = require("path");

const scriptPath = path.resolve(
  __dirname,
  "../../../desktop/scripts/smoke-installed-windows.ps1"
);

function scriptSource() {
  return fs.readFileSync(scriptPath, "utf8");
}

describe("installed Windows runtime smoke diagnostics", () => {
  it("keeps installer cleanup wired to the installed uninstaller", () => {
    const source = scriptSource();

    expect(source).toContain(
      '$uninstallerPath = Join-Path $installRoot "Uninstall SWARMSY Desktop.exe"'
    );
    expect(source).toContain("Test-Path -LiteralPath $uninstallerPath");
    expect(source).toContain("Start-Process -FilePath $uninstallerPath");
  });

  it("validates the actual installed runtime payload before launch", () => {
    const source = scriptSource();

    expect(source).toContain("start-local-runtime.cjs");
    expect(source).toContain("resources\\app\\server\\index.js");
    expect(source).toContain("Installed runtime entrypoint is missing");
    expect(source).toContain("Installed server entrypoint is missing");
    expect(source).toContain("server-node-modules.tar.gz");
  });

  it("uses a generous first-run window with frequent retries", () => {
    const source = scriptSource();

    expect(source).toContain(
      '$env:SWARMSY_RUNTIME_SMOKE_TIMEOUT_MS = "600000"'
    );
    expect(source).toContain(
      '$env:SWARMSY_RUNTIME_SMOKE_RETRY_MS = "1000"'
    );
  });

  it("prints installed payload, cache, process and smoke data diagnostics on failure", () => {
    const source = scriptSource();
    const failureIndex = source.indexOf("if ($LASTEXITCODE -ne 0)");
    const diagnosticsIndex = source.indexOf(
      "Write-InstalledRuntimeDiagnostics -InstallRoot $installRoot",
      failureIndex
    );

    expect(source).toContain("function Write-InstalledRuntimeDiagnostics");
    expect(source).toContain("installed runtime tree (depth 2)");
    expect(source).toContain("installed server tree (depth 2)");
    expect(source).toContain("runtime dependency cache (depth 2)");
    expect(source).toContain("recent smoke data and logs");
    expect(source).toContain("Get-CimInstance Win32_Process");
    expect(diagnosticsIndex).toBeGreaterThan(failureIndex);
  });
});
