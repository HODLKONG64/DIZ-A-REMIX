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

const STALE_COMMAND_PATTERN =
  /\b(?:yarn|npm run|pnpm)\s+(?:android|ios|expo|eas|electron)\b[^`\n]*/gi;
const CURRENT_DIZ_COMMAND_PATTERN =
  /\b(?:yarn|npm run|pnpm)\s+(?:setup|dev:all|dev:frontend|dev:server|dev:collector|desktop:dev|desktop:smoke|desktop:runtime:dev)\b/i;
const LOCAL_HISTORICAL_BOUNDARY_PATTERN =
  /legacy|historical|old SWARMSY|old-SWARMSY|not current DIZ-A-REMIX guidance|do not use as current setup guidance|reference only|obsolete|archival/i;

function lineWindowForMatch(raw, matchIndex, radius = 4) {
  const lines = String(raw || "").split(/\r?\n/);
  let offset = 0;
  let matchLine = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const nextOffset = offset + lines[index].length + 1;
    if (matchIndex < nextOffset) {
      matchLine = index;
      break;
    }
    offset = nextOffset;
  }

  return lines
    .slice(Math.max(0, matchLine - radius), matchLine + radius + 1)
    .join("\n");
}

function hasLocalHistoricalBoundary(raw, matchIndex) {
  return LOCAL_HISTORICAL_BOUNDARY_PATTERN.test(
    lineWindowForMatch(raw, matchIndex)
  );
}

function staleGuidanceMatches(raw = "") {
  const matches = [];
  for (const pattern of [STALE_COMMAND_PATTERN]) {
    pattern.lastIndex = 0;
    for (const match of String(raw || "").matchAll(pattern)) {
      if (CURRENT_DIZ_COMMAND_PATTERN.test(match[0])) continue;
      matches.push({ text: match[0], index: match.index });
    }
  }
  return matches;
}

function unlabelledStaleGuidanceMatches(raw = "") {
  return staleGuidanceMatches(raw).filter(
    (match) => !hasLocalHistoricalBoundary(raw, match.index)
  );
}

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

  it("keeps old mobile/Electron command material locally labelled as historical or not-current guidance", () => {
    const staleGuidanceIssues = [];

    for (const seedFile of registeredSeedFiles().filter(({ file }) =>
      file.endsWith(".md")
    )) {
      const raw = fs.readFileSync(seedFile.absolutePath, "utf8");
      const unlabelledMatches = unlabelledStaleGuidanceMatches(raw);
      if (unlabelledMatches.length) {
        staleGuidanceIssues.push({
          file: seedFile.relativePath,
          matches: unlabelledMatches.map((match) => match.text),
        });
      }
    }

    expect(staleGuidanceIssues).toEqual([]);
  });

  it("requires stale command labels near the command instead of relying on top-of-file adaptation notes", () => {
    expect(
      unlabelledStaleGuidanceMatches(`
---
source: old SWARMSY repo adapted reference
---

This imported document is historical reference only.

## Setup

Install the old app dependencies.
yarn expo start
`)
    ).toEqual([
      expect.objectContaining({
        text: expect.stringContaining("yarn expo start"),
      }),
    ]);

    expect(
      unlabelledStaleGuidanceMatches(`
## Historical mobile notes

Legacy old SWARMSY command, not current DIZ-A-REMIX guidance:
yarn expo start
`)
    ).toEqual([]);

    expect(
      unlabelledStaleGuidanceMatches(`
## Current setup

Run yarn expo start to launch the mobile preview.
`)
    ).toEqual([
      expect.objectContaining({
        text: expect.stringContaining("yarn expo start"),
      }),
    ]);

    expect(
      unlabelledStaleGuidanceMatches(`
## Current DIZ-A-REMIX commands

Run yarn setup, yarn dev:all, yarn desktop:smoke, and yarn desktop:runtime:dev.
`)
    ).toEqual([]);
  });
});
