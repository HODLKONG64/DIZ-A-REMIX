const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadDesktopDiagnosticsModule() {
  const source = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "../../../frontend/src/utils/desktopDiagnostics.js"
      ),
      "utf8"
    )
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");

  const script = new vm.Script(
    `${source}
module.exports = {
  DESKTOP_DIAGNOSTIC_CATALOG,
  DESKTOP_BRIDGE_REASON_TO_DIAGNOSTIC_CODE,
  getDiagnosticForCode,
  diagnosticFromResult,
};`
  );

  const sandbox = { module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  script.runInContext(sandbox);
  return sandbox.module.exports;
}

describe("desktop diagnostics bridge reason mapping", () => {
  const cases = [
    ["backup_file_symlink", "backup_file_symlink_rejected"],
    ["backup_path_invalid", "backup_directory_invalid"],
    ["backup_parse_failed", "backup_import_failed"],
    ["backup_validation_failed", "backup_import_failed"],
  ];

  it.each(cases)("maps %s to %s", (reason, expectedCode) => {
    const { diagnosticFromResult } = loadDesktopDiagnosticsModule();
    expect(diagnosticFromResult({ reason })?.code).toBe(expectedCode);
  });

  it("returns the fallback diagnostic for unknown reasons when fallbackCode is provided", () => {
    const { diagnosticFromResult } = loadDesktopDiagnosticsModule();
    expect(
      diagnosticFromResult(
        { reason: "unknown_desktop_bridge_reason" },
        "model_restore_failed"
      )?.code
    ).toBe("model_restore_failed");
  });

  it("returns null for unknown reasons without a fallback", () => {
    const { diagnosticFromResult } = loadDesktopDiagnosticsModule();
    expect(
      diagnosticFromResult({ reason: "unknown_desktop_bridge_reason" })
    ).toBeNull();
  });
});
