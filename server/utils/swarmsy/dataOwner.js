const bcrypt = require("bcryptjs");
const { randomBytes } = require("crypto");
const prisma = require("../prisma");
const { User } = require("../../models/user");
const { SystemSettings } = require("../../models/systemSettings");
const { userFromSession } = require("../http");

const LOCAL_SWARMSY_OWNER_USERNAME = "swarmsy-local-owner";

async function ensureLocalSwarmsyOwner() {
  const existing = await prisma.users.findUnique({
    where: { username: LOCAL_SWARMSY_OWNER_USERNAME },
  });
  if (existing) {
    if (Number(existing.suspended) !== 1) {
      throw new Error("Reserved SWARMSY Local User owner is not suspended.");
    }
    return User.filterFields(existing);
  }

  const password = bcrypt.hashSync(randomBytes(48).toString("hex"), 10);
  try {
    const created = await prisma.users.create({
      data: {
        username: LOCAL_SWARMSY_OWNER_USERNAME,
        password,
        role: "default",
        suspended: 1,
      },
    });
    return User.filterFields(created);
  } catch (error) {
    const concurrent = await prisma.users.findUnique({
      where: { username: LOCAL_SWARMSY_OWNER_USERNAME },
    });
    if (concurrent && Number(concurrent.suspended) === 1) {
      return User.filterFields(concurrent);
    }
    throw error;
  }
}

async function resolveSwarmsyDataOwner(request, response) {
  const sessionUser = await userFromSession(request, response);
  const sessionUserId = Number(sessionUser?.id);
  if (Number.isInteger(sessionUserId) && sessionUserId > 0) {
    return {
      user: sessionUser,
      userId: sessionUserId,
      isLocalUser: false,
    };
  }

  const multiUserMode =
    response.locals?.multiUserMode ?? (await SystemSettings.isMultiUserMode());
  if (multiUserMode) return null;

  const localUser = await ensureLocalSwarmsyOwner();
  return {
    user: localUser,
    userId: Number(localUser.id),
    isLocalUser: true,
  };
}

module.exports = {
  LOCAL_SWARMSY_OWNER_USERNAME,
  ensureLocalSwarmsyOwner,
  resolveSwarmsyDataOwner,
};
