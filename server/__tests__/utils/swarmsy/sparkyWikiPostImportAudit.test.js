jest.mock("../../../models/documents", () => ({
  Document: {
    addDocuments: jest.fn(),
    forWorkspace: jest.fn(),
    where: jest.fn(),
  },
}));

jest.mock("../../../utils/collectorApi", () => ({
  CollectorApi: jest.fn(),
}));

const fs = require("fs");
const path = require("path");
const {
  REPO_ROOT,
  getSeedPackAbsoluteFilePath,
  getSeedPackRelativeFilePath,
  listSparkyWikiSeedPacks,
  parseMarkdownFrontmatter,
  validateSeedPackFiles,
} = require("../../../utils/swarmsy/sparkyWikiSeedPacks");

const REQUIRED_MARKDOWN_FIELDS = [
  "title",
  "category",
  "status_label",
  "workspace_scope",
  "privacy_level",
  "source",
  "source_repo",
  "source_path",
  "optional_reference_knowledge",
  "runtime_override",
  "docs_spec_only",
];

function registeredSeedFiles() {
  return listSparkyWikiSeedPacks().flatMap((pack) =>
    pack.includedFiles.map((file) => ({
      pack,
      file,
      absolutePath: getSeedPackAbsoluteFilePath(pack, file),
      relativePath: getSeedPackRelativeFilePath(pack, file),
    }))
  );
}

describe("SPARKY Wiki post-import audit invariants", () => {
  it("keeps every registry entry docs/spec-only, workspace-scoped, and locally present", () => {
    const packs = listSparkyWikiSeedPacks();
    expect(packs).toHaveLength(16);

    for (const pack of packs) {
      expect(pack.docsSpecOnly).toBe(true);
      expect(pack.sourcePath).toMatch(
        /^docs\/swarmsy\/sparky-wiki\/seed-library\/packs\/[a-z0-9-]+$/
      );
      expect(fs.existsSync(path.resolve(REPO_ROOT, pack.sourcePath))).toBe(
        true
      );
      expect(pack.includedFiles.length).toBeGreaterThan(0);
      expect(pack.safetyBoundaries.length).toBeGreaterThan(0);
      expect(pack.recommendedWorkspaceUseCase).toEqual(expect.any(String));
      expect(pack.safetyBoundaries.join(" ")).toMatch(/No autonomous runtime/);
      expect(pack.safetyBoundaries.join(" ")).toMatch(
        /API\/web lookup stays optional/
      );

      const validation = validateSeedPackFiles(pack.id);
      expect(validation.valid).toBe(true);
      expect(validation.files).toHaveLength(pack.includedFiles.length);
    }
  });

  it("has complete frontmatter/provenance on every registered markdown seed file", () => {
    const missing = [];
    for (const seedFile of registeredSeedFiles().filter(({ file }) =>
      file.endsWith(".md")
    )) {
      const raw = fs.readFileSync(seedFile.absolutePath, "utf8");
      const frontmatter = parseMarkdownFrontmatter(raw) || {};
      const missingFields = REQUIRED_MARKDOWN_FIELDS.filter(
        (field) => !(field in frontmatter)
      );
      if (missingFields.length) {
        missing.push({ file: seedFile.relativePath, missingFields });
      }
      expect(frontmatter.runtime_override).toBe("never");
      expect(String(frontmatter.docs_spec_only)).toBe("true");
      expect(String(frontmatter.optional_reference_knowledge)).toBe("true");
      expect(frontmatter.workspace_scope).toBe("current workspace only");
    }

    expect(missing).toEqual([]);
  });

  it("parses every registered JSON file and preserves source-card provenance", () => {
    const jsonIssues = [];
    for (const seedFile of registeredSeedFiles().filter(({ file }) =>
      file.endsWith(".json")
    )) {
      const raw = fs.readFileSync(seedFile.absolutePath, "utf8");
      const parsed = JSON.parse(raw);
      const metadata = parsed.metadata || parsed;
      const hasProvenance = Boolean(
        (metadata.source_repo && metadata.source_path) || metadata.provenance
      );
      const sourceCardId = parsed.id || metadata.id;
      if (!hasProvenance) jsonIssues.push(seedFile.relativePath);
      if (sourceCardId) {
        expect(sourceCardId).toMatch(/^[a-z0-9][a-z0-9._-]*$/i);
      }
    }

    expect(jsonIssues).toEqual([]);
  });

  it("does not contain broken relative markdown links in registered markdown files", () => {
    const brokenLinks = [];
    const linkPattern = /\[[^\]]+\]\((?!https?:|mailto:|#)([^)]+)\)/g;

    for (const seedFile of registeredSeedFiles().filter(({ file }) =>
      file.endsWith(".md")
    )) {
      const raw = fs.readFileSync(seedFile.absolutePath, "utf8");
      for (const match of raw.matchAll(linkPattern)) {
        const relativeTarget = match[1].split("#")[0].trim();
        if (!relativeTarget) continue;
        const absoluteTarget = path.resolve(
          path.dirname(seedFile.absolutePath),
          decodeURI(relativeTarget)
        );
        if (!fs.existsSync(absoluteTarget)) {
          brokenLinks.push({ file: seedFile.relativePath, relativeTarget });
        }
      }
    }

    expect(brokenLinks).toEqual([]);
  });

  it("blocks forbidden local paths, old app names, and real secret material in registered seed files", () => {
    const violations = [];
    const forbiddenPatterns = [
      /C:\\Users/i,
      /Users\\GOD/i,
      /swarmsy-APP/i,
      /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/i,
      /\bghp_[A-Za-z0-9_]{20,}\b/,
      /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
      /\bsk-(?!demo-placeholder-not-a-real-key\b)[A-Za-z0-9_-]{20,}\b/,
    ];

    for (const seedFile of registeredSeedFiles()) {
      const raw = fs.readFileSync(seedFile.absolutePath, "utf8");
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(raw)) {
          violations.push({
            file: seedFile.relativePath,
            pattern: String(pattern),
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps old mobile/Electron command material labelled as historical or not-current guidance", () => {
    const staleGuidanceIssues = [];
    const commandPattern =
      /\b(?:yarn|npm run|pnpm)\s+(?:android|ios|expo|desktop|eas|electron|dev:frontend|dev:all)[^`\n]*/i;
    const staleRuntimePattern = /\b(?:Expo|Electron|Android APK|EAS)\b/;

    for (const seedFile of registeredSeedFiles().filter(({ file }) =>
      file.endsWith(".md")
    )) {
      const raw = fs.readFileSync(seedFile.absolutePath, "utf8");
      if (!commandPattern.test(raw) && !staleRuntimePattern.test(raw)) continue;
      const hasHistoricalBoundary =
        /old `HODLKONG64\/SWARMSY` repository|old SWARMSY repo adapted reference|historical|old-SWARMSY|not current DIZ-A-REMIX guidance|does not create runtime actions/i.test(
          raw
        );
      if (!hasHistoricalBoundary)
        staleGuidanceIssues.push(seedFile.relativePath);
    }

    expect(staleGuidanceIssues).toEqual([]);
  });
});
