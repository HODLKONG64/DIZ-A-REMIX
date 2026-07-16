const fs = require("fs");
const path = require("path");

const frontendRoot = path.resolve(__dirname, "../../../frontend/src");

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), "utf8");
}

describe("SWARMSY project backup restore plan preview", () => {
  it("uses the authenticated destination restore-plan endpoint", () => {
    const helper = read(
      "components/SwarmsyFirstRunOnboarding/projectBackup.js"
    );

    expect(helper).toContain("planProjectBackupRestore");
    expect(helper).toContain("/project-backup/restore-plan");
    expect(helper).toContain('method: "POST"');
    expect(helper).toContain("JSON.stringify({ backup })");
  });

  it("shows additions, duplicate skips and conflicts", () => {
    const helper = read(
      "components/SwarmsyFirstRunOnboarding/projectBackup.js"
    );
    const panel = read(
      "components/SwarmsyFirstRunOnboarding/ProjectBackupPanel.jsx"
    );

    expect(helper).toContain("projectBackupRestorePlanSummary");
    expect(helper).toContain("projectBackupRestoreConflicts");
    expect(panel).toContain("Restore plan has conflicts");
    expect(panel).toContain("Would add");
    expect(panel).toContain("Exact duplicates");
    expect(panel).toContain("Conflicts");
  });

  it("plans only after validation succeeds", () => {
    const panel = read(
      "components/SwarmsyFirstRunOnboarding/ProjectBackupPanel.jsx"
    );
    const validationCheck = panel.indexOf("if (!validationResult?.valid) return;");
    const planCall = panel.indexOf(
      "await planProjectBackupRestore(workspaceSlug, parsed)"
    );

    expect(validationCheck).toBeGreaterThan(-1);
    expect(planCall).toBeGreaterThan(validationCheck);
  });

  it("does not expose a restore apply action", () => {
    const helper = read(
      "components/SwarmsyFirstRunOnboarding/projectBackup.js"
    );
    const panel = read(
      "components/SwarmsyFirstRunOnboarding/ProjectBackupPanel.jsx"
    );

    expect(helper).toContain("Restore is not enabled yet");
    expect(panel).toContain("Preview only. Restore remains unavailable");
    expect(panel).not.toMatch(/applyRestore|restoreProject|importProjectBackup/);
  });
});
