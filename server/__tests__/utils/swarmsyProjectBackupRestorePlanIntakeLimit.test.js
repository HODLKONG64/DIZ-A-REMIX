const {
  buildProjectBackupRestorePlan,
} = require("../../utils/swarmsy/projectBackupRestorePlan");

describe("SWARMSY project backup restore plan intake limits", () => {
  it("blocks hand-edited version 1 backups with multiple intake sessions", () => {
    const plan = buildProjectBackupRestorePlan({
      backup: {
        data: {
          intakeSessions: [
            { sourceId: 1, mode: "face", currentStep: 1, answers: {} },
            { sourceId: 2, mode: "hidden", currentStep: 2, answers: {} },
          ],
          identityIdeas: [],
          memoryLocks: [],
          proofReviews: [],
        },
      },
      destination: {
        activeSession: null,
        identityIdeas: [],
        memoryLocks: [],
        proofReviews: [],
      },
    });

    expect(plan.blocked).toBe(true);
    expect(plan.sections.intakeSessions.create).toBe(0);
    expect(plan.sections.intakeSessions.conflicts).toEqual([
      expect.objectContaining({
        code: "multiple_intake_sessions_unsupported",
      }),
    ]);
    expect(plan.restoreApplied).toBe(false);
  });
});
