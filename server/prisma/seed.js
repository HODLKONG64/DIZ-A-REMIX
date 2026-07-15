const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function getSystemSettingsDelegate(client) {
  return client.systemSettings || client.system_settings;
}

async function main() {
  const settings = [
    { label: "multi_user_mode", value: "false" },
    { label: "logo_filename", value: "anything-llm.png" },
  ];

  const systemSettings = getSystemSettingsDelegate(prisma);
  if (!systemSettings) {
    throw new Error(
      "Prisma model delegate for system settings is missing (expected systemSettings or system_settings)."
    );
  }

  for (const setting of settings) {
    await systemSettings.upsert({
      where: { label: setting.label },
      update: { value: setting.value },
      create: setting,
    });
  }
}

main()
  .catch((e) => {
    console.warn(
      "[desktop:runtime] Prisma seed failed, continuing startup:",
      e
    );
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
