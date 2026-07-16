function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((output, key) => {
      output[key] = stableValue(value[key]);
      return output;
    }, {});
}

function sameJson(left, right) {
  return (
    JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
  );
}

function sameText(left, right) {
  return String(left || "").trim() === String(right || "").trim();
}

function duplicateIdentityIdea(incoming, existing) {
  return (
    sameText(incoming?.mode, existing?.mode) &&
    sameText(incoming?.title, existing?.title) &&
    sameText(incoming?.content, existing?.content)
  );
}

function duplicateContentRecord(incoming, existing) {
  return (
    sameText(incoming?.source, existing?.source) &&
    sameText(incoming?.content, existing?.content)
  );
}

function intakePlan(incoming = [], existing = null) {
  const section = {
    incoming: incoming.length,
    create: 0,
    skipDuplicate: 0,
    conflicts: [],
  };
  if (incoming.length > 1) {
    section.conflicts.push({
      code: "multiple_intake_sessions_unsupported",
      sourceId: null,
      message: "Version 1 restore planning supports at most one intake session.",
    });
    return section;
  }

  const record = incoming[0] || null;
  if (!record) return section;
  if (!existing) {
    section.create = 1;
    return section;
  }

  const duplicate =
    sameText(record.mode, existing.mode) &&
    Number(record.currentStep || 0) === Number(existing.currentStep || 0) &&
    sameJson(record.answers || {}, existing.answers || {});
  if (duplicate) {
    section.skipDuplicate = 1;
    return section;
  }

  section.conflicts.push({
    code: "active_intake_exists",
    sourceId: record.sourceId || null,
    message:
      "The destination workspace already has different active intake progress.",
  });
  return section;
}

function appendOnlyPlan(incoming, existing, duplicateCheck) {
  const section = {
    incoming: incoming.length,
    create: 0,
    skipDuplicate: 0,
    conflicts: [],
  };
  for (const record of incoming) {
    if (existing.some((item) => duplicateCheck(record, item))) {
      section.skipDuplicate += 1;
    } else {
      section.create += 1;
    }
  }
  return section;
}

function versionedContentPlan(
  incoming,
  existing,
  { conflictCode, displayName }
) {
  const section = appendOnlyPlan(incoming, existing, duplicateContentRecord);
  const hasActiveExisting = existing.some((record) => record?.isActive === true);

  for (const record of incoming) {
    if (
      record?.isActive === true &&
      hasActiveExisting &&
      !existing.some((item) => duplicateContentRecord(record, item))
    ) {
      section.conflicts.push({
        code: conflictCode,
        sourceId: record.sourceId || null,
        message: `The destination workspace already has an active ${displayName}.`,
      });
    }
  }
  return section;
}

function buildProjectBackupRestorePlan({ backup, destination } = {}) {
  const data = backup?.data || {};
  const sections = {
    intakeSessions: intakePlan(
      Array.isArray(data.intakeSessions) ? data.intakeSessions : [],
      destination?.activeSession || null
    ),
    identityIdeas: appendOnlyPlan(
      Array.isArray(data.identityIdeas) ? data.identityIdeas : [],
      Array.isArray(destination?.identityIdeas) ? destination.identityIdeas : [],
      duplicateIdentityIdea
    ),
    memoryLocks: versionedContentPlan(
      Array.isArray(data.memoryLocks) ? data.memoryLocks : [],
      Array.isArray(destination?.memoryLocks) ? destination.memoryLocks : [],
      {
        conflictCode: "active_memory_lock_exists",
        displayName: "Memory Lock",
      }
    ),
    proofReviews: versionedContentPlan(
      Array.isArray(data.proofReviews) ? data.proofReviews : [],
      Array.isArray(destination?.proofReviews) ? destination.proofReviews : [],
      {
        conflictCode: "active_proof_review_exists",
        displayName: "Proof Review",
      }
    ),
  };

  const summary = Object.values(sections).reduce(
    (totals, section) => {
      totals.incoming += section.incoming;
      totals.create += section.create;
      totals.skipDuplicate += section.skipDuplicate;
      totals.conflicts += section.conflicts.length;
      return totals;
    },
    { incoming: 0, create: 0, skipDuplicate: 0, conflicts: 0 }
  );

  return {
    restoreApplied: false,
    restoreAvailable: false,
    requiresConfirmation: true,
    blocked: summary.conflicts > 0,
    summary,
    sections,
  };
}

module.exports = { buildProjectBackupRestorePlan };
