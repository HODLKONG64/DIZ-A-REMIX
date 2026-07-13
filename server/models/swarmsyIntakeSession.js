const prisma = require("../utils/prisma");

function toPositiveInt(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0)
    throw new Error(`${field} must be a positive integer.`);
  return number;
}

function normalizeUserId(value) {
  if (value === null || value === undefined)
    throw new Error("userId is required.");
  return toPositiveInt(value, "userId");
}

function normalizeMode(value) {
  const mode = String(value || "")
    .trim()
    .toLowerCase();
  if (!SwarmsyIntakeSession.VALID_MODES.includes(mode))
    throw new Error(`Invalid intake mode: ${mode || "missing"}`);
  return mode;
}

function normalizeStep(value) {
  const step = Number(value);
  if (!Number.isInteger(step) || step < 0)
    throw new Error("currentStep must be a non-negative integer.");
  return step;
}

function serializeAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("answers must be an object.");
  return JSON.stringify(value);
}

function publicSession(row = null) {
  if (!row) return null;

  let answers = {};
  try {
    answers = JSON.parse(row.answers || "{}");
  } catch {
    answers = {};
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    version: row.version,
    mode: row.mode,
    status: row.status,
    isActive: Boolean(row.is_active),
    currentStep: row.current_step,
    answers,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SwarmsyIntakeSession = {
  VALID_MODES: ["face", "hidden", "existing-project"],

  activeForUserWorkspace: async function ({ userId, workspaceId }) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT *
         FROM swarmsy_intake_sessions
         WHERE workspace_id = ?
           AND user_id = ?
           AND is_active = true
           AND archived_at IS NULL
         ORDER BY version DESC
         LIMIT 1`,
        toPositiveInt(workspaceId, "workspaceId"),
        normalizeUserId(userId)
      );
      return publicSession(rows[0] || null);
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  startOrResume: async function ({ userId, workspaceId, mode }) {
    try {
      const safeWorkspaceId = toPositiveInt(workspaceId, "workspaceId");
      const safeUserId = normalizeUserId(userId);
      const safeMode = normalizeMode(mode);

      const session = await prisma.$transaction(async (tx) => {
        const activeRows = await tx.$queryRawUnsafe(
          `SELECT *
           FROM swarmsy_intake_sessions
           WHERE workspace_id = ?
             AND user_id = ?
             AND is_active = true
             AND archived_at IS NULL
           ORDER BY version DESC
           LIMIT 1`,
          safeWorkspaceId,
          safeUserId
        );
        if (activeRows[0]) return publicSession(activeRows[0]);

        const versionRows = await tx.$queryRawUnsafe(
          `SELECT COALESCE(MAX(version), 0) + 1 AS version
           FROM swarmsy_intake_sessions
           WHERE workspace_id = ?
             AND user_id = ?`,
          safeWorkspaceId,
          safeUserId
        );
        const version = Number(versionRows[0]?.version || 1);

        await tx.$executeRawUnsafe(
          `INSERT INTO swarmsy_intake_sessions
             (workspace_id, user_id, version, mode)
           VALUES (?, ?, ?, ?)`,
          safeWorkspaceId,
          safeUserId,
          version,
          safeMode
        );
        const idRows = await tx.$queryRawUnsafe(
          "SELECT last_insert_rowid() AS id"
        );
        const insertedRows = await tx.$queryRawUnsafe(
          "SELECT * FROM swarmsy_intake_sessions WHERE id = ? LIMIT 1",
          idRows[0]?.id
        );
        return publicSession(insertedRows[0] || null);
      });

      return {
        session,
        resumed: Boolean(
          session &&
            (session.currentStep > 0 ||
              Object.keys(session.answers || {}).length > 0)
        ),
        message: null,
      };
    } catch (error) {
      console.error(error.message);
      return { session: null, resumed: false, message: error.message };
    }
  },

  saveProgress: async function ({
    id,
    userId,
    workspaceId,
    currentStep,
    answers,
  }) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `UPDATE swarmsy_intake_sessions
         SET current_step = ?,
             answers = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND workspace_id = ?
           AND user_id = ?
           AND is_active = true
           AND archived_at IS NULL
         RETURNING *`,
        normalizeStep(currentStep),
        serializeAnswers(answers),
        toPositiveInt(id, "id"),
        toPositiveInt(workspaceId, "workspaceId"),
        normalizeUserId(userId)
      );
      const session = publicSession(rows[0] || null);
      return {
        session,
        message: session ? null : "Intake session not found.",
        errorCode: session ? null : "NOT_FOUND",
      };
    } catch (error) {
      console.error(error.message);
      return {
        session: null,
        message: error.message,
        errorCode: "INVALID_REQUEST",
      };
    }
  },

  complete: async function ({ id, userId, workspaceId }) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `UPDATE swarmsy_intake_sessions
         SET status = 'completed',
             is_active = false,
             completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND workspace_id = ?
           AND user_id = ?
           AND is_active = true
           AND archived_at IS NULL
         RETURNING *`,
        toPositiveInt(id, "id"),
        toPositiveInt(workspaceId, "workspaceId"),
        normalizeUserId(userId)
      );
      const session = publicSession(rows[0] || null);
      return {
        session,
        message: session ? null : "Intake session not found.",
        errorCode: session ? null : "NOT_FOUND",
      };
    } catch (error) {
      console.error(error.message);
      return {
        session: null,
        message: error.message,
        errorCode: "INVALID_REQUEST",
      };
    }
  },

  publicSession,
};

module.exports = { SwarmsyIntakeSession };
