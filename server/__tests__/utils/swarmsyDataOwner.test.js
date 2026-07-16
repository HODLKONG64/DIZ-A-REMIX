const mockPrisma = {
  users: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock("../../utils/prisma", () => mockPrisma);
jest.mock("../../utils/http", () => ({
  userFromSession: jest.fn(),
}));
jest.mock("../../models/systemSettings", () => ({
  SystemSettings: { isMultiUserMode: jest.fn() },
}));
jest.mock("../../models/user", () => ({
  User: {
    filterFields: jest.fn((user) => {
      const { password: _password, ...safe } = user;
      return safe;
    }),
  },
}));

const { userFromSession } = require("../../utils/http");
const { SystemSettings } = require("../../models/systemSettings");
const {
  LOCAL_SWARMSY_OWNER_USERNAME,
  attachLocalSwarmsyOwner,
  isSwarmsyPersistenceRequest,
  resolveSwarmsyDataOwner,
} = require("../../utils/swarmsy/dataOwner");

describe("SWARMSY data owner resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("preserves an authenticated multi-user owner", async () => {
    userFromSession.mockResolvedValue({ id: 12, role: "default" });

    await expect(
      resolveSwarmsyDataOwner({}, { locals: { multiUserMode: true } }),
    ).resolves.toEqual({
      user: { id: 12, role: "default" },
      userId: 12,
      isLocalUser: false,
    });
    expect(mockPrisma.users.findUnique).not.toHaveBeenCalled();
  });

  it("creates a suspended non-login owner for Local User mode", async () => {
    userFromSession.mockResolvedValue(null);
    SystemSettings.isMultiUserMode.mockResolvedValue(false);
    mockPrisma.users.findUnique.mockResolvedValue(null);
    mockPrisma.users.create.mockImplementation(async ({ data }) => ({
      id: 77,
      ...data,
    }));

    const owner = await resolveSwarmsyDataOwner({}, { locals: {} });

    expect(owner).toEqual(
      expect.objectContaining({ userId: 77, isLocalUser: true }),
    );
    expect(mockPrisma.users.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: LOCAL_SWARMSY_OWNER_USERNAME,
        role: "default",
        suspended: 1,
      }),
    });
    expect(owner.user).not.toHaveProperty("password");
  });

  it("recognises only the durable SWARMSY persistence route families", () => {
    expect(
      isSwarmsyPersistenceRequest({
        originalUrl: "/api/swarmsy/workspaces/hive/memory-locks/7",
      }),
    ).toBe(true);
    expect(
      isSwarmsyPersistenceRequest({
        originalUrl: "/api/swarmsy/workspaces/hive/proof-reviews/import",
      }),
    ).toBe(true);
    expect(
      isSwarmsyPersistenceRequest({
        originalUrl: "/api/swarmsy/workspaces/hive/identity-ideas/propose",
      }),
    ).toBe(true);
    expect(
      isSwarmsyPersistenceRequest({
        originalUrl: "/api/swarmsy/workspaces/hive/intake-session/4/progress",
      }),
    ).toBe(true);
    expect(
      isSwarmsyPersistenceRequest({
        originalUrl: "/api/swarmsy/workspaces/hive/project-backup/export",
      }),
    ).toBe(false);
    expect(
      isSwarmsyPersistenceRequest({ originalUrl: "/api/workspace/hive" }),
    ).toBe(false);
  });

  it("attaches a privileged request view without changing the stored owner", async () => {
    mockPrisma.users.findUnique.mockResolvedValue({
      id: 77,
      username: LOCAL_SWARMSY_OWNER_USERNAME,
      role: "default",
      suspended: 1,
      password: "hidden",
    });
    const response = { locals: {} };

    const attached = await attachLocalSwarmsyOwner(
      { originalUrl: "/api/swarmsy/workspaces/hive/memory-locks" },
      response,
    );

    expect(attached).toEqual(
      expect.objectContaining({
        id: 77,
        username: LOCAL_SWARMSY_OWNER_USERNAME,
        role: "admin",
      }),
    );
    expect(attached).not.toHaveProperty("password");
    expect(response.locals.swarmsyLocalUserOwner).toBe(true);
    expect(mockPrisma.users.create).not.toHaveBeenCalled();
  });

  it("does not attach the owner to unrelated routes", async () => {
    const response = { locals: {} };

    await expect(
      attachLocalSwarmsyOwner(
        { originalUrl: "/api/swarmsy/onboarding/status" },
        response,
      ),
    ).resolves.toBeNull();
    expect(response.locals.user).toBeUndefined();
    expect(mockPrisma.users.findUnique).not.toHaveBeenCalled();
  });

  it("does not invent an owner for unauthenticated multi-user requests", async () => {
    userFromSession.mockResolvedValue(null);
    SystemSettings.isMultiUserMode.mockResolvedValue(true);

    await expect(
      resolveSwarmsyDataOwner({}, { locals: {} }),
    ).resolves.toBeNull();
    expect(mockPrisma.users.create).not.toHaveBeenCalled();
  });

  it("rejects a non-suspended account using the reserved owner name", async () => {
    userFromSession.mockResolvedValue(null);
    SystemSettings.isMultiUserMode.mockResolvedValue(false);
    mockPrisma.users.findUnique.mockResolvedValue({
      id: 5,
      username: LOCAL_SWARMSY_OWNER_USERNAME,
      suspended: 0,
    });

    await expect(resolveSwarmsyDataOwner({}, { locals: {} })).rejects.toThrow(
      "Reserved SWARMSY Local User owner is not suspended.",
    );
    expect(mockPrisma.users.create).not.toHaveBeenCalled();
  });
});
