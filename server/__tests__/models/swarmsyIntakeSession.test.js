const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};
const mockTransaction = {
  $executeRawUnsafe: jest.fn(),
  $queryRawUnsafe: jest.fn(),
};

jest.mock("../../utils/prisma", () => mockPrisma);

const { SwarmsyIntakeSession } = require("../../models/swarmsyIntakeSession");

function row(overrides = {}) {
  return {
    id: 5,
    workspace_id: 9,
    user_id: 12,
    version: 1,
    mode: "hidden",
    status: "active",
    is_active: true,
    current_step: 2,
    answers: '{"goal":"build trust"}',
    completed_at: null,
    archived_at: null,
    created_at: new Date("2026-07-12T00:00:00.000Z"),
    updated_at: new Date("2026-07-12T01:00:00.000Z"),
    ...overrides,
  };
}

describe("SwarmsyIntakeSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockTransaction)
    );
  });

  it("loads active progress only for the owning user and workspace", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([row()]);

    await expect(
      SwarmsyIntakeSession.activeForUserWorkspace({
        userId: 12,
        workspaceId: 9,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 5,
        workspaceId: 9,
        userId: 12,
        currentStep: 2,
        answers: { goal: "build trust" },
      })
    );

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("AND user_id = ?"),
      9,
      12
    );
  });

  it("resumes an existing active session instead of duplicating it", async () => {
    mockTransaction.$queryRawUnsafe.mockResolvedValueOnce([row()]);

    const result = await SwarmsyIntakeSession.startOrResume({
      userId: 12,
      workspaceId: 9,
      mode: "hidden",
    });

    expect(result).toEqual(
      expect.objectContaining({
        resumed: true,
        session: expect.objectContaining({ id: 5, currentStep: 2 }),
      })
    );
    expect(mockTransaction.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("creates the next version inside one transaction when none is active", async () => {
    mockTransaction.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ version: 3 }])
      .mockResolvedValueOnce([{ id: 8 }])
      .mockResolvedValueOnce([
        row({ id: 8, version: 3, mode: "face", current_step: 0, answers: "{}" }),
      ]);
    mockTransaction.$executeRawUnsafe.mockResolvedValueOnce(1);

    const result = await SwarmsyIntakeSession.startOrResume({
      userId: 12,
      workspaceId: 9,
      mode: "face",
    });

    expect(result.session).toEqual(
      expect.objectContaining({ id: 8, version: 3, mode: "face" })
    );
    expect(result.resumed).toBe(false);
    expect(mockTransaction.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO swarmsy_intake_sessions"),
      9,
      12,
      3,
      "face"
    );
  });

  it("saves answers and question position without leaving ownership scope", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
      row({ current_step: 3, answers: '{"goal":"stay private"}' }),
    ]);

    const result = await SwarmsyIntakeSession.saveProgress({
      id: 5,
      userId: 12,
      workspaceId: 9,
      currentStep: 3,
      answers: { goal: "stay private" },
    });

    expect(result.session).toEqual(
      expect.objectContaining({
        currentStep: 3,
        answers: { goal: "stay private" },
      })
    );
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("AND user_id = ?"),
      3,
      '{"goal":"stay private"}',
      5,
      9,
      12
    );
  });

  it("completes only the owning user's active session", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
      row({ status: "completed", is_active: false, completed_at: new Date() }),
    ]);

    const result = await SwarmsyIntakeSession.complete({
      id: 5,
      userId: 12,
      workspaceId: 9,
    });

    expect(result.session).toEqual(
      expect.objectContaining({ status: "completed", isActive: false })
    );
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("AND user_id = ?"),
      5,
      9,
      12
    );
  });

  it("rejects missing ownership and invalid answers before writing", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      SwarmsyIntakeSession.startOrResume({
        workspaceId: 9,
        mode: "face",
      })
    ).resolves.toEqual({
      session: null,
      resumed: false,
      message: "userId is required.",
    });

    await expect(
      SwarmsyIntakeSession.saveProgress({
        id: 5,
        userId: 12,
        workspaceId: 9,
        currentStep: 1,
        answers: [],
      })
    ).resolves.toEqual({
      session: null,
      message: "answers must be an object.",
      errorCode: "INVALID_REQUEST",
    });

    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
