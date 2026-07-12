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

function normalizeContent(value) {
  const content = String(value || "").trim();
  if (!content) throw new Error("Proof Review content is required.");
  return content;
}

function normalizeSource(value = "pasted") {
  const source = String(value || "pasted")
    .trim()
    .toLowerCase();
  if (!SwarmsyProofReview.VALID_SOURCES.includes(source))
    throw new Error(`Invalid Proof Review source: ${source}`);
  return source;
}

function publicReview(row = null) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    isActive: Boolean(row.is_active),
    version: row.version,
    source: row.source,
    content: row.content,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SwarmsyProofReview = {
  VALID_SOURCES: ["pasted", "generated", "uploaded"],

  forUserWorkspace: async function ({ userId, workspaceId }) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT *
         FROM swarmsy_proof_reviews
         WHERE workspace_id = ?
           AND user_id = ?
           AND archived_at IS NULL
         ORDER BY is_active DESC, version DESC`,
        toInt(workspaceId, "workspaceId"),
        normalizeUserId(userId)
      );
      return rows.map(publicReview);
    } catch (error) {
      console.error(error.message);
      return [];
    }
  },

  getForUserWorkspace: async function ({ id, userId, workspaceId }) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT *
         FROM swarmsy_proof_reviews
         WHERE id = ?
           AND workspace_id = ?
           AND user_id = ?
           AND archived_at IS NULL
         LIMIT 1`,
        toInt(id, "id"),
        toInt(workspaceId, "workspaceId"),
        normalizeUserId(userId)
      );
      return publicReview(rows[0] || null);
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  create: async function ({
    userId,
    workspaceId,
    content,
    source = "pasted",
    isActive = true,
  }) {
    try {
      const safeWorkspaceId = toInt(workspaceId, "workspaceId");
      const safeUserId = normalizeUserId(userId);
      const safeContent = normalizeContent(content);
      const safeSource = normalizeSource(source);
      const insertedId = await prisma.$transaction(async (tx) => {
        const latestRows = await tx.$queryRawUnsafe(
          `SELECT version
           FROM swarmsy_proof_reviews
           WHERE workspace_id = ?
             AND user_id = ?
           ORDER BY version DESC
           LIMIT 1`,
          safeWorkspaceId,
          safeUserId
        );
        const version = Number(latestRows[0]?.version || 0) + 1;

        if (isActive) {
          await tx.$executeRawUnsafe(
            `UPDATE swarmsy_proof_reviews
             SET is_active = false,
                 updated_at = CURRENT_TIMESTAMP
             WHERE workspace_id = ?
               AND user_id = ?
               AND is_active = true`,
            safeWorkspaceId,
            safeUserId
          );
        }

        await tx.$executeRawUnsafe(
          `INSERT INTO swarmsy_proof_reviews
             (workspace_id, user_id, is_active, version, source, content)
           VALUES (?, ?, ?, ?, ?, ?)`,
          safeWorkspaceId,
          safeUserId,
          Boolean(isActive),
          version,
          safeSource,
          safeContent
        );

        const insertedRows = await tx.$queryRawUnsafe(
          "SELECT last_insert_rowid() AS id"
        );
        return insertedRows[0]?.id;
      });

      const review = await this.getForUserWorkspace({
        id: insertedId,
        userId: safeUserId,
        workspaceId: safeWorkspaceId,
      });
      return { review, message: null };
    } catch (error) {
      console.error(error.message);
      return { review: null, message: error.message };
    }
  },

  publicReview,
};

module.exports = { SwarmsyProofReview };
