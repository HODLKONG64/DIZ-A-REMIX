const prisma = require("../prisma");
const { SwarmsyMemoryLock } = require("../../models/swarmsyMemoryLock");
const { SwarmsyProofReview } = require("../../models/swarmsyProofReview");
const { SwarmsyIdentityIdea } = require("../../models/swarmsyIdentityIdea");
const { SwarmsyIntakeSession } = require("../../models/swarmsyIntakeSession");

async function readProjectBackupSections({ userId, workspaceId }) {
  const [sessionRows, ideaRows, lockRows, reviewRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT *
       FROM swarmsy_intake_sessions
       WHERE workspace_id = ?
         AND user_id = ?
         AND is_active = true
         AND archived_at IS NULL
       ORDER BY version DESC
       LIMIT 1`,
      workspaceId,
      userId
    ),
    prisma.$queryRawUnsafe(
      `SELECT *
       FROM swarmsy_identity_ideas
       WHERE workspace_id = ?
         AND user_id = ?
         AND deleted_at IS NULL
       ORDER BY updated_at DESC, id DESC`,
      workspaceId,
      userId
    ),
    prisma.$queryRawUnsafe(
      `SELECT *
       FROM swarmsy_memory_locks
       WHERE workspace_id = ?
         AND user_id = ?
         AND archived_at IS NULL
       ORDER BY is_active DESC, version DESC`,
      workspaceId,
      userId
    ),
    prisma.$queryRawUnsafe(
      `SELECT *
       FROM swarmsy_proof_reviews
       WHERE workspace_id = ?
         AND user_id = ?
         AND archived_at IS NULL
       ORDER BY is_active DESC, version DESC`,
      workspaceId,
      userId
    ),
  ]);

  return {
    activeSession: SwarmsyIntakeSession.publicSession(sessionRows[0] || null),
    identityIdeas: ideaRows.map(SwarmsyIdentityIdea.publicIdea),
    memoryLocks: lockRows.map(SwarmsyMemoryLock.publicLock),
    proofReviews: reviewRows.map(SwarmsyProofReview.publicReview),
  };
}

module.exports = { readProjectBackupSections };
