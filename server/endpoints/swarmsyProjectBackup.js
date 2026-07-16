const { reqBody } = require("../utils/http");
const { Workspace } = require("../models/workspace");
const {
  buildSwarmsyProjectBackup,
  validateSwarmsyProjectBackup,
} = require("../utils/swarmsy/projectBackup");
const {
  readProjectBackupSections,
} = require("../utils/swarmsy/projectBackupReader");
const {
  buildProjectBackupRestorePlan,
} = require("../utils/swarmsy/projectBackupRestorePlan");
const { resolveSwarmsyDataOwner } = require("../utils/swarmsy/dataOwner");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  isSingleUserMode,
  ROLES,
} = require("../utils/middleware/multiUserProtected");

async function resolveBackupContext(request, response) {
  const owner = await resolveSwarmsyDataOwner(request, response);
  if (!owner) {
    response.status(401).json({
      success: false,
      message: "Project backup requires an authenticated owner.",
    });
    return null;
  }

  const slug = String(request.params?.slug || "").trim();
  const isPrivileged =
    owner.isLocalUser ||
    [ROLES.admin, ROLES.manager].includes(owner.user?.role);
  const workspace = isPrivileged
    ? await Workspace.get({ slug })
    : await Workspace.getWithUser(owner.user, { slug });
  if (!workspace) {
    response.status(404).json({
      success: false,
      workspace: { exists: false },
      message:
        "Selected workspace was not found or is not available to this owner.",
    });
    return null;
  }

  return { userId: owner.userId, workspace };
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
    const owner = await resolveSwarmsyDataOwner(request, response);
    if (!owner) {
      return response.status(401).json({
        success: false,
        message: "Project backup validation requires an authenticated owner.",
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

async function swarmsyProjectBackupRestorePlan(request, response) {
  try {
    const context = await resolveBackupContext(request, response);
    if (!context) return;

    const backup = reqBody(request)?.backup;
    const validation = validateSwarmsyProjectBackup(backup);
    if (!validation.valid) {
      return response.status(400).json({
        success: false,
        ...validation,
        restoreApplied: false,
        restoreAvailable: false,
      });
    }

    const destination = await readProjectBackupSections({
      userId: context.userId,
      workspaceId: context.workspace.id,
    });
    const plan = buildProjectBackupRestorePlan({ backup, destination });

    return response.status(200).json({
      success: true,
      valid: true,
      destination: {
        id: context.workspace.id,
        slug: context.workspace.slug,
        name: context.workspace.name,
      },
      ...plan,
      message: plan.blocked
        ? "Restore planning found conflicts that must be resolved before any data can be applied."
        : "Restore plan is ready for review. No workspace data was changed.",
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      success: false,
      valid: false,
      restoreApplied: false,
      restoreAvailable: false,
      message:
        "Restore planning failed because the destination workspace could not be read safely.",
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
  app.post(
    "/swarmsy/workspaces/:slug/project-backup/restore-plan",
    [validatedRequest, isSingleUserMode],
    swarmsyProjectBackupRestorePlan
  );
}

module.exports = {
  registerSwarmsyProjectBackupEndpoints,
  swarmsyProjectBackupExport,
  swarmsyProjectBackupRestorePlan,
  swarmsyProjectBackupValidate,
};
