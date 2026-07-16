const {
  buildProjectBackupRestorePlan,
} = require("../../utils/swarmsy/projectBackupRestorePlan");

function backupData(overrides = {}) {
  return {
    data: {
      intakeSessions: [],
      identityIdeas: [],
      memoryLocks: [],
      proofReviews: [],
      ...overrides,
    },
  };
}

function destination(overrides = {}) {
  return {
    activeSession: null,
    identityIdeas: [],
    memoryLocks: [],
    proofReviews: [],
    ...overrides,
  };
}

describe("SWARMSY project backup restore plan", () => {
  it("plans append-only records and never applies restore writes", () => {
    const plan = buildProjectBackupRestorePlan({
      backup: backupData({
        identityIdeas: [
          {
            sourceId: 2,
            mode: "hidden",
            title: "Quiet Signal",
            content: "A private identity.",
          },
        ],
      }),
      destination: destination(),
    });

    expect(plan).toEqual(
      expect.objectContaining({
        restoreApplied: false,
        restoreAvailable: false,
        requiresConfirmation: true,
        blocked: false,
        summary: expect.objectContaining({ create: 1, conflicts: 0 }),
      })
    );
    expect(plan.sections.identityIdeas.create).toBe(1);
  });

  it("skips exact duplicates instead of planning duplicate records", () => {
    const idea = {
      sourceId: 2,
      mode: "face",
      title: "Signal",
      content: "Existing identity content.",
    };
    const plan = buildProjectBackupRestorePlan({
      backup: backupData({ identityIdeas: [idea] }),
      destination: destination({
        identityIdeas: [{ id: 99, ...idea, sourceId: undefined }],
      }),
    });

    expect(plan.sections.identityIdeas).toEqual(
      expect.objectContaining({ create: 0, skipDuplicate: 1, conflicts: [] })
    );
    expect(plan.summary.skipDuplicate).toBe(1);
  });

  it("blocks different incoming intake progress when active progress exists", () => {
    const plan = buildProjectBackupRestorePlan({
      backup: backupData({
        intakeSessions: [
          {
            sourceId: 1,
            mode: "hidden",
            currentStep: 12,
            answers: { goal: "new direction" },
          },
        ],
      }),
      destination: destination({
        activeSession: {
          id: 7,
          mode: "hidden",
          currentStep: 4,
          answers: { goal: "existing direction" },
        },
      }),
    });

    expect(plan.blocked).toBe(true);
    expect(plan.sections.intakeSessions.conflicts).toEqual([
      expect.objectContaining({ code: "active_intake_exists", sourceId: 1 }),
    ]);
  });

  it("reports active version conflicts while preserving duplicate skips", () => {
    const plan = buildProjectBackupRestorePlan({
      backup: backupData({
        memoryLocks: [
          {
            sourceId: 3,
            source: "generated",
            content: "New approved truth",
            isActive: true,
          },
        ],
        proofReviews: [
          {
            sourceId: 4,
            source: "generated",
            content: "Existing proof",
            isActive: true,
          },
        ],
      }),
      destination: destination({
        memoryLocks: [
          {
            id: 30,
            source: "generated",
            content: "Current approved truth",
            isActive: true,
          },
        ],
        proofReviews: [
          {
            id: 40,
            source: "generated",
            content: "Existing proof",
            isActive: true,
          },
        ],
      }),
    });

    expect(plan.blocked).toBe(true);
    expect(plan.sections.memoryLocks.conflicts).toEqual([
      expect.objectContaining({ code: "active_Memory Lock_exists" }),
    ]);
    expect(plan.sections.proofReviews.skipDuplicate).toBe(1);
    expect(plan.sections.proofReviews.conflicts).toEqual([]);
  });
});
