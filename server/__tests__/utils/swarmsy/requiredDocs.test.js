const fs = require("fs");
const path = require("path");

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
  const originalDoctrineRoot = process.env.SWARMSY_DOCTRINE_DOCS_ROOT;
  const repoRoot = path.resolve(__dirname, "../../../..");

  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof originalDoctrineRoot === "undefined") {
      delete process.env.SWARMSY_DOCTRINE_DOCS_ROOT;
    } else {
      process.env.SWARMSY_DOCTRINE_DOCS_ROOT = originalDoctrineRoot;
    }
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

  it("uses consistent boolean coercion for optional group status", () => {
    const manifest = {
      name: "Test Manifest",
      version: 1,
      groups: [
        {
          id: "mixed",
          label: "Mixed",
          required: "true",
          paths: ["docs/swarmsy/app-mode/README.md"],
        },
      ],
    };

    const status = getSwarmsyRequiredDocsStatus(manifest);
    expect(status.groups[0].required).toBe(true);
    expect(status.groups[0].optional).toBe(false);
  });

  it("truthfully reports unavailable docs root from env override", () => {
    process.env.SWARMSY_DOCTRINE_DOCS_ROOT = "/tmp/swarmsy-doctrine-root-missing";

    const manifest = {
      name: "Test Manifest",
      version: 1,
      groups: [
        {
          id: "mixed",
          label: "Mixed",
          required: true,
          paths: ["docs/swarmsy/app-mode/README.md"],
        },
      ],
    };

    const status = getSwarmsyRequiredDocsStatus(manifest);
    expect(status.docsRootAvailable).toBe(false);
    expect(status.docsRootMessage).toContain("does not exist");
    expect(status.documentsToIngest).toEqual([]);
    expect(status.groups[0].files[0]).toMatchObject({
      present: false,
      loadable: false,
    });
  });

  it("truthfully reports docs root stat errors as unavailable", () => {
    process.env.SWARMSY_DOCTRINE_DOCS_ROOT = "/tmp";
    const originalStatSync = fs.statSync;
    const statSpy = jest.spyOn(fs, "statSync");
    statSpy.mockImplementation((targetPath) => {
      if (targetPath === "/tmp") {
        throw new Error("EACCES: permission denied");
      }
      return originalStatSync(targetPath);
    });

    const status = getSwarmsyRequiredDocsStatus({
      name: "Test Manifest",
      version: 1,
      groups: [
        {
          id: "mixed",
          label: "Mixed",
          required: true,
          paths: ["docs/swarmsy/app-mode/README.md"],
        },
      ],
    });

    expect(status.docsRootAvailable).toBe(false);
    expect(status.docsRootMessage).toContain("could not be read");
    statSpy.mockRestore();
  });

  it("marks unreadable manifest docs as per-file failures", () => {
    const targetDoc = "docs/swarmsy/app-mode/README.md";
    const targetPath = path.resolve(repoRoot, targetDoc);
    const originalStatSync = fs.statSync;
    const statSpy = jest.spyOn(fs, "statSync");
    statSpy.mockImplementation((inputPath) => {
      if (path.resolve(inputPath) === targetPath) {
        throw new Error("EACCES: unreadable");
      }
      return originalStatSync(inputPath);
    });

    const status = getSwarmsyRequiredDocsStatus({
      name: "Test Manifest",
      version: 1,
      groups: [
        {
          id: "mixed",
          label: "Mixed",
          required: true,
          paths: [targetDoc],
        },
      ],
    });

    expect(status.groups[0].files[0]).toMatchObject({
      path: targetDoc,
      present: true,
      loadable: false,
    });
    expect(status.groups[0].files[0].error).toContain("Document could not be read:");
    statSpy.mockRestore();
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
    const metadata = collector.processRawText.mock.calls[0][1];
    expect(typeof metadata.published).toBe("number");
    expect(purgeSourceDocument).not.toHaveBeenCalled();
  });

  it("fails one file when ingestion metadata stat cannot be read", async () => {
    Document.forWorkspace.mockResolvedValue([]);

    const targetDoc =
      "docs/swarmsy/living-icon-engine/personas/11_SWARMSY_SPARKY_PERSONA_SYSTEM_PROMPT.md";
    const targetPath = path.resolve(repoRoot, targetDoc);
    let statCalls = 0;
    const originalStatSync = fs.statSync;
    const statSpy = jest.spyOn(fs, "statSync");
    statSpy.mockImplementation((inputPath) => {
      if (path.resolve(inputPath) === targetPath) {
        statCalls += 1;
        if (statCalls >= 2) {
          throw new Error("ENOENT: gone");
        }
      }
      return originalStatSync(inputPath);
    });

    const collector = {
      online: jest.fn().mockResolvedValue(true),
      processRawText: jest.fn(),
    };

    const result = await ingestSwarmsyRequiredDocsForWorkspace(
      {
        id: 7,
        slug: "swarmsy-hive",
        name: "SWARMSY HIVE",
      },
      {
        manifest: {
          name: "Test Manifest",
          version: 1,
          groups: [
            {
              id: "persona",
              label: "Persona",
              required: true,
              paths: [targetDoc],
            },
          ],
        },
        collector,
      }
    );

    expect(result.success).toBe(false);
    expect(result.failed[0]).toMatchObject({
      path: targetDoc,
    });
    expect(result.failed[0].reason).toContain("Document could not be read:");
    expect(collector.processRawText).not.toHaveBeenCalled();
    statSpy.mockRestore();
  });

  it("returns stable collector offline error code", async () => {
    Document.forWorkspace.mockResolvedValue([]);

    const collector = {
      online: jest.fn().mockResolvedValue(false),
      processRawText: jest.fn(),
    };

    const result = await ingestSwarmsyRequiredDocsForWorkspace(
      {
        id: 7,
        slug: "swarmsy-hive",
        name: "SWARMSY HIVE",
      },
      {
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

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("COLLECTOR_OFFLINE");
    expect(result.message).toBe("Document processing API is not online.");
  });
});
