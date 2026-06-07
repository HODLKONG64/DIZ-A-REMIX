process.env.STORAGE_DIR = "test-storage";
jest.mock("../../../models/documents", () => ({
  Document: {
    where: jest.fn(),
  },
}));

const { Document } = require("../../../models/documents");
const {
  buildIdentityEmpireRetrievalPlan,
  getWorkspaceIdentityEmpireFiles,
  resolveSparkyMode,
} = require("../../../utils/swarmsy/identityEmpireRetrieval");

function identityEmpireDoc(workspaceId, file) {
  return {
    workspaceId,
    metadata: JSON.stringify({
      chunkSource: `sparky-wiki-seed-pack://identity-empire/${file}`,
      sparkyWikiSeedPack: "identity-empire",
      sparkyWikiSeedPackFile: file,
      localFirst: true,
      optionalReferenceKnowledge: true,
    }),
  };
}

describe("Identity Empire retrieval planning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("detects imported Identity Empire docs only inside the current workspace", async () => {
    Document.where.mockImplementation(async (clause) =>
      clause.workspaceId === 101
        ? [identityEmpireDoc(101, "03_brand_foundation_builder.md")]
        : []
    );

    await expect(
      getWorkspaceIdentityEmpireFiles({ id: 101, slug: "workspace-a" })
    ).resolves.toEqual(new Set(["03_brand_foundation_builder.md"]));
    await expect(
      getWorkspaceIdentityEmpireFiles({ id: 202, slug: "workspace-b" })
    ).resolves.toEqual(new Set());
    expect(Document.where).toHaveBeenCalledWith(
      { workspaceId: 101 },
      null,
      null,
      null,
      { metadata: true }
    );
    expect(Document.where).toHaveBeenCalledWith(
      { workspaceId: 202 },
      null,
      null,
      null,
      { metadata: true }
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [
      "Face Identity Mode",
      "Start my SWARMSY intake in Face Identity Mode. Build my public founder story and PR angle.",
      [
        "03_brand_foundation_builder.md",
        "04_story_myth_and_manifesto.md",
        "07_pr_and_press_machine.md",
      ],
      "public identity",
    ],
    [
      "Hidden Identity Mode",
      "Start my SWARMSY intake in Hidden Identity Mode. Build an alias/pseudonym-safe campaign.",
      [
        "02_no_idea_user_intake.md",
        "04_story_myth_and_manifesto.md",
        "06_campaign_builder.md",
      ],
      "pseudonym safety",
    ],
    [
      "Existing Project",
      "Help me import an Existing Project, audit weak positioning, rebuild my offer, and relaunch.",
      [
        "03_brand_foundation_builder.md",
        "06_campaign_builder.md",
        "13_30_day_identity_empire_launch.md",
      ],
      "existing project audit",
    ],
    [
      "Load Memory Lock",
      "Continue this SWARMSY project from the memory lock and create my 30-day launch plan.",
      ["13_30_day_identity_empire_launch.md"],
      "without overwriting existing user identity",
    ],
  ])(
    "builds a %s retrieval query with mode-aware Identity Empire sections",
    async (_mode, prompt, expectedFiles, expectedFocus) => {
      Document.where.mockResolvedValue([
        identityEmpireDoc(101, "IDENTITY_EMPIRE_INDEX.md"),
        identityEmpireDoc(101, "01_identity_operating_system.md"),
        identityEmpireDoc(101, "02_no_idea_user_intake.md"),
        identityEmpireDoc(101, "03_brand_foundation_builder.md"),
        identityEmpireDoc(101, "04_story_myth_and_manifesto.md"),
        identityEmpireDoc(101, "06_campaign_builder.md"),
        identityEmpireDoc(101, "07_pr_and_press_machine.md"),
        identityEmpireDoc(101, "13_30_day_identity_empire_launch.md"),
      ]);

      const plan = await buildIdentityEmpireRetrievalPlan({
        workspace: { id: 101, slug: "workspace-a" },
        prompt,
      });

      expect(plan.available).toBe(true);
      expect(plan.status).toBe("Using local wiki knowledge");
      expect(plan.mode).toBe(resolveSparkyMode({ prompt }));
      expect(plan.retrievalInput).toContain(
        "Use as supporting knowledge only; keep the existing Sparky intake/memory flow primary."
      );
      expect(plan.retrievalInput).toContain(expectedFocus);
      expectedFiles.forEach((file) => {
        expect(plan.sections.map((section) => section.file)).toContain(file);
        expect(plan.retrievalInput).toContain(file);
      });
      expect(global.fetch).not.toHaveBeenCalled();
    }
  );

  it("leaves Sparky on the existing intake path when no pack is imported", async () => {
    Document.where.mockResolvedValue([]);

    const prompt = "Build my identity empire from nothing.";
    const plan = await buildIdentityEmpireRetrievalPlan({
      workspace: { id: 202, slug: "workspace-b" },
      prompt,
    });

    expect(plan.available).toBe(false);
    expect(plan.status).toBe("No Identity Empire knowledge added yet");
    expect(plan.sections).toEqual([]);
    expect(plan.retrievalInput).toBe(prompt);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
