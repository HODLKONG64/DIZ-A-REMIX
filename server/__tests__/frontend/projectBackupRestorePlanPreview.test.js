const fs = require("fs");
const path = require("path");

const frontendRoot = path.resolve(__dirname, "../../../frontend/src");

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), "utf8");
}

describe("SWARMSY project backup plan preview", () => {
  it("uses the authenticated destination planning endpoint", () => {
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
    expect(helper).toContain('["Would add", summary.create || 0]');
    expect(helper).toContain(
      '["Exact duplicates", summary.skipDuplicate || 0]'
    );
    expect(helper).toContain('["Conflicts", summary.conflicts || 0]');
    expect(panel).toContain("Restore plan has conflicts");
    expect(panel).toContain("planSummary.map");
    expect(panel).toContain("conflicts.map");
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

  it("keeps the preview read-only", () => {
    const helper = read(
      "components/SwarmsyFirstRunOnboarding/projectBackup.js"
    );
    const panel = read(
      "components/SwarmsyFirstRunOnboarding/ProjectBackupPanel.jsx"
    );

    expect(helper).toContain("Restore is not enabled yet");
    expect(panel).toContain("Preview only. Restore remains unavailable");
  });
});
