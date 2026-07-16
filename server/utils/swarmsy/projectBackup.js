const PROJECT_BACKUP_SCHEMA = "swarmsy_project_backup";
const PROJECT_BACKUP_VERSION = 1;
const INCLUDED_SECTIONS = [
  "intakeSessions",
  "identityIdeas",
  "memoryLocks",
  "proofReviews",
];
const EXCLUDED_SECTIONS = [
  "chats",
  "documents",
  "campaigns",
  "generatedAssets",
  "userGrownPacks",
];
const RECORD_FIELDS = {
  intakeSessions: [
    "id",
    "version",
    "mode",
    "status",
    "isActive",
    "currentStep",
    "answers",
    "completedAt",
    "archivedAt",
    "createdAt",
    "updatedAt",
  ],
  identityIdeas: [
    "id",
    "mode",
    "status",
    "title",
    "content",
    "approvedAt",
    "deletedAt",
    "createdAt",
    "updatedAt",
  ],
  memoryLocks: [
    "id",
    "isActive",
    "version",
    "source",
    "content",
    "archivedAt",
    "createdAt",
    "updatedAt",
  ],
  proofReviews: [
    "id",
    "isActive",
    "version",
    "source",
    "content",
    "archivedAt",
    "createdAt",
    "updatedAt",
  ],
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function isIsoDate(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function portableRecord(section, record) {
  if (!isPlainObject(record)) return null;
  const output = {};
  for (const field of RECORD_FIELDS[section]) {
    if (field === "id") {
      output.sourceId = isPositiveInteger(record.id) ? Number(record.id) : null;
      continue;
    }
    if (record[field] !== undefined) output[field] = record[field];
  }
  return output;
}

function portableRecords(section, records) {
  return (Array.isArray(records) ? records : [])
    .map((record) => portableRecord(section, record))
    .filter(Boolean);
}

function buildSwarmsyProjectBackup({
  workspace,
  intakeSessions = [],
  identityIdeas = [],
  memoryLocks = [],
  proofReviews = [],
  exportedAt = new Date().toISOString(),
} = {}) {
  if (!workspace || !isPositiveInteger(workspace.id)) {
    throw new Error("A valid workspace is required for project backup export.");
  }

  const slug = String(workspace.slug || "").trim();
  const name = String(workspace.name || "").trim();
  if (!slug || !name) {
    throw new Error(
      "Workspace slug and name are required for project backup export."
    );
  }
  if (!isIsoDate(exportedAt)) {
    throw new Error("exportedAt must be a valid ISO date string.");
  }

  return {
    schema: PROJECT_BACKUP_SCHEMA,
    version: PROJECT_BACKUP_VERSION,
    exportedAt,
    workspace: { sourceId: Number(workspace.id), slug, name },
    coverage: {
      included: [...INCLUDED_SECTIONS],
      excluded: [...EXCLUDED_SECTIONS],
    },
    data: {
      intakeSessions: portableRecords("intakeSessions", intakeSessions),
      identityIdeas: portableRecords("identityIdeas", identityIdeas),
      memoryLocks: portableRecords("memoryLocks", memoryLocks),
      proofReviews: portableRecords("proofReviews", proofReviews),
    },
  };
}

function validateRecord(section, record, index, errors) {
  if (!isPlainObject(record)) {
    errors.push(`data.${section}[${index}] must be a plain object.`);
    return;
  }

  const allowed = new Set([
    "sourceId",
    ...RECORD_FIELDS[section].filter((field) => field !== "id"),
  ]);
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      errors.push(`Unknown field data.${section}[${index}].${field}.`);
    }
  }
  if (
    record.sourceId !== null &&
    record.sourceId !== undefined &&
    !isPositiveInteger(record.sourceId)
  ) {
    errors.push(`data.${section}[${index}].sourceId is invalid.`);
  }
}

function validateSwarmsyProjectBackup(data) {
  const errors = [];
  const counts = Object.fromEntries(INCLUDED_SECTIONS.map((key) => [key, 0]));

  if (!isPlainObject(data)) {
    return {
      valid: false,
      errors: ["Project backup must be a plain object."],
      summary: { counts, restoreApplied: false },
    };
  }

  if (data.schema !== PROJECT_BACKUP_SCHEMA) {
    errors.push(`Invalid project backup schema "${data.schema}".`);
  }
  if (data.version !== PROJECT_BACKUP_VERSION) {
    errors.push(`Unsupported project backup version "${data.version}".`);
  }
  if (!isIsoDate(data.exportedAt)) {
    errors.push("exportedAt must be a valid ISO date string.");
  }
  if (!isPlainObject(data.workspace)) {
    errors.push("workspace must be a plain object.");
  } else {
    if (!isPositiveInteger(data.workspace.sourceId)) {
      errors.push("workspace.sourceId must be a positive integer.");
    }
    if (!String(data.workspace.slug || "").trim()) {
      errors.push("workspace.slug is required.");
    }
    if (!String(data.workspace.name || "").trim()) {
      errors.push("workspace.name is required.");
    }
  }

  if (
    JSON.stringify(data.coverage?.included) !==
    JSON.stringify(INCLUDED_SECTIONS)
  ) {
    errors.push("coverage.included does not match version 1 coverage.");
  }
  if (
    JSON.stringify(data.coverage?.excluded) !==
    JSON.stringify(EXCLUDED_SECTIONS)
  ) {
    errors.push("coverage.excluded does not match version 1 coverage.");
  }

  if (!isPlainObject(data.data)) {
    errors.push("data must be a plain object.");
  } else {
    for (const section of INCLUDED_SECTIONS) {
      const records = data.data[section];
      if (!Array.isArray(records)) {
        errors.push(`data.${section} must be an array.`);
        continue;
      }
      counts[section] = records.length;
      records.forEach((record, index) =>
        validateRecord(section, record, index, errors)
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      schema: data.schema || null,
      version: data.version || null,
      workspaceSlug: data.workspace?.slug || null,
      counts,
      restoreApplied: false,
    },
  };
}

module.exports = {
  EXCLUDED_SECTIONS,
  INCLUDED_SECTIONS,
  PROJECT_BACKUP_SCHEMA,
  PROJECT_BACKUP_VERSION,
  buildSwarmsyProjectBackup,
  validateSwarmsyProjectBackup,
};
