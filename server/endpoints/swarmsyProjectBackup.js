const { userFromSession, reqBody } = require("../utils/http");
const prisma = require("../utils/prisma");
const { Workspace } = require("../models/workspace");
const { SwarmsyMemoryLock } = require("../models/swarmsyMemoryLock");
const { SwarmsyProofReview } = require("../models/swarmsyProofReview");
const { SwarmsyIdentityIdea } = require("../models/swarmsyIdentityIdea");
const { SwarmsyIntakeSession } = require("../models/swarmsyIntakeSession");
const {
  buildSwarmsyProjectBackup,
  validateSwarmsyProjectBackup,
} = require("../utils/swarmsy/projectBackup");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");

async function resolveBackupContext(request, response) {
  const user = await userFromSession(request, response);
  const userId = Number(user?.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    response.status(401).json({
      success: false,
      message: "Project backup requires an authenticated user account.",
    });
    return null;
  }

  const slug = String(request.params?.slug || "").trim();
  const isPrivileged = [ROLES.admin, ROLES.manager].includes(user?.role);
  const workspace = isPrivileged
    ? await Workspace.get({ slug })
    : await Workspace.getWithUser(user, { slug });
  if (!workspace) {
    response.status(404).json({
      success: false,
      workspace: { exists: false },
      message:
        "Selected workspace was not found or is not available to this user.",
    });
    return null;
  }

  return { userId, workspace };
}

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

async function swarmsyProjectBackupExport(request, response) {
  try {
    const context = await resolveBackupContext(request, response);
    if (!context) return;

    const sections = await readProjectBackupSections({
      userId: context.userId,
      workspaceId: context.workspace.id,
    });
    const backup = buildSwarmsyProjectBackup({
      workspace: context.workspace,
      intakeSessions: sections.activeSession ? [sections.activeSession] : [],
      identityIdeas: sections.identityIdeas,
      memoryLocks: sections.memoryLocks,
      proofReviews: sections.proofReviews,
    });

    return response.status(200).json({
      success: true,
      backup,
      restoreAvailable: false,
      message:
        "Project export created. Restore remains disabled until conflict handling and migrations are implemented.",
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      success: false,
      message:
        "Project export failed because one or more project sections could not be read. No backup file was created.",
    });
  }
}

async function swarmsyProjectBackupValidate(request, response) {
  try {
    const user = await userFromSession(request, response);
    const userId = Number(user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return response.status(401).json({
        success: false,
        message: "Project backup validation requires an authenticated user.",
      });
    }

    const validation = validateSwarmsyProjectBackup(reqBody(request)?.backup);
    return response.status(validation.valid ? 200 : 400).json({
      success: validation.valid,
      ...validation,
      restoreAvailable: false,
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      success: false,
      valid: false,
      errors: ["Failed to validate SWARMSY project backup."],
      restoreAvailable: false,
    });
  }
}

function registerSwarmsyProjectBackupEndpoints(app) {
  if (!app) return;
  app.get(
    "/swarmsy/workspaces/:slug/project-backup/export",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    swarmsyProjectBackupExport
  );
  app.post(
    "/swarmsy/project-backup/validate",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    swarmsyProjectBackupValidate
  );
}

module.exports = {
  readProjectBackupSections,
  registerSwarmsyProjectBackupEndpoints,
  swarmsyProjectBackupExport,
  swarmsyProjectBackupValidate,
};