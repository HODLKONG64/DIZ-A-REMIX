jest.mock("../../../models/documents", () => ({
  Document: {
    addDocuments: jest.fn(),
    forWorkspace: jest.fn(),
  },
}));

jest.mock("../../../utils/collectorApi", () => ({
  CollectorApi: jest.fn(),
}));

const { Document } = require("../../../models/documents");
const { CollectorApi } = require("../../../utils/collectorApi");
const {
  CAMPAIGN_CASE_STUDIES_FILES,
  CULTURAL_PROTOCOLS_FILES,
  IDENTITY_EMPIRE_FILES,
  OFFLINE_WIKI_LEDGER_STANDARDS_FILES,
  WIKI_DEPTH_AND_PROVENANCE_FILES,
  discoverRelevantIdentityEmpireSections,
  discoverRelevantOptionalSeedPackSections,
  getSeedPackAbsoluteFilePath,
  getSparkyWikiSeedPack,
  importSparkyWikiSeedPack,
  isSafePackId,
  listSparkyWikiSeedPacks,
  parseSeedPackMetadata,
  validateSeedPackFiles,
  __resetSeedPackImportLocksForTests,
} = require("../../../utils/swarmsy/sparkyWikiSeedPacks");

describe("SPARKY Wiki seed pack registry", () => {
  let collector;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetSeedPackImportLocksForTests();
    Document.forWorkspace.mockResolvedValue([]);
    Document.addDocuments.mockResolvedValue({
      failedToEmbed: [],
      errors: [],
      embedded: ["custom-documents/seed-pack.json"],
    });
    collector = {
      online: jest.fn().mockResolvedValue(true),
      forwardExtensionRequest: jest.fn().mockImplementation(({ body }) => ({
        success: true,
        documents: [
          {
            location: `custom-documents/${body.metadata.sparkyWikiSeedPackFile}.json`,
          },
        ],
      })),
    };
    CollectorApi.mockImplementation(() => collector);
  });

  it("lists the pre-installed SPARKY Wiki seed packs", () => {
    const packs = listSparkyWikiSeedPacks();

    expect(packs.map((pack) => pack.id)).toEqual([
      "identity-empire",
      "offline-wiki-ledger-standards",
      "cultural-protocols",
      "campaign-case-studies",
      "wiki-depth-and-provenance",
    ]);
    expect(packs[0]).toMatchObject({
      id: "identity-empire",
      category: "identity empire seed pack",
      docsSpecOnly: true,
      sourcePath: "docs/swarmsy/sparky-wiki/seed-library/packs/identity-empire",
      importable: true,
    });
    expect(packs[0].includedFiles).toEqual([...IDENTITY_EMPIRE_FILES]);
    expect(packs[1]).toMatchObject({
      id: "offline-wiki-ledger-standards",
      category: "offline wiki ledger standards",
      draftImportable: true,
      importable: true,
    });
    expect(packs[2].includedFiles).toEqual([...CULTURAL_PROTOCOLS_FILES]);
    expect(packs[3].includedFiles).toEqual([...CAMPAIGN_CASE_STUDIES_FILES]);
    expect(packs[4].includedFiles).toEqual([
      ...WIKI_DEPTH_AND_PROVENANCE_FILES,
    ]);
    expect(
      packs.every((pack) =>
        pack.safetyBoundaries.join(" ").includes("No autonomous")
      )
    ).toBe(true);
  });

  it.each([
    ["identity-empire", IDENTITY_EMPIRE_FILES, "identity empire seed pack"],
    [
      "offline-wiki-ledger-standards",
      OFFLINE_WIKI_LEDGER_STANDARDS_FILES,
      "offline wiki ledger standards",
    ],
    ["cultural-protocols", CULTURAL_PROTOCOLS_FILES, "cultural protocols"],
    [
      "campaign-case-studies",
      CAMPAIGN_CASE_STUDIES_FILES,
      "campaign case studies",
    ],
    [
      "wiki-depth-and-provenance",
      WIKI_DEPTH_AND_PROVENANCE_FILES,
      "wiki depth and provenance",
    ],
  ])(
    "validates every expected %s file and metadata without crawling the repo",
    (packId, expectedFiles, expectedCategory) => {
      const validation = validateSeedPackFiles(packId);

      expect(validation.valid).toBe(true);
      expect(validation.files).toHaveLength(expectedFiles.length);
      expect(validation.errors).toEqual([]);
      for (const file of validation.files) {
        expect(file.frontmatter.title).toBeTruthy();
        expect(file.frontmatter.category).toBe(expectedCategory);
        if (packId !== "identity-empire") {
          expect(file.frontmatter.optional_reference_knowledge).toBeTruthy();
          expect(file.frontmatter.runtime_override).toBe("never");
        }
        expect(file.path).toBe(
          `docs/swarmsy/sparky-wiki/seed-library/packs/${packId}/${file.file}`
        );
        expect(file.byteLength).toBeGreaterThan(250);
      }
    }
  );

  it("rejects unknown pack ids and unsafe path traversal ids", () => {
    expect(getSparkyWikiSeedPack("unknown-pack")).toBeNull();
    expect(isSafePackId("../identity-empire")).toBe(false);
    expect(getSparkyWikiSeedPack("../identity-empire")).toBeNull();
    expect(validateSeedPackFiles("../identity-empire")).toMatchObject({
      valid: false,
      errorCode: "UNKNOWN_PACK",
    });
    expect(
      getSeedPackAbsoluteFilePath(
        getSparkyWikiSeedPack("identity-empire"),
        "../secret.md"
      )
    ).toBeNull();
    expect(
      getSeedPackAbsoluteFilePath(
        getSparkyWikiSeedPack("cultural-protocols"),
        "../BANKSY_STYLE_PUBLIC_SIGNAL_PROTOCOL.md"
      )
    ).toBeNull();
  });

  it("imports into one workspace, preserves metadata, and skips duplicate imports", async () => {
    const workspace = { id: 1, slug: "hive-a", name: "HIVE A" };

    const first = await importSparkyWikiSeedPack({
      workspace,
      packId: "identity-empire",
      userId: 12,
    });

    expect(first.success).toBe(true);
    expect(first.imported).toHaveLength(IDENTITY_EMPIRE_FILES.length);
    expect(collector.forwardExtensionRequest).toHaveBeenCalledTimes(
      IDENTITY_EMPIRE_FILES.length
    );
    expect(Document.addDocuments).toHaveBeenCalledTimes(
      IDENTITY_EMPIRE_FILES.length
    );
    expect(collector.forwardExtensionRequest.mock.calls[0][0]).toMatchObject({
      endpoint: "/process",
      method: "POST",
      body: {
        filename: "README.md",
        metadata: {
          docSource: "SPARKY Wiki seed pack: SPARKY Identity Empire",
          chunkSource: "sparky-wiki-seed-pack://identity-empire/README.md",
          sparkyWikiSeedPack: "identity-empire",
          localFirst: true,
          optionalReferenceKnowledge: true,
          autonomousRuntimeAgents: false,
        },
      },
    });

    Document.forWorkspace.mockResolvedValue(
      IDENTITY_EMPIRE_FILES.map((file) => ({
        workspaceId: 1,
        metadata: JSON.stringify({
          chunkSource: `sparky-wiki-seed-pack://identity-empire/${file}`,
        }),
      }))
    );
    collector.forwardExtensionRequest.mockClear();
    Document.addDocuments.mockClear();

    const second = await importSparkyWikiSeedPack({
      workspace,
      packId: "identity-empire",
      userId: 12,
    });

    expect(second.status).toBe("already_added");
    expect(second.imported).toEqual([]);
    expect(second.skipped).toHaveLength(IDENTITY_EMPIRE_FILES.length);
    expect(collector.forwardExtensionRequest).not.toHaveBeenCalled();
    expect(Document.addDocuments).not.toHaveBeenCalled();
  });

  it("keeps workspace A imports from bleeding into workspace B", async () => {
    const workspaceA = { id: 1, slug: "hive-a", name: "HIVE A" };
    const workspaceB = { id: 2, slug: "hive-b", name: "HIVE B" };

    Document.forWorkspace.mockImplementation(async (workspaceId) => {
      if (workspaceId === 1) {
        return IDENTITY_EMPIRE_FILES.map((file) => ({
          workspaceId,
          metadata: JSON.stringify({
            chunkSource: `sparky-wiki-seed-pack://identity-empire/${file}`,
          }),
        }));
      }
      return [];
    });

    const resultA = await importSparkyWikiSeedPack({
      workspace: workspaceA,
      packId: "identity-empire",
    });
    const resultB = await importSparkyWikiSeedPack({
      workspace: workspaceB,
      packId: "identity-empire",
    });

    expect(resultA.status).toBe("already_added");
    expect(resultB.status).toBe("added");
    expect(
      Document.addDocuments.mock.calls.every(
        ([workspace]) => workspace.id === 2
      )
    ).toBe(true);
  });

  it("rejects unsafe and unknown imports without collector or document writes", async () => {
    const workspace = { id: 1, slug: "hive-a", name: "HIVE A" };

    await expect(
      importSparkyWikiSeedPack({ workspace, packId: "../identity-empire" })
    ).resolves.toMatchObject({ success: false, errorCode: "UNSAFE_PACK_ID" });
    await expect(
      importSparkyWikiSeedPack({ workspace, packId: "unknown-pack" })
    ).resolves.toMatchObject({ success: false, errorCode: "UNKNOWN_PACK" });
    expect(collector.forwardExtensionRequest).not.toHaveBeenCalled();
    expect(Document.addDocuments).not.toHaveBeenCalled();
  });

  it("parses JSON metadata and keeps SOURCE_CARD_SCHEMA importable", () => {
    const validation = validateSeedPackFiles("offline-wiki-ledger-standards");
    const sourceCardSchema = validation.files.find(
      (file) => file.file === "SOURCE_CARD_SCHEMA.json"
    );

    expect(sourceCardSchema.frontmatter).toMatchObject({
      title: "Source Card Schema",
      category: "offline wiki ledger standards",
      runtime_override: "never",
    });
    expect(parseSeedPackMetadata("{}", "SOURCE_CARD_SCHEMA.json")).toBeNull();
  });

  it("keeps seed pack docs optional, safe, and non-overriding", () => {
    const packs = listSparkyWikiSeedPacks();
    for (const pack of packs) {
      const validation = validateSeedPackFiles(pack.id);
      expect(validation.valid).toBe(true);
      for (const file of validation.files) {
        const raw = require("fs").readFileSync(file.absolutePath, "utf8");
        if (pack.id !== "identity-empire") {
          expect(raw).toMatch(
            /optional workspace reference knowledge|optional_reference_knowledge/i
          );
          expect(raw).toMatch(/does not override|runtime_override/i);
        } else {
          expect(file.frontmatter.status_label).toBe("Docs/spec only");
        }
        if (pack.id !== "identity-empire") {
          expect(raw).toMatch(
            /lawful|safety boundary|risk\/ethics|safe|permission/i
          );
        }
        if (
          /step-by-step criminal execution|direct evasion playbooks|instructions to harm people/i.test(
            raw
          )
        ) {
          expect(raw).toMatch(
            /must not operationalize|must not provide|not allowed/i
          );
        }
        expect(raw).not.toMatch(
          /here is how to trespass|evade police by|damage property by/i
        );
      }
    }
  });

  describe("optional campaign/protocol matching", () => {
    const allOptionalPackFiles = () =>
      new Map([
        ["cultural-protocols", new Set(CULTURAL_PROTOCOLS_FILES)],
        ["campaign-case-studies", new Set(CAMPAIGN_CASE_STUDIES_FILES)],
      ]);

    const matchedSectionIds = (prompt) =>
      discoverRelevantOptionalSeedPackSections({
        prompt,
        packFiles: allOptionalPackFiles(),
      }).map((section) => `${section.packId}/${section.file}`);

    it("discovers relevant optional campaign and protocol support sections", () => {
      const sections = matchedSectionIds(
        "Build a lawful scarcity drop and public signal campaign with Nike-style identity compression."
      );

      expect(sections).toEqual(
        expect.arrayContaining([
          "cultural-protocols/SUPREME_DROP_SCARCITY_PROTOCOL.md",
          "cultural-protocols/BANKSY_STYLE_PUBLIC_SIGNAL_PROTOCOL.md",
          "cultural-protocols/NIKE_IDENTITY_COMPRESSION_PROTOCOL.md",
          "campaign-case-studies/SUPREME_DROP_CULTURE.md",
          "campaign-case-studies/NIKE_JUST_DO_IT.md",
        ])
      );
    });

    it("matches bounded PR campaign prompts", () => {
      expect(matchedSectionIds("build a PR angle for my campaign")).toEqual(
        expect.arrayContaining([
          "cultural-protocols/BANKSY_STYLE_PUBLIC_SIGNAL_PROTOCOL.md",
          "campaign-case-studies/MASTER_MARKETERS_OVERVIEW.md",
        ])
      );
    });

    it("matches bounded ARG mystery trail campaign prompts", () => {
      expect(matchedSectionIds("make an ARG mystery trail campaign")).toEqual(
        expect.arrayContaining([
          "cultural-protocols/BANKSY_STYLE_PUBLIC_SIGNAL_PROTOCOL.md",
          "campaign-case-studies/MASTER_MARKETERS_OVERVIEW.md",
        ])
      );
    });

    it.each([
      "private hidden identity project",
      "what is the target audience?",
      "privacy boundary for hidden identity",
    ])("does not match optional packs from substring noise: %s", (prompt) => {
      expect(matchedSectionIds(prompt)).toEqual([]);
    });
  });

  it("discovers relevant Identity Empire sections for identity-building prompts", () => {
    const files = discoverRelevantIdentityEmpireSections({
      prompt:
        "Build my identity empire from nothing with a 30-day launch plan, PR angle, slogan bank, lawful physical visibility plan, and Signal measurement.",
      mode: "Face Identity Mode",
    }).map((item) => item.file);

    expect(files).toEqual(
      expect.arrayContaining([
        "IDENTITY_EMPIRE_INDEX.md",
        "01_identity_operating_system.md",
        "02_no_idea_user_intake.md",
        "03_brand_foundation_builder.md",
        "07_pr_and_press_machine.md",
        "08_social_content_engine.md",
        "09_physical_visibility_safe_playbook.md",
        "13_30_day_identity_empire_launch.md",
        "16_measurement_signal_and_next_moves.md",
      ])
    );
  });
});
