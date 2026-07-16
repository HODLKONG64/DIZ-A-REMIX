const mockAttachLocalSwarmsyOwner = jest.fn();

jest.mock("../../models/systemSettings", () => ({
  SystemSettings: { isMultiUserMode: jest.fn() },
}));
jest.mock("../../utils/http", () => ({
  userFromSession: jest.fn(),
}));
jest.mock("../../utils/swarmsy/dataOwner", () => ({
  attachLocalSwarmsyOwner: mockAttachLocalSwarmsyOwner,
}));

const { SystemSettings } = require("../../models/systemSettings");
const { userFromSession } = require("../../utils/http");
const {
  ROLES,
  flexUserRoleValid,
} = require("../../utils/middleware/multiUserProtected");

function responseMock(locals = {}) {
  return {
    locals,
    sendStatus: jest.fn().mockReturnThis(),
    end: jest.fn(),
  };
}

describe("SWARMSY Local User owner middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("attaches the Local User owner before all-role persistence handlers", async () => {
    SystemSettings.isMultiUserMode.mockResolvedValue(false);
    const request = {
      originalUrl: "/api/swarmsy/workspaces/hive/identity-ideas",
    };
    const response = responseMock();
    const next = jest.fn();

    await flexUserRoleValid([ROLES.all])(request, response, next);

    expect(mockAttachLocalSwarmsyOwner).toHaveBeenCalledWith(request, response);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not attach a Local User owner in multi-user mode", async () => {
    const request = {
      originalUrl: "/api/swarmsy/workspaces/hive/memory-locks",
    };
    const response = responseMock({ multiUserMode: true });
    const next = jest.fn();

    await flexUserRoleValid([ROLES.all])(request, response, next);

    expect(mockAttachLocalSwarmsyOwner).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("preserves existing role checks for restricted multi-user routes", async () => {
    userFromSession.mockResolvedValue({ id: 12, role: "default" });
    const request = { originalUrl: "/api/admin/example" };
    const response = responseMock({ multiUserMode: true });
    const next = jest.fn();

    await flexUserRoleValid([ROLES.admin])(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.sendStatus).toHaveBeenCalledWith(401);
    expect(mockAttachLocalSwarmsyOwner).not.toHaveBeenCalled();
  });

  it("keeps unrelated single-user routes unchanged", async () => {
    SystemSettings.isMultiUserMode.mockResolvedValue(false);
    const request = { originalUrl: "/api/system/status" };
    const response = responseMock();
    const next = jest.fn();

    await flexUserRoleValid([ROLES.all])(request, response, next);

    expect(mockAttachLocalSwarmsyOwner).toHaveBeenCalledWith(request, response);
    expect(next).toHaveBeenCalledTimes(1);
  });
});