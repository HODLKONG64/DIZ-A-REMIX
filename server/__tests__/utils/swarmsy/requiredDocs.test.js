jest.mock("../../../models/documents", () => ({
  Document: {
    forWorkspace: jest.fn(),
    addDocuments: jest.fn(),
  },
}));

jest.mock("../../../utils/files", () => ({
  purgeSourceDocument: jest.fn(),
}));

const { Document } = require("../../../models/documents");
const { purgeSourceDocument } = require("../../../utils/files");
const {
  loadSwarmsyRequiredDocsManifest,
  getSwarmsyRequiredDocsStatus,
  getSwarmsyRequiredDocPaths,
  ingestSwarmsyRequiredDocsForWorkspace,
} = require("../../../utils/swarmsy/requiredDocs");

describe("SWARMSY required docs helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the SWARMSY required docs manifest", () => {
    const manifest = loadSwarmsyRequiredDocsManifest();

    expect(manifest.name).toBe("SWARMSY Required Doctrine Docs");
    expect(manifest.groups).toHaveLength(5);
    expect(getSwarmsyRequiredDocPaths(manifest)).toContain(
      "docs/swarmsy/living-icon-engine/personas/11_SWARMSY_SPARKY_PERSONA_SYSTEM_PROMPT.md"
    );
  });

  it("reports grouped present and missing status", () => {
    const manifest = {
      name: "Test Manifest",
      version: 1,
      groups: [
        {
          id: "mixed",
          label: "Mixed",
          required: true,
          paths: [
            "docs/swarmsy/app-mode/README.md",
            "docs/swarmsy/app-mode/DOES_NOT_EXIST.md",
          ],
        },
      ],
    };

    const status = getSwarmsyRequiredDocsStatus(manifest);

    expect(status.manifest).toBe("Test Manifest");
    expect(status.groups[0]).toMatchObject({
      id: "mixed",
      required: true,
      present: 1,
      missing: 1,
      loadable: 1,
    });
    expect(status.summary).toEqual({
      requiredPresent: 1,
      requiredMissing: 1,
      optionalPresent: 0,
      optionalMissing: 0,
    });
    expect(status.documentsToIngest).toEqual(["docs/swarmsy/app-mode/README.md"]);
  });

  it("skips documents that are already attached to the workspace", async () => {
    Document.forWorkspace.mockResolvedValue([
      {
        metadata: JSON.stringify({
          chunkSource: "file://docs/swarmsy/app-mode/README.md",
        }),
      },
    ]);

    const collector = {
      online: jest.fn().mockResolvedValue(true),
      processRawText: jest.fn(),
    };

    const result = await ingestSwarmsyRequiredDocsForWorkspace(
      {
        id: 42,
        slug: "swarmsy-hive",
        name: "SWARMSY HIVE",
      },
      {
        manifest: {
          name: "Test Manifest",
          version: 1,
          groups: [
            {
              id: "app-mode",
              label: "App Mode",
              required: true,
              paths: ["docs/swarmsy/app-mode/README.md"],
            },
          ],
        },
        collector,
      }
    );

    expect(result.success).toBe(true);
    expect(result.skipped).toEqual([
      {
        path: "docs/swarmsy/app-mode/README.md",
        reason: "Document is already attached to this workspace.",
      },
    ]);
    expect(result.ingested).toHaveLength(0);
    expect(collector.processRawText).not.toHaveBeenCalled();
    expect(Document.addDocuments).not.toHaveBeenCalled();
  });

  it("uses the existing collector and document APIs to ingest docs", async () => {
    Document.forWorkspace.mockResolvedValue([]);
    Document.addDocuments.mockResolvedValue({
      embedded: ["custom-documents/raw-doc.json"],
      failedToEmbed: [],
      errors: [],
    });

    const collector = {
      online: jest.fn().mockResolvedValue(true),
      processRawText: jest.fn().mockResolvedValue({
        success: true,
        reason: null,
        documents: [{ location: "custom-documents/raw-doc.json" }],
      }),
    };

    const result = await ingestSwarmsyRequiredDocsForWorkspace(
      {
        id: 7,
        slug: "swarmsy-hive",
        name: "SWARMSY HIVE",
      },
      {
        userId: 11,
        manifest: {
          name: "Test Manifest",
          version: 1,
          groups: [
            {
              id: "persona",
              label: "Persona",
              required: true,
              paths: [
                "docs/swarmsy/living-icon-engine/personas/11_SWARMSY_SPARKY_PERSONA_SYSTEM_PROMPT.md",
              ],
            },
          ],
        },
        collector,
      }
    );

    expect(result.success).toBe(true);
    expect(result.ingested).toEqual([
      {
        path: "docs/swarmsy/living-icon-engine/personas/11_SWARMSY_SPARKY_PERSONA_SYSTEM_PROMPT.md",
        location: "custom-documents/raw-doc.json",
      },
    ]);
    expect(Document.addDocuments).toHaveBeenCalledWith(
      {
        id: 7,
        slug: "swarmsy-hive",
        name: "SWARMSY HIVE",
      },
      ["custom-documents/raw-doc.json"],
      11
    );
    expect(purgeSourceDocument).not.toHaveBeenCalled();
  });
});
