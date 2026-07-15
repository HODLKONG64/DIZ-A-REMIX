const mockRoleMiddleware = jest.fn();
const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
};

jest.mock("../../utils/prisma", () => mockPrisma);

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
  SwarmsyMemoryLock: {
    publicLock: jest.fn((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      content: row.content,
      version: row.version,
      isActive: Boolean(row.is_active),
    })),
  },
}));

jest.mock("../../models/swarmsyProofReview", () => ({
  SwarmsyProofReview: {
    publicReview: jest.fn((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      content: row.content,
      version: row.version,
      isActive: Boolean(row.is_active),
    })),
  },
}));

jest.mock("../../models/swarmsyIdentityIdea", () => ({
  SwarmsyIdentityIdea: {
    publicIdea: jest.fn((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      status: row.status,
    })),
  },
}));

jest.mock("../../models/swarmsyIntakeSession", () => ({
  SwarmsyIntakeSession: {
    publicSession: jest.fn((row) =>
      row
        ? {
            id: row.id,
            workspaceId: row.workspace_id,
            userId: row.user_id,
            mode: row.mode,
            answers: JSON.parse(row.answers || "{}"),
          }
        : null
    ),
  },
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

function projectRows() {
  return [
    [
      {
        id: 1,
        workspace_id: 9,
        user_id: 12,
        mode: "hidden",
        answers: '{"goal":"privacy"}',
      },
    ],
    [
      {
        id: 2,
        workspace_id: 9,
        user_id: 12,
        title: "Identity",
        content: "Idea",
        status: "saved",
      },
    ],
    [
      {
        id: 3,
        workspace_id: 9,
        user_id: 12,
        content: "Lock",
        version: 1,
        is_active: true,
      },
    ],
    [
      {
        id: 4,
        workspace_id: 9,
        user_id: 12,
        content: "Proof",
        version: 1,
        is_active: true,
      },
    ],
  ];
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
    for (const rows of projectRows()) {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(rows);
    }
    const response = responseMock();

    await swarmsyProjectBackupExport(
      { params: { slug: "swarmsy-hive" } },
      response
    );

    expect(Workspace.getWithUser).toHaveBeenCalledWith(
      { id: 12, role: "default" },
      { slug: "swarmsy-hive" }
    );
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(4);
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("AND user_id = ?"),
      9,
      12
    );
    expect(response.status).toHaveBeenCalledWith(200);
    const payload = response.json.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        restoreAvailable: false,
        backup: expect.objectContaining({
          schema: "swarmsy_project_backup",
          workspace: expect.objectContaining({ slug: "swarmsy-hive" }),
        }),
      })
    );
    expect(payload.backup.data.identityIdeas[0]).not.toHaveProperty("userId");
    expect(payload.backup.data.identityIdeas[0]).not.toHaveProperty(
      "workspaceId"
    );
  });

  it("fails the whole export when any covered section cannot be read", async () => {
    userFromSession.mockResolvedValue({ id: 12, role: "default" });
    Workspace.getWithUser.mockResolvedValue({
      id: 9,
      slug: "swarmsy-hive",
      name: "SWARMSY HIVE",
    });
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("identity table unavailable"))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const response = responseMock();
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await swarmsyProjectBackupExport(
      { params: { slug: "swarmsy-hive" } },
      response
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message:
        "Project export failed because one or more project sections could not be read. No backup file was created.",
    });
    consoleErrorSpy.mockRestore();
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
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
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