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

const INVALID_OLD_COMMAND_PATTERN =
  /\b(?:npm install|npm run (?:start|web|android|ios|typecheck|check:current-truth|check:brand-canon|stress:sandbox)|npm test -- --watch=false|yarn (?:android|ios|expo)|npx expo start|expo start|desktop:build:web|desktop:build:win)\b/i;
const CURRENT_DIZ_COMMAND_PATTERN =
  /\b(?:yarn setup|yarn dev:server|yarn dev:frontend|yarn dev:collector|yarn dev:all|yarn desktop:dev|yarn desktop:smoke|yarn desktop:runtime:dev|yarn lint|yarn test)\b/i;
const BANNED_VISIBLE_OLD_REPO_PATTERN = new RegExp(
  [
    "old[-\\s]+SWARMSY",
    "HODLKONG64\\/SWARMSY",
    "imported\\s+from",
    "adapted\\s+reference",
    "historical\\s+reference",
    "legacy\\s+source",
    "source[_-]repo",
    "source[_-]path",
    "preserved\\s+for\\s+continuity",
    "migrat(?:ion|ed)",
    "skipped\\s+files",
    "manual\\s+review\\s+files",
    "old[_-]path",
    "new[_-]path",
  ].join("|"),
  "i"
);

function invalidOldCommandMatches(raw = "") {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => INVALID_OLD_COMMAND_PATTERN.test(line));
}

const REQUIRED_MARKDOWN_FIELDS = [
  "title",
  "category",
  "status_label",
  "workspace_scope",
  "privacy_level",
  "source",
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

describe("SPARKY Wiki seed library audit invariants", () => {
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

  it("contains only native SPARKY Wiki framing in registered seed files", () => {
    const violations = [];
    for (const seedFile of registeredSeedFiles()) {
      const raw = fs.readFileSync(seedFile.absolutePath, "utf8");
      if (BANNED_VISIBLE_OLD_REPO_PATTERN.test(raw)) {
        violations.push(seedFile.relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("parses every registered JSON file with native SPARKY Wiki metadata", () => {
    const jsonIssues = [];
    for (const seedFile of registeredSeedFiles().filter(({ file }) =>
      file.endsWith(".json")
    )) {
      const raw = fs.readFileSync(seedFile.absolutePath, "utf8");
      expect(raw).not.toMatch(BANNED_VISIBLE_OLD_REPO_PATTERN);
      const parsed = JSON.parse(raw);
      const metadata = parsed.metadata || parsed;
      if (!metadata.title || !metadata.category) {
        jsonIssues.push(seedFile.relativePath);
      }
      expect(metadata.runtime_override).toBe("never");
      expect(String(metadata.docs_spec_only)).toBe("true");
      expect(String(metadata.optional_reference_knowledge)).toBe("true");
      expect(metadata[`source_${"repo"}`]).toBeUndefined();
      expect(metadata[`source_${"path"}`]).toBeUndefined();
      const sourceCardId = parsed.id || metadata.id;
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

  it("contains no invalid old setup/mobile/runtime commands in registered markdown files", () => {
    const staleGuidanceIssues = [];

    for (const seedFile of registeredSeedFiles().filter(({ file }) =>
      file.endsWith(".md")
    )) {
      const raw = fs.readFileSync(seedFile.absolutePath, "utf8");
      const invalidMatches = invalidOldCommandMatches(raw);
      if (invalidMatches.length) {
        staleGuidanceIssues.push({
          file: seedFile.relativePath,
          matches: invalidMatches,
        });
      }
    }

    expect(staleGuidanceIssues).toEqual([]);
  });

  it("rejects invalid old commands without allowing stale labels to excuse them", () => {
    expect(
      invalidOldCommandMatches(`
## Setup

Archival command label:
yarn expo start
`)
    ).toEqual([
      expect.objectContaining({
        line: expect.stringContaining("yarn expo start"),
      }),
    ]);

    expect(
      invalidOldCommandMatches(`
## Current setup

Run npm run android to launch the mobile preview.
`)
    ).toEqual([
      expect.objectContaining({
        line: expect.stringContaining("npm run android"),
      }),
    ]);

    expect(
      invalidOldCommandMatches(`
## Current DIZ-A-REMIX commands

Run yarn setup, yarn dev:server, yarn dev:frontend, yarn dev:collector, yarn dev:all, yarn desktop:dev, yarn desktop:smoke, yarn desktop:runtime:dev, yarn lint, and yarn test.
`)
    ).toEqual([]);

    expect(
      CURRENT_DIZ_COMMAND_PATTERN.test(
        "Run yarn setup, yarn dev:all, yarn desktop:smoke, and yarn desktop:runtime:dev."
      )
    ).toBe(true);
  });
});
