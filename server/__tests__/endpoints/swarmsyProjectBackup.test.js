const mockRoleMiddleware = jest.fn();

jest.mock("../../utils/http", () => ({
  userFromSession: jest.fn(),
  reqBody: jest.fn((request) => request.body || {}),
}));

jest.mock("../../models/workspace", () => ({
  Workspace: {
    get: jest.fn(),
    getWithUser: jest.fn(),
  },
}));

jest.mock("../../models/swarmsyMemoryLock", () => ({
  SwarmsyMemoryLock: { forUserWorkspace: jest.fn() },
}));

jest.mock("../../models/swarmsyProofReview", () => ({
  SwarmsyProofReview: { forUserWorkspace: jest.fn() },
}));

jest.mock("../../models/swarmsyIdentityIdea", () => ({
  SwarmsyIdentityIdea: { forUserWorkspace: jest.fn() },
}));

jest.mock("../../models/swarmsyIntakeSession", () => ({
  SwarmsyIntakeSession: { activeForUserWorkspace: jest.fn() },
}));

jest.mock("../../utils/middleware/validatedRequest", () => ({
  validatedRequest: jest.fn(),
}));

jest.mock("../../utils/middleware/multiUserProtected", () => ({
  ROLES: {
    all: "<all>",
    admin: "admin",
    manager: "manager",
  },
  flexUserRoleValid: jest.fn(() => mockRoleMiddleware),
}));

const { userFromSession } = require("../../utils/http");
const { Workspace } = require("../../models/workspace");
const { SwarmsyMemoryLock } = require("../../models/swarmsyMemoryLock");
const { SwarmsyProofReview } = require("../../models/swarmsyProofReview");
const { SwarmsyIdentityIdea } = require("../../models/swarmsyIdentityIdea");
const { SwarmsyIntakeSession } = require("../../models/swarmsyIntakeSession");
const { validatedRequest } = require("../../utils/middleware/validatedRequest");
const {
  ROLES,
  flexUserRoleValid,
} = require("../../utils/middleware/multiUserProtected");
const {
  registerSwarmsyProjectBackupEndpoints,
  swarmsyProjectBackupExport,
  swarmsyProjectBackupValidate,
} = require("../../endpoints/swarmsyProjectBackup");

function responseMock() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("SWARMSY project backup endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers authenticated export and validation routes", () => {
    const app = { get: jest.fn(), post: jest.fn() };

    registerSwarmsyProjectBackupEndpoints(app);

    expect(flexUserRoleValid).toHaveBeenCalledTimes(2);
    expect(flexUserRoleValid).toHaveBeenCalledWith([ROLES.all]);
    expect(app.get).toHaveBeenCalledWith(
      "/swarmsy/workspaces/:slug/project-backup/export",
      [validatedRequest, mockRoleMiddleware],
      swarmsyProjectBackupExport
    );
    expect(app.post).toHaveBeenCalledWith(
      "/swarmsy/project-backup/validate",
      [validatedRequest, mockRoleMiddleware],
      swarmsyProjectBackupValidate
    );
  });

  it("exports only the authenticated user's accessible workspace records", async () => {
    userFromSession.mockResolvedValue({ id: 12, role: "default" });
    Workspace.getWithUser.mockResolvedValue({
      id: 9,
      slug: "swarmsy-hive",
      name: "SWARMSY HIVE",
    });
    SwarmsyIntakeSession.activeForUserWorkspace.mockResolvedValue({
      id: 1,
      workspaceId: 9,
      userId: 12,
      mode: "hidden",
      answers: { goal: "privacy" },
    });
    SwarmsyIdentityIdea.forUserWorkspace.mockResolvedValue([
      { id: 2, workspaceId: 9, userId: 12, title: "Identity" },
    ]);
    SwarmsyMemoryLock.forUserWorkspace.mockResolvedValue([
      { id: 3, workspaceId: 9, userId: 12, content: "Lock" },
    ]);
    SwarmsyProofReview.forUserWorkspace.mockResolvedValue([
      { id: 4, workspaceId: 9, userId: 12, content: "Proof" },
    ]);
    const response = responseMock();

    await swarmsyProjectBackupExport(
      { params: { slug: "swarmsy-hive" } },
      response
    );

    expect(Workspace.getWithUser).toHaveBeenCalledWith(
      { id: 12, role: "default" },
      { slug: "swarmsy-hive" }
    );
    expect(SwarmsyIdentityIdea.forUserWorkspace).toHaveBeenCalledWith({
      userId: 12,
      workspaceId: 9,
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        restoreAvailable: false,
        backup: expect.objectContaining({
          schema: "swarmsy_project_backup",
          workspace: expect.objectContaining({ slug: "swarmsy-hive" }),
        }),
      })
    );
    const payload = response.json.mock.calls[0][0];
    expect(payload.backup.data.identityIdeas[0]).not.toHaveProperty("userId");
    expect(payload.backup.data.identityIdeas[0]).not.toHaveProperty(
      "workspaceId"
    );
  });

  it("does not export an inaccessible workspace", async () => {
    userFromSession.mockResolvedValue({ id: 12, role: "default" });
    Workspace.getWithUser.mockResolvedValue(null);
    const response = responseMock();

    await swarmsyProjectBackupExport(
      { params: { slug: "other-workspace" } },
      response
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(SwarmsyMemoryLock.forUserWorkspace).not.toHaveBeenCalled();
  });

  it("validates without applying restore writes", async () => {
    userFromSession.mockResolvedValue({ id: 12, role: "default" });
    const response = responseMock();

    await swarmsyProjectBackupValidate(
      { body: { backup: { schema: "wrong" } } },
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        valid: false,
        restoreAvailable: false,
        summary: expect.objectContaining({ restoreApplied: false }),
      })
    );
  });
});
