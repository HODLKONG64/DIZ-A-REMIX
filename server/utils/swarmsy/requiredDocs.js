const fs = require("fs");
const path = require("path");
const { Document } = require("../../models/documents");
const { purgeSourceDocument } = require("../files");
const { CollectorApi } = require("../collectorApi");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const MANIFEST_PATH = path.resolve(
  __dirname,
  "../../config/swarmsy/SWARMSY_REQUIRED_DOCS_MANIFEST.json"
);
const FILE_SOURCE_PREFIX = "file://";
const DOCTRINE_DOCS_ROOT_ENV = "SWARMSY_DOCTRINE_DOCS_ROOT";

function loadSwarmsyRequiredDocsManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function normalizeRepoRelativePath(docPath = "") {
  if (typeof docPath !== "string" || docPath.trim().length === 0) return null;
  if (path.isAbsolute(docPath)) return null;

  const normalized = path
    .normalize(docPath.trim())
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");

  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    return null;
  }

  return normalized;
}

function getDoctrineDocsRootStatus() {
  const configuredRoot =
    typeof process.env[DOCTRINE_DOCS_ROOT_ENV] === "string"
      ? process.env[DOCTRINE_DOCS_ROOT_ENV].trim()
      : "";

  const docsRoot = configuredRoot
    ? path.resolve(
        path.isAbsolute(configuredRoot)
          ? configuredRoot
          : path.resolve(REPO_ROOT, configuredRoot)
      )
    : REPO_ROOT;

  if (!fs.existsSync(docsRoot)) {
    return {
      docsRoot,
      envValue: configuredRoot || null,
      available: false,
      message: `SWARMSY doctrine docs root does not exist: ${docsRoot}`,
    };
  }

  if (!fs.statSync(docsRoot).isDirectory()) {
    return {
      docsRoot,
      envValue: configuredRoot || null,
      available: false,
      message: `SWARMSY doctrine docs root is not a directory: ${docsRoot}`,
    };
  }

  return {
    docsRoot,
    envValue: configuredRoot || null,
    available: true,
    message: null,
  };
}

function resolveManifestDocPath(
  docPath,
  docsRootStatus = getDoctrineDocsRootStatus()
) {
  const normalizedPath = normalizeRepoRelativePath(docPath);
  if (!normalizedPath) {
    return {
      normalizedPath: null,
      absolutePath: null,
      error: "Invalid manifest document path.",
    };
  }

  const absolutePath = path.resolve(docsRootStatus.docsRoot, normalizedPath);
  const relativePath = path.relative(docsRootStatus.docsRoot, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return {
      normalizedPath,
      absolutePath: null,
      error:
        "Manifest document path resolves outside the configured docs root.",
    };
  }

  const docsRootRelativeToRepo = path.relative(
    REPO_ROOT,
    docsRootStatus.docsRoot
  );
  const docsRootWithinRepo =
    !docsRootRelativeToRepo.startsWith("..") &&
    !path.isAbsolute(docsRootRelativeToRepo);

  if (docsRootWithinRepo) {
    const relativeToRepo = path.relative(REPO_ROOT, absolutePath);
    if (relativeToRepo.startsWith("..") || path.isAbsolute(relativeToRepo)) {
      return {
        normalizedPath,
        absolutePath: null,
        error: "Manifest document path resolves outside the repository root.",
      };
    }
  }

  if (!docsRootStatus.available) {
    return {
      normalizedPath,
      absolutePath,
      error: docsRootStatus.message,
    };
  }

  return { normalizedPath, absolutePath, error: null };
}

