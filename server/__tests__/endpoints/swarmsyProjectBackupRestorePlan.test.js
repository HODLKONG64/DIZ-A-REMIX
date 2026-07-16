const mockRoleMiddleware = jest.fn();
const mockSingleUserMiddleware = jest.fn();

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

jest.mock("../../utils/swarmsy/projectBackup", () => ({
  buildSwarmsyProjectBackup: jest.fn(),
  validateSwarmsyProjectBackup: jest.fn(),
}));

jest.mock("../../utils/swarmsy/projectBackupReader", () => ({
  readProjectBackupSections: jest.fn(),
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
  isSingleUserMode: mockSingleUserMiddleware,
}));

const { userFromSession } = require("../../utils/http");
const { Workspace } = require("../../models/workspace");
const {
  validateSwarmsyProjectBackup,
} = require("../../utils/swarmsy/projectBackup");
const {
  readProjectBackupSections,
} = require("../../utils/swarmsy/projectBackupReader");
const { validatedRequest } = require("../../utils/middleware/validatedRequest");
const {
  isSingleUserMode,
} = require("../../utils/middleware/multiUserProtected");
const {
  registerSwarmsyProjectBackupEndpoints,
  swarmsyProjectBackupRestorePlan,
} = require("../../endpoints/swarmsyProjectBackup");

function responseMock() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("SWARMSY project backup restore planning endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers restore planning behind the Local User middleware", () => {
    const app = { get: jest.fn(), post: jest.fn() };

    registerSwarmsyProjectBackupEndpoints(app);

    expect(app.post).toHaveBeenCalledWith(
      "/swarmsy/workspaces/:slug/project-backup/restore-plan",
      [validatedRequest, isSingleUserMode],
      swarmsyProjectBackupRestorePlan
    );
  });

  it("returns a read-only conflict plan for an accessible workspace", async () => {
    const backup = {
      data: {
        intakeSessions: [],
        identityIdeas: [
          {
            sourceId: 2,
            mode: "hidden",
            title: "Identity",
            content: "New direction",
          },
        ],
        memoryLocks: [],
        proofReviews: [],
      },
    };
    userFromSession.mockResolvedValue({ id: 12, role: "default" });
    Workspace.getWithUser.mockResolvedValue({
      id: 9,
      slug: "swarmsy-hive",
      name: "SWARMSY HIVE",
    });
    validateSwarmsyProjectBackup.mockReturnValue({
      valid: true,
      errors: [],
      summary: { restoreApplied: false },
    });
    readProjectBackupSections.mockResolvedValue({
      activeSession: null,
      identityIdeas: [],
      memoryLocks: [],
      proofReviews: [],
    });
    const response = responseMock();

    await swarmsyProjectBackupRestorePlan(
      {
        params: { slug: "swarmsy-hive" },
        body: { backup },
      },
      response
    );

    expect(Workspace.getWithUser).toHaveBeenCalledWith(
      { id: 12, role: "default" },
      { slug: "swarmsy-hive" }
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        valid: true,
        restoreApplied: false,
        restoreAvailable: false,
        requiresConfirmation: true,
        blocked: false,
        summary: expect.objectContaining({ create: 1, conflicts: 0 }),
      })
    );
  });

  it("rejects invalid backups before reading destination records", async () => {
    userFromSession.mockResolvedValue({ id: 12, role: "default" });
    Workspace.getWithUser.mockResolvedValue({
      id: 9,
      slug: "swarmsy-hive",
      name: "SWARMSY HIVE",
    });
    validateSwarmsyProjectBackup.mockReturnValue({
      valid: false,
      errors: ["Unsupported project backup version."],
      summary: { restoreApplied: false },
    });
    const response = responseMock();

    await swarmsyProjectBackupRestorePlan(
      {
        params: { slug: "swarmsy-hive" },
        body: { backup: { schema: "wrong" } },
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(readProjectBackupSections).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        valid: false,
        restoreApplied: false,
        restoreAvailable: false,
      })
    );
  });
});
