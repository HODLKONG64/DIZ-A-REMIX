const {
  buildDoctrineState,
  getNextAction,
  getSwarmsyOnboardingStatus,
  getWorkspaceState,
} = require("../../../utils/swarmsy/onboardingStatus");
const { Workspace } = require("../../../models/workspace");

jest.mock("../../../models/workspace", () => ({
  Workspace: {
    get: jest.fn(),
  },
}));

describe("swarmsy onboarding status helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const doctrineStatus = {
    success: true,
    docsRootAvailable: true,
    summary: {
      requiredMissing: 0,
      optionalMissing: 1,
    },
    groups: [
      {
        required: true,
        files: [
          {
            path: "docs/swarmsy/required-a.md",
            loadable: true,
          },
        ],
      },
      {
        required: false,
        files: [
          {
            path: "docs/swarmsy/optional-a.md",
            loadable: true,
          },
        ],
      },
    ],
  };

  it("returns setup-needed status when no HIVE workspace exists", async () => {
    Workspace.get.mockResolvedValue(null);

    const status = await getSwarmsyOnboardingStatus({
      user: { id: 44 },
      doctrineStatus,
    });

    expect(Workspace.get).toHaveBeenCalledWith({
      name: "SWARMSY HIVE",
      workspace_users: { some: { user_id: 44 } },
    });
    expect(status.workspace).toEqual({
      exists: false,
      state: "setup_needed",
      ready: false,
    });
    expect(status.nextAction.type).toBe("create_hive");
  });

  it("marks an existing HIVE as underloaded when doctrine is loadable but not attached", async () => {
    Workspace.get.mockResolvedValue({
      id: 7,
      slug: "swarmsy-hive",
      name: "SWARMSY HIVE",
      documents: [],
    });

    const status = await getSwarmsyOnboardingStatus({
      user: { id: 7 },
      doctrineStatus,
    });

    expect(status.workspace).toMatchObject({
      exists: true,
      id: 7,
      slug: "swarmsy-hive",
      name: "SWARMSY HIVE",
      state: "underloaded",
      ready: false,
    });
    expect(status.doctrine).toMatchObject({
      statusAvailable: true,
      requiredMissing: 0,
      optionalMissing: 1,
      requiredLoadable: 1,
      requiredAttached: 0,
      requiredPendingIngestion: 1,
      ingestionRequired: true,
    });
    expect(status.nextAction.type).toBe("continue_or_load_docs");
  });

  it("marks HIVE as ready only when required doctrine docs are already attached", async () => {
    Workspace.get.mockResolvedValue({
      id: 9,
      slug: "swarmsy-hive",
      name: "SWARMSY HIVE",
      documents: [
        {
          metadata: JSON.stringify({
            chunkSource: "swarmsy-required://docs/swarmsy/required-a.md",
          }),
        },
      ],
    });

    const status = await getSwarmsyOnboardingStatus({
      user: { id: 9 },
      doctrineStatus,
    });

    expect(status.workspace.state).toBe("ready");
    expect(status.workspace.ready).toBe(true);
    expect(status.doctrine.ingestionRequired).toBe(false);
    expect(status.nextAction.type).toBe("open_hive");
  });

  it("surfaces unavailable doctrine docs truthfully for an existing workspace", () => {
    const doctrine = buildDoctrineState(
      {
        success: true,
        docsRootAvailable: false,
        summary: {
          requiredMissing: 2,
          optionalMissing: 0,
        },
        groups: [],
      },
      {
        id: 1,
        documents: [],
      }
    );

    expect(doctrine).toMatchObject({
      statusAvailable: true,
      docsRootAvailable: false,
      requiredMissing: 2,
      ingestionRequired: false,
    });
    expect(doctrine.note).toContain("authorized setup route");
    expect(getWorkspaceState({ id: 1 }, doctrine)).toBe("underloaded");
    expect(getNextAction({ id: 1 }, doctrine).type).toBe(
      "authorized_setup_required"
    );
  });
});
