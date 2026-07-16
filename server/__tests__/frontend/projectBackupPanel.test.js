const fs = require("fs");
const path = require("path");

const frontendRoot = path.resolve(__dirname, "../../../frontend/src");

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), "utf8");
}

describe("SWARMSY project backup user surface", () => {
  it("uses authenticated project export and validation endpoints", () => {
    const helper = read(
      "components/SwarmsyFirstRunOnboarding/projectBackup.js"
    );

    expect(helper).toContain("baseHeaders()");
    expect(helper).toContain("/project-backup/export");
    expect(helper).toContain("/swarmsy/project-backup/validate");
    expect(helper).toContain('method: "POST"');
    expect(helper).toContain("JSON.stringify({ backup })");
  });

  it("downloads a portable JSON file with a stable project filename", () => {
    const helper = read(
      "components/SwarmsyFirstRunOnboarding/projectBackup.js"
    );

    expect(helper).toContain("application/json;charset=utf-8");
    expect(helper).toContain(".swarmsy-backup.json");
    expect(helper).toContain("URL.createObjectURL");
    expect(helper).toContain("URL.revokeObjectURL");
  });

  it("labels intake record counts accurately", () => {
    const helper = read(
      "components/SwarmsyFirstRunOnboarding/projectBackup.js"
    );

    expect(helper).toContain('["Intake Sessions", counts.intakeSessions || 0]');
    expect(helper).not.toContain('["Questions", counts.intakeSessions || 0]');
  });

  it("rejects oversized backup files before reading or uploading them", () => {
    const panel = read(
      "components/SwarmsyFirstRunOnboarding/ProjectBackupPanel.jsx"
    );

    expect(panel).toContain("MAX_PROJECT_BACKUP_FILE_BYTES");
    expect(panel).toContain("file.size > MAX_PROJECT_BACKUP_FILE_BYTES");
    expect(panel).toContain("larger than the 10 MB validation limit");
  });

  it("keeps restore disabled and validates without changing workspace data", () => {
    const helper = read(
      "components/SwarmsyFirstRunOnboarding/projectBackup.js"
    );
    const panel = read(
      "components/SwarmsyFirstRunOnboarding/ProjectBackupPanel.jsx"
    );

    expect(helper).toContain("Restore is not enabled yet");
    expect(panel).toContain("Check a backup file");
    expect(panel).toContain("No workspace data was changed.");
    expect(panel).not.toMatch(/restoreProject|applyRestore|importProjectBackup/);
  });

  it("shows backup controls only through the trusted Local User desktop bridge", () => {
    const returningHome = read(
      "components/SwarmsyFirstRunOnboarding/ReturningUserHome.jsx"
    );
    const dashboard = returningHome.indexOf("<ProjectDashboard");
    const backup = returningHome.indexOf("<ProjectBackupPanel");
    const proof = returningHome.indexOf("<ProofReviewHistoryPanel");

    expect(returningHome).toContain("hasDesktopLocalSettingsBridge");
    expect(returningHome).toContain(
      "const canUseLocalProjectBackup = hasDesktopLocalSettingsBridge();"
    );
    expect(returningHome).toContain("{canUseLocalProjectBackup && (");
    expect(dashboard).toBeGreaterThan(-1);
    expect(backup).toBeGreaterThan(dashboard);
    expect(proof).toBeGreaterThan(backup);
  });
});
