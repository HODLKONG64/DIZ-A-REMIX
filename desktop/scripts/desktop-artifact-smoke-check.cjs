#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../..");
const artifactsRoot = path.join(repoRoot, "desktop", "artifacts");
const appName = "swarmsy-desktop-win32-x64";
const packageRoot = path.join(artifactsRoot, appName);
const archivePath = path.join(artifactsRoot, `${appName}.zip`);
const appResourcesRoot = path.join(packageRoot, "resources", "app");

const requiredPaths = [
  "SWARMSY Desktop.exe",
  "resources/app/package.json",
  "resources/app/desktop/electron/main.cjs",
  "resources/app/desktop/electron/preload.cjs",
  "resources/app/desktop/foundation/runtimeHealthcheck.cjs",
  "resources/app/desktop/foundation/runtimeLauncher.cjs",
  "resources/app/desktop/foundation/storageContractBridge.cjs",
  "resources/app/server/utils/swarmsy/localUserStorageContract.js",
  "resources/app/desktop/foundation/localBackupStore.cjs",
  "resources/app/desktop/foundation/localSettingsStore.cjs",
  "resources/app/frontend/dist/_index.html",
];

const forbiddenPathSegments = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  "storage",
  "documents",
  "vector-cache",
  "hotdir",
  "models",
  "ollama",
  ".anythingllm-desktop",
  "local-user-data",
  "session-store",
]);

const secretFilePatterns = [
  /^\.env/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /session/i,
  /credential/i,
  /auth/i,
];

const secretValuePatterns = [
  /(?:api[_-]?key|auth[_-]?token|session[_-]?token|access[_-]?token|refresh[_-]?token|secret|credential)\s*[:=]\s*["'][A-Za-z0-9_./+=-]{24,}["']/i,
  /(?:OPENAI|ANTHROPIC|GEMINI|GROQ|AZURE|PINECONE|QDRANT|MILVUS|WEAVIATE|POSTHOG)[A-Z0-9_]*\s*[:=]\s*["'][^"']{24,}["']/,
  /\bsk-(?!my|123|example|xxxx|cp-\.\.\.)(?:proj-)?[A-Za-z0-9_-]{24,}\b/i,
];

function fail(message) {
  console.error(`[desktop:artifact:smoke] ${message}`);
  process.exit(1);
}

function assertExists(relativePath) {
  const target = path.join(packageRoot, relativePath);
  if (!fs.existsSync(target)) {
    fail(`Missing expected desktop artifact path: ${relativePath}`);
  }
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function assertNoForbiddenPaths(files) {
  for (const file of files) {
    const relative = path.relative(packageRoot, file).split(path.sep);
    for (const segment of relative) {
      if (forbiddenPathSegments.has(segment.toLowerCase())) {
        fail(
          `Forbidden local/runtime path included in artifact: ${path.relative(
            packageRoot,
            file
          )}`
        );
      }
    }
    const basename = path.basename(file);
    if (secretFilePatterns.some((pattern) => pattern.test(basename))) {
      fail(
        `Forbidden secret/auth/session/API-key-like file included: ${path.relative(
          packageRoot,
          file
        )}`
      );
    }
  }
}

function assertNoSecretValues(files) {
  const textExtensions = new Set([
    ".cjs",
    ".js",
    ".json",
    ".html",
    ".css",
    ".txt",
    ".md",
  ]);
  for (const file of files) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const stat = fs.statSync(file);
    if (stat.size > 2 * 1024 * 1024) continue;
    const contents = fs.readFileSync(file, "utf8");
    for (const pattern of secretValuePatterns) {
      if (pattern.test(contents)) {
        fail(
          `Secret/auth/session/API-key-like value found in ${path.relative(
            packageRoot,
            file
          )}`
        );
      }
    }
  }
}

function main() {
  if (!fs.existsSync(packageRoot)) {
    fail(`Artifact directory is missing: ${packageRoot}`);
  }
  if (!fs.existsSync(archivePath)) {
    fail(`Artifact archive is missing: ${archivePath}`);
  }
  for (const relativePath of requiredPaths) assertExists(relativePath);

  const files = walk(packageRoot);
  if (
    !files.some((file) =>
      file.startsWith(path.join(appResourcesRoot, "frontend", "dist"))
    )
  ) {
    fail("Frontend build assets are missing from artifact resources.");
  }
  assertNoForbiddenPaths(files);
  assertNoSecretValues(files);
  console.log(
    "[desktop:artifact:smoke] Windows desktop artifact structure and safety checks passed."
  );
}

main();
