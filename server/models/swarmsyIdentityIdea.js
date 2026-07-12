const prisma = require("../utils/prisma");

function toInt(value, field = "value") {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0)
    throw new Error(`${field} must be a positive integer.`);
  return number;
}

function normalizeUserId(value) {
  if (value === null || value === undefined)
    throw new Error("userId is required.");
  return toInt(value, "userId");
}

function normalizeRequiredText(value, field) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function normalizeMode(value) {
  const mode = String(value || "")
    .trim()
    .toLowerCase();
  if (!SwarmsyIdentityIdea.VALID_MODES.includes(mode))
    throw new Error(`Invalid Identity Idea mode: ${mode || "missing"}`);
  return mode;
}

function normalizeDecision(value) {
  const decision = String(value || "")
    .trim()
    .toLowerCase();
  if (!SwarmsyIdentityIdea.VALID_DECISIONS.includes(decision))
    throw new Error(`Invalid Identity Idea decision: ${decision || "missing"}`);
  return decision;
}

function publicIdea(row = null) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    mode: row.mode,
    status: row.status,
    title: row.title,
    content: row.content,
    approvedAt: row.approved_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SwarmsyIdentityIdea = {
  VALID_MODES: ["face", "hidden", "existing-project"],
  VALID_DECISIONS: ["keep", "save", "delete"],

  forUserWorkspace: async function ({ userId, workspaceId }) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT *
         FROM swarmsy_identity_ideas
         WHERE workspace_id = ?
           AND user_id = ?
           AND deleted_at IS NULL
         ORDER BY updated_at DESC, id DESC`,
        toInt(workspaceId, "workspaceId"),
        normalizeUserId(userId)
      );
      return rows.map(publicIdea);
    } catch (error) {
      console.error(error.message);
      return [];
    }
  },

  getForUserWorkspace: async function ({ id, userId, workspaceId }) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT *
         FROM swarmsy_identity_ideas
         WHERE id = ?
           AND workspace_id = ?
           AND user_id = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        toInt(id, "id"),
        toInt(workspaceId, "workspaceId"),
        normalizeUserId(userId)
      );
      return publicIdea(rows[0] || null);
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  createProposal: async function ({ userId, workspaceId, mode, title, content }) {
    try {
      const safeWorkspaceId = toInt(workspaceId, "workspaceId");
      const safeUserId = normalizeUserId(userId);
      const safeMode = normalizeMode(mode);
      const safeTitle = normalizeRequiredText(title, "Identity Idea title");
      const safeContent = normalizeRequiredText(content, "Identity Idea content");

      const insertedId = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO swarmsy_identity_ideas
             (workspace_id, user_id, mode, status, title, content)
           VALUES (?, ?, ?, 'proposed', ?, ?)`,
          safeWorkspaceId,
          safeUserId,
          safeMode,
          safeTitle,
          safeContent
        );
        const rows = await tx.$queryRawUnsafe(
          "SELECT last_insert_rowid() AS id"
        );
        return rows[0]?.id;
      });

      const idea = await this.getForUserWorkspace({
        id: insertedId,
        userId: safeUserId,
        workspaceId: safeWorkspaceId,
      });
      return { idea, message: null };
    } catch (error) {
      console.error(error.message);
      return { idea: null, message: error.message };
    }
  },

  decide: async function ({ id, userId, workspaceId, decision }) {
    try {
      const safeId = toInt(id, "id");
      const safeWorkspaceId = toInt(workspaceId, "workspaceId");
      const safeUserId = normalizeUserId(userId);
      const safeDecision = normalizeDecision(decision);
      const status = {
        keep: "kept",
        save: "saved",
        delete: "deleted",
      }[safeDecision];

      const rows = await prisma.$queryRawUnsafe(
        `UPDATE swarmsy_identity_ideas
         SET status = ?,
             approved_at = CASE WHEN ? = 'saved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
             deleted_at = CASE WHEN ? = 'deleted' THEN CURRENT_TIMESTAMP ELSE deleted_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND workspace_id = ?
           AND user_id = ?
           AND deleted_at IS NULL
         RETURNING *`,
        status,
        status,
        status,
        safeId,
        safeWorkspaceId,
        safeUserId
      );
      const idea = publicIdea(rows[0] || null);
      return {
        idea,
        message: idea ? null : "Identity Idea not found.",
      };
    } catch (error) {
      console.error(error.message);
      return { idea: null, message: error.message };
    }
  },

  publicIdea,
};

module.exports = { SwarmsyIdentityIdea };
