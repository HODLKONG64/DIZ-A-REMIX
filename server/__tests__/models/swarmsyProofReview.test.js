const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};
const mockTransaction = {
  $executeRawUnsafe: jest.fn(),
  $queryRawUnsafe: jest.fn(),
};

jest.mock("../../utils/prisma", () => mockPrisma);

const { SwarmsyProofReview } = require("../../models/swarmsyProofReview");

describe("SwarmsyProofReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.$executeRawUnsafe.mockResolvedValue(1);
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockTransaction)
    );
  });

  it("lists active user proof reviews for a workspace without same-workspace leakage", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: 1,
        workspace_id: 9,
        user_id: 12,
        is_active: true,
        version: 2,
        source: "pasted",
        content: "PROOF",
        archived_at: null,
        created_at: new Date("2026-07-12T00:00:00.000Z"),
        updated_at: new Date("2026-07-12T00:00:00.000Z"),
      },
    ]);

    await expect(
      SwarmsyProofReview.forUserWorkspace({ userId: 12, workspaceId: 9 })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        workspaceId: 9,
        userId: 12,
        isActive: true,
        version: 2,
        content: "PROOF",
      }),
    ]);

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("WHERE workspace_id = ?"),
      9,
      12
    );
  });

  it("creates a new active proof review version scoped to both user and workspace", async () => {
    mockTransaction.$queryRawUnsafe
      .mockResolvedValueOnce([{ version: 4 }])
      .mockResolvedValueOnce([{ id: 10 }]);
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        id: 10,
        workspace_id: 9,
        user_id: 12,
        is_active: true,
        version: 5,
        source: "pasted",
        content: "PROOF",
        archived_at: null,
        created_at: new Date("2026-07-12T00:00:00.000Z"),
        updated_at: new Date("2026-07-12T00:00:00.000Z"),
      },
    ]);

    const { review, message } = await SwarmsyProofReview.create({
      userId: 12,
      workspaceId: 9,
      content: "PROOF",
      source: "pasted",
      isActive: true,
    });

    expect(message).toBeNull();
    expect(review).toEqual(
      expect.objectContaining({
        id: 10,
        workspaceId: 9,
        userId: 12,
        version: 5,
        isActive: true,
        source: "pasted",
        content: "PROOF",
      })
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SELECT version"),
      9,
      12
    );
    expect(mockTransaction.$executeRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO swarmsy_proof_reviews"),
      9,
      12,
      true,
      5,
      "pasted",
      "PROOF"
    );
  });

  it("rejects a missing user before querying or writing proof reviews", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { review, message } = await SwarmsyProofReview.create({
      workspaceId: 9,
      content: "PROOF",
    });

    expect(review).toBeNull();
    expect(message).toBe("userId is required.");
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("rejects empty imported Proof Review content", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { review, message } = await SwarmsyProofReview.create({
      userId: 12,
      workspaceId: 9,
      content: " ",
    });

    expect(review).toBeNull();
    expect(message).toBe("Proof Review content is required.");
    consoleErrorSpy.mockRestore();
  });
});