function inspectManifestDocument(
  docPath,
  required = false,
  docsRootStatus = getDoctrineDocsRootStatus()
) {
  const { normalizedPath, absolutePath, error } = resolveManifestDocPath(
    docPath,
    docsRootStatus
  );
  if (error) {
    return {
      path: docPath,
      present: false,
      loadable: false,
      required,
      optional: !required,
      error,
    };
  }

  if (!fs.existsSync(absolutePath)) {
    return {
      path: normalizedPath,
      present: false,
      loadable: false,
      required,
      optional: !required,
      error: "Document is missing from the repository.",
    };
  }

  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    return {
      path: normalizedPath,
      present: false,
      loadable: false,
      required,
      optional: !required,
      error: "Manifest entry does not point to a file.",
    };
  }

  try {
    const content = fs.readFileSync(absolutePath, "utf8");
    return {
      path: normalizedPath,
      present: true,
      loadable: content.trim().length > 0,
      required,
      optional: !required,
      bytes: stats.size,
      error:
        content.trim().length > 0
          ? null
          : "Document exists but is empty on disk.",
    };
  } catch (readError) {
    return {
      path: normalizedPath,
      present: true,
      loadable: false,
      required,
      optional: !required,
      error: readError.message,
    };
  }
}

function getSwarmsyRequiredDocPaths(
  manifest = loadSwarmsyRequiredDocsManifest()
) {
  return manifest.groups.flatMap((group) =>
    group.paths
      .map((docPath) => normalizeRepoRelativePath(docPath))
      .filter(Boolean)
  );
}

function getSwarmsyRequiredDocsStatus(
  manifest = loadSwarmsyRequiredDocsManifest()
) {
  const docsRootStatus = getDoctrineDocsRootStatus();
  const groups = manifest.groups.map((group) => {
    const files = group.paths.map((docPath) =>
      inspectManifestDocument(docPath, Boolean(group.required), docsRootStatus)
    );

    return {
      id: group.id,
      label: group.label,
      required: Boolean(group.required),
      optional: !Boolean(group.required),
      present: files.filter((file) => file.present).length,
      missing: files.filter((file) => !file.present).length,
      loadable: files.filter((file) => file.loadable).length,
      files,
    };
  });

  const allFiles = groups.flatMap((group) => group.files);
  return {
    manifest: manifest.name,
    version: manifest.version,
    docsRoot: docsRootStatus.docsRoot,
    docsRootAvailable: docsRootStatus.available,
    docsRootEnvValue: docsRootStatus.envValue,
    docsRootMessage: docsRootStatus.message,
    groups,
    documentsToIngest: allFiles
      .filter((file) => file.present && file.loadable)
      .map((file) => file.path),
    summary: {
      requiredPresent: allFiles.filter((file) => file.required && file.present)
        .length,
      requiredMissing: allFiles.filter((file) => file.required && !file.present)
        .length,
      optionalPresent: allFiles.filter((file) => file.optional && file.present)
        .length,
      optionalMissing: allFiles.filter((file) => file.optional && !file.present)
        .length,
    },
  };
}

function trackedWorkspaceDocPath(document) {
  let metadata = null;
  try {
    metadata = JSON.parse(document?.metadata || "null");
  } catch {}

  for (const key of ["chunkSource", "docSource"]) {
    const source = metadata?.[key];
    if (typeof source !== "string" || !source.startsWith(FILE_SOURCE_PREFIX)) {
      continue;
    }

    const normalizedPath = normalizeRepoRelativePath(
      source.slice(FILE_SOURCE_PREFIX.length)
    );
    if (normalizedPath) return normalizedPath;
  }

  return null;
}

function createIngestionMetadata(docPath, absolutePath) {
  const stats = fs.statSync(absolutePath);
  return {
    title: docPath,
    docAuthor: "SWARMSY Doctrine",
    description: `SWARMSY required doctrine document from ${docPath}.`,
    docSource: `${FILE_SOURCE_PREFIX}${docPath}`,
    chunkSource: `${FILE_SOURCE_PREFIX}${docPath}`,
    published: String(stats.mtimeMs),
  };
}

