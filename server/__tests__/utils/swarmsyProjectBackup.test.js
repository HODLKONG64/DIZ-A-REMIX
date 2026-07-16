const {
  EXCLUDED_SECTIONS,
  INCLUDED_SECTIONS,
  PROJECT_BACKUP_SCHEMA,
  PROJECT_BACKUP_VERSION,
  buildSwarmsyProjectBackup,
  validateSwarmsyProjectBackup,
} = require("../../utils/swarmsy/projectBackup");

describe("SWARMSY project backup schema", () => {
  it("builds a portable allowlisted project snapshot", () => {
    const backup = buildSwarmsyProjectBackup({
      workspace: { id: 9, slug: "swarmsy-hive", name: "SWARMSY HIVE" },
      intakeSessions: [
        {
          id: 1,
          workspaceId: 9,
          userId: 12,
          version: 2,
          mode: "hidden",
          answers: { goal: "privacy" },
          ignoredField: "not exported",
        },
      ],
      identityIdeas: [
        {
          id: 2,
          workspaceId: 9,
          userId: 12,
          status: "saved",
          title: "Hidden signal",
          content: "Identity content",
        },
      ],
      memoryLocks: [{ id: 3, version: 1, content: "Approved truth" }],
      proofReviews: [{ id: 4, version: 1, content: "Proof gaps" }],
      exportedAt: "2026-07-16T00:00:00.000Z",
    });

    expect(backup).toMatchObject({
      schema: PROJECT_BACKUP_SCHEMA,
      version: PROJECT_BACKUP_VERSION,
      workspace: {
        sourceId: 9,
        slug: "swarmsy-hive",
        name: "SWARMSY HIVE",
      },
      coverage: {
        included: INCLUDED_SECTIONS,
        excluded: EXCLUDED_SECTIONS,
      },
    });
    expect(backup.data.intakeSessions[0]).toMatchObject({
      sourceId: 1,
      version: 2,
      mode: "hidden",
      answers: { goal: "privacy" },
    });
    expect(backup.data.intakeSessions[0]).not.toHaveProperty("userId");
    expect(backup.data.intakeSessions[0]).not.toHaveProperty("workspaceId");
    expect(backup.data.intakeSessions[0]).not.toHaveProperty("ignoredField");
  });

  it("validates a generated backup and reports dry-run counts", () => {
    const backup = buildSwarmsyProjectBackup({
      workspace: { id: 9, slug: "swarmsy-hive", name: "SWARMSY HIVE" },
      identityIdeas: [{ id: 2, title: "Identity", content: "Content" }],
      memoryLocks: [{ id: 3, content: "Lock" }],
      exportedAt: "2026-07-16T00:00:00.000Z",
    });

    expect(validateSwarmsyProjectBackup(backup)).toEqual({
      valid: true,
      errors: [],
      summary: {
        schema: PROJECT_BACKUP_SCHEMA,
        version: PROJECT_BACKUP_VERSION,
        workspaceSlug: "swarmsy-hive",
        counts: {
          intakeSessions: 0,
          identityIdeas: 1,
          memoryLocks: 1,
          proofReviews: 0,
        },
        restoreApplied: false,
      },
    });
  });

  it("rejects unknown record fields and false coverage claims", () => {
    const backup = buildSwarmsyProjectBackup({
      workspace: { id: 9, slug: "swarmsy-hive", name: "SWARMSY HIVE" },
      exportedAt: "2026-07-16T00:00:00.000Z",
    });
    backup.coverage.included = ["everything"];
    backup.data.identityIdeas.push({ sourceId: 1, unexpected: true });

    const result = validateSwarmsyProjectBackup(backup);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "coverage.included does not match version 1 coverage.",
        "Unknown field data.identityIdeas[0].unexpected.",
      ])
    );
    expect(result.summary.restoreApplied).toBe(false);
  });
});
