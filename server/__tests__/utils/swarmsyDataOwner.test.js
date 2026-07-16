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
  resolveSwarmsyDataOwner,
} = require("../../utils/swarmsy/dataOwner");

describe("SWARMSY data owner resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("preserves an authenticated multi-user owner", async () => {
    userFromSession.mockResolvedValue({ id: 12, role: "default" });

    await expect(
      resolveSwarmsyDataOwner({}, { locals: { multiUserMode: true } })
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
      expect.objectContaining({ userId: 77, isLocalUser: true })
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

  it("does not invent an owner for unauthenticated multi-user requests", async () => {
    userFromSession.mockResolvedValue(null);
    SystemSettings.isMultiUserMode.mockResolvedValue(true);

    await expect(
      resolveSwarmsyDataOwner({}, { locals: {} })
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

    await expect(
      resolveSwarmsyDataOwner({}, { locals: {} })
    ).rejects.toThrow("Reserved SWARMSY Local User owner is not suspended.");
    expect(mockPrisma.users.create).not.toHaveBeenCalled();
  });
});