async function ingestSwarmsyRequiredDocsForWorkspace(workspace, options = {}) {
  if (!workspace?.id || !workspace?.slug) {
    throw new Error("A valid workspace is required for SWARMSY doc ingestion.");
  }

  const manifest = options.manifest || loadSwarmsyRequiredDocsManifest();
  const status = getSwarmsyRequiredDocsStatus(manifest);
  const collector = options.collector || new CollectorApi();
  const userId = options.userId ?? null;
  const blockingFiles = status.groups
    .filter((group) => group.required)
    .flatMap((group) =>
      group.files.filter((file) => !file.present || !file.loadable)
    );

  if (blockingFiles.length > 0) {
    return {
      success: false,
      partial: false,
      manifest: status.manifest,
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
      },
      message: "Required SWARMSY doctrine docs are missing or unreadable.",
      ingested: [],
      skipped: [],
      failed: blockingFiles.map((file) => ({
        path: file.path,
        reason: file.error || "Required document is not ready for ingestion.",
      })),
      summary: {
        attempted: 0,
        ingested: 0,
        skipped: 0,
        failed: blockingFiles.length,
      },
    };
  }

  const collectorOnline = await collector.online();
  if (!collectorOnline) {
    return {
      success: false,
      partial: false,
      errorCode: "COLLECTOR_OFFLINE",
      manifest: status.manifest,
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
      },
      message: "Document processing API is not online.",
      ingested: [],
      skipped: [],
      failed: [],
      summary: {
        attempted: 0,
        ingested: 0,
        skipped: 0,
        failed: 0,
      },
    };
  }

  const existingDocs = await Document.forWorkspace(workspace.id);
  const existingTrackedPaths = new Set(
    existingDocs.map(trackedWorkspaceDocPath).filter(Boolean)
  );
  const ingested = [];
  const skipped = [];
  const failed = [];

  for (const docPath of status.documentsToIngest) {
    if (existingTrackedPaths.has(docPath)) {
      skipped.push({
        path: docPath,
        reason: "Document is already attached to this workspace.",
      });
      continue;
    }

    const { absolutePath, error } = resolveManifestDocPath(docPath);
    if (error || !absolutePath) {
      failed.push({
        path: docPath,
        reason: error || "Manifest path could not be resolved.",
      });
      continue;
    }

    let content = "";
    try {
      content = fs.readFileSync(absolutePath, "utf8");
    } catch (readError) {
      failed.push({ path: docPath, reason: readError.message });
      continue;
    }

    if (content.trim().length === 0) {
      failed.push({
        path: docPath,
        reason: "Document exists but is empty on disk.",
      });
      continue;
    }

    const {
      success,
      reason,
      documents = [],
    } = await collector.processRawText(
      content,
      createIngestionMetadata(docPath, absolutePath)
    );
    const docLocation = documents?.[0]?.location;
    if (!success || !docLocation) {
      failed.push({
        path: docPath,
        reason: reason || "Collector did not return a document location.",
      });
      continue;
    }

    const {
      embedded = [],
      failedToEmbed = [],
      errors = [],
    } = await Document.addDocuments(workspace, [docLocation], userId);

    if (embedded.length === 0 || failedToEmbed.length > 0) {
      await purgeSourceDocument(docLocation);
      failed.push({
        path: docPath,
        reason:
          errors.join("; ") ||
          `Failed to attach ${docPath} to workspace ${workspace.slug}.`,
      });
      continue;
    }

    existingTrackedPaths.add(docPath);
    ingested.push({ path: docPath, location: docLocation });
  }

  const partial = ingested.length > 0 && failed.length > 0;
  const success = failed.length === 0;
  let message = "Failed to ingest SWARMSY required docs.";
  if (success && ingested.length > 0) {
    message = "SWARMSY required docs ingested successfully.";
  } else if (success) {
    message =
      "All SWARMSY required docs were already attached to this workspace.";
  } else if (partial) {
    message = "Some SWARMSY required docs were ingested, but some failed.";
  }

  return {
    success,
    partial,
    manifest: status.manifest,
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
    },
    message,
    ingested,
    skipped,
    failed,
    summary: {
      attempted: status.documentsToIngest.length,
      ingested: ingested.length,
      skipped: skipped.length,
      failed: failed.length,
    },
  };
}

module.exports = {
  loadSwarmsyRequiredDocsManifest,
  getSwarmsyRequiredDocsStatus,
  getSwarmsyRequiredDocPaths,
  ingestSwarmsyRequiredDocsForWorkspace,
};
