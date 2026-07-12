const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};
const mockTransaction = {
  $executeRawUnsafe: jest.fn(),
  $queryRawUnsafe: jest.fn(),
};

jest.mock("../../utils/prisma", () => mockPrisma);

const { SwarmsyIdentityIdea } = require("../../models/swarmsyIdentityIdea");

describe("SwarmsyIdentityIdea", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.$executeRawUnsafe.mockResolvedValue(1);
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockTransaction)
    );
  });

  it("lists only non-deleted ideas for the owning user and workspace", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: 4,
        workspace_id: 9,
        user_id: 12,
        mode: "hidden",
        status: "kept",
        title: "The Quiet Signal",
        content: "A private identity built around selective proof.",
        approved_at: null,
        deleted_at: null,
        created_at: new Date("2026-07-12T00:00:00.000Z"),
        updated_at: new Date("2026-07-12T00:00:00.000Z"),
      },
    ]);

    await expect(
      SwarmsyIdentityIdea.forUserWorkspace({ userId: 12, workspaceId: 9 })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 4,
        workspaceId: 9,
        userId: 12,
        mode: "hidden",
        status: "kept",
        title: "The Quiet Signal",
      }),
    ]);

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("AND deleted_at IS NULL"),
      9,
      12
    );
  });

  it("creates a proposed identity idea inside the insert transaction", async () => {
    mockTransaction.$queryRawUnsafe.mockResolvedValueOnce([{ id: 5 }]);
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        id: 5,
        workspace_id: 9,
        user_id: 12,
        mode: "face",
        status: "proposed",
        title: "Visible Builder",
        content: "A public identity based on showing the work.",
        approved_at: null,
        deleted_at: null,
        created_at: new Date("2026-07-12T00:00:00.000Z"),
        updated_at: new Date("2026-07-12T00:00:00.000Z"),
      },
    ]);

    const { idea, message } = await SwarmsyIdentityIdea.createProposal({
      userId: 12,
      workspaceId: 9,
      mode: "face",
      title: "Visible Builder",
      content: "A public identity based on showing the work.",
    });

    expect(message).toBeNull();
    expect(idea).toEqual(
      expect.objectContaining({
        id: 5,
        userId: 12,
        workspaceId: 9,
        mode: "face",
        status: "proposed",
      })
    );
    expect(mockTransaction.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO swarmsy_identity_ideas"),
      9,
      12,
      "face",
      "Visible Builder",
      "A public identity based on showing the work."
    );
    expect(mockTransaction.$queryRawUnsafe).toHaveBeenCalledWith(
      "SELECT last_insert_rowid() AS id"
    );
  });

  it.each([
    ["keep", "kept"],
    ["save", "saved"],
    ["delete", "deleted"],
  ])("records the user's %s decision without leaving their scope", async (decision, status) => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        id: 5,
        workspace_id: 9,
        user_id: 12,
        mode: "face",
        status,
        title: "Visible Builder",
        content: "A public identity based on showing the work.",
        approved_at:
          status === "saved" ? new Date("2026-07-12T01:00:00.000Z") : null,
        deleted_at:
          status === "deleted" ? new Date("2026-07-12T01:00:00.000Z") : null,
        created_at: new Date("2026-07-12T00:00:00.000Z"),
        updated_at: new Date("2026-07-12T01:00:00.000Z"),
      },
    ]);

    const { idea, message } = await SwarmsyIdentityIdea.decide({
      id: 5,
      userId: 12,
      workspaceId: 9,
      decision,
    });

    expect(message).toBeNull();
    expect(idea.status).toBe(status);
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("AND user_id = ?"),
      status,
      status,
      status,
      5,
      9,
      12
    );
  });

  it("returns the same not-found result for missing and out-of-scope ideas", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

    await expect(
      SwarmsyIdentityIdea.decide({
        id: 5,
        userId: 12,
        workspaceId: 9,
        decision: "keep",
      })
    ).resolves.toEqual({
      idea: null,
      message: "Identity Idea not found.",
    });
  });

  it("rejects missing ownership and empty proposal content before writing", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      SwarmsyIdentityIdea.createProposal({
        workspaceId: 9,
        mode: "face",
        title: "Idea",
        content: "Content",
      })
    ).resolves.toEqual({
      idea: null,
      message: "userId is required.",
    });

    await expect(
      SwarmsyIdentityIdea.createProposal({
        userId: 12,
        workspaceId: 9,
        mode: "face",
        title: "Idea",
        content: " ",
      })
    ).resolves.toEqual({
      idea: null,
      message: "Identity Idea content is required.",
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
