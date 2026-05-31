const path = require("path");
const { Document } = require("../../models/documents");
const { CollectorApi } = require("../collectorApi");
const { safeJsonParse } = require("../http");
const { getSwarmsyRequiredDocsStatus } = require("./requiredDocs");

function getRequiredLoadableDocs(status = {}) {
  const loadablePaths = [];
  const unavailablePaths = [];

  for (const group of status.groups || []) {
    if (!group.required) continue;

    for (const file of group.files || []) {
      if (file.loadable) {
        loadablePaths.push(file.path);
      } else {
        unavailablePaths.push({
          path: file.path,
          reason: "not_loadable",
          error: file.error || "Document is not loadable.",
        });
      }
    }
  }

  return { loadablePaths, unavailablePaths };
}

function getWorkspaceSummary(workspace = null) {
  if (!workspace) return null;

  return {
    exists: true,
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
  };
}

function getExistingChunkSources(workspace = null) {
  const existingChunkSources = new Set();

  for (const existingDoc of workspace?.documents || []) {
    const metadata = safeJsonParse(existingDoc.metadata, null);
    if (metadata?.chunkSource) {
      existingChunkSources.add(String(metadata.chunkSource));
    }
  }

  return existingChunkSources;
}

async function ingestSwarmsyRequiredDocs({ workspace, userId = null } = {}) {
  if (!workspace) {
    throw new Error("Workspace is required for SWARMSY docs ingestion.");
  }

  const collector = new CollectorApi();
  const collectorOnline = await collector.online();
  if (!collectorOnline) {
    return {
      success: false,
      errorCode: "COLLECTOR_OFFLINE",
      message: "Document processing API is not online.",
    };
  }

  const status = getSwarmsyRequiredDocsStatus();
  const { loadablePaths, unavailablePaths } = getRequiredLoadableDocs(status);
  const workspaceSummary = getWorkspaceSummary(workspace);

  if (loadablePaths.length === 0) {
    return {
      success: true,
      workspace: workspaceSummary,
      ingested: [],
      skipped: unavailablePaths,
      failed: [],
      partial: false,
      message: "No SWARMSY required docs are currently available to ingest.",
    };
  }

  const existingChunkSources = getExistingChunkSources(workspace);
  const ingested = [];
  const skipped = [...unavailablePaths];
  const failed = [];
  const docsRoot = path.resolve(status.docsRoot);

  for (const docPath of loadablePaths) {
    const chunkSource = `swarmsy-required://${docPath}`;
    if (existingChunkSources.has(chunkSource)) {
      skipped.push({
        path: docPath,
        reason: "already_attached",
        error: null,
      });
      continue;
    }

    const absoluteDocPath = path.resolve(docsRoot, docPath);
    const {
      success,
      reason,
      documents = [],
    } = await collector.forwardExtensionRequest({
      endpoint: "/process",
      method: "POST",
      body: {
        filename: path.basename(docPath),
        options: { absolutePath: absoluteDocPath },
        metadata: {
          title: path.basename(docPath),
          docSource: "SWARMSY required doctrine docs",
          description: docPath,
          chunkSource,
        },
      },
    });

    if (!success || documents.length === 0 || !documents[0]?.location) {
      failed.push({
        path: docPath,
        stage: "collect",
        error:
          reason || "Collector did not return an ingestible document location.",
      });
      continue;
    }

    const generatedDocLocation = documents[0].location;
    const {
      failedToEmbed = [],
      errors = [],
      embedded = [],
    } = await Document.addDocuments(workspace, [generatedDocLocation], userId);

    if (failedToEmbed.length > 0 || embedded.length === 0) {
      failed.push({
        path: docPath,
        stage: "embed",
        error:
          errors[0] ||
          "Document.addDocuments failed for this doctrine document.",
      });
      continue;
    }

    ingested.push({ path: docPath });
    existingChunkSources.add(chunkSource);
  }

  const alreadyAttachedCount = skipped.filter(
    (item) => item.reason === "already_attached"
  ).length;
  const availableCount = loadablePaths.length;
  const partial = failed.length > 0;

  let message = "SWARMSY required docs ingested successfully.";
  if (ingested.length === 0 && availableCount === alreadyAttachedCount) {
    message =
      "All loadable SWARMSY required docs are already attached to this workspace.";
  } else if (ingested.length === 0 && failed.length === 0) {
    message = "No SWARMSY required docs are currently available to ingest.";
  } else if (partial) {
    message =
      "SWARMSY required docs ingestion completed with partial failures.";
  }

  return {
    success: true,
    workspace: workspaceSummary,
    ingested,
    skipped,
    failed,
    partial,
    message,
  };
}

module.exports = {
  getRequiredLoadableDocs,
  getWorkspaceSummary,
  ingestSwarmsyRequiredDocs,
};
