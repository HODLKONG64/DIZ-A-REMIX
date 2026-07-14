jest.mock("../../../models/systemSettings", () => ({
  SystemSettings: {
    isMultiUserMode: jest.fn().mockResolvedValue(false),
  },
}));

const { SystemSettings } = require("../../../models/systemSettings");
const markOnboarded = require("../../../utils/boot/markOnboarded");

describe("legacy onboarding detection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_TOKEN;
    delete process.env.JWT_SECRET;
    delete process.env.LLM_PROVIDER;
    delete process.env.VECTOR_DB;
    delete process.env.SWARMSY_DESKTOP_LOCAL_RUNTIME;
    SystemSettings.isMultiUserMode.mockResolvedValue(false);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("does not treat the managed desktop JWT secret as completed onboarding", async () => {
    process.env.SWARMSY_DESKTOP_LOCAL_RUNTIME = "true";
    process.env.JWT_SECRET = "generated-desktop-secret";

    await expect(markOnboarded.isLegacyOnboarded()).resolves.toBe(false);
  });

  it("preserves JWT-based legacy detection for non-desktop deployments", async () => {
    process.env.JWT_SECRET = "existing-server-secret";

    await expect(markOnboarded.isLegacyOnboarded()).resolves.toBe(true);
  });

  it("still treats explicit desktop authentication as configured", async () => {
    process.env.SWARMSY_DESKTOP_LOCAL_RUNTIME = "true";
    process.env.JWT_SECRET = "generated-desktop-secret";
    process.env.AUTH_TOKEN = "user-selected-password";

    await expect(markOnboarded.isLegacyOnboarded()).resolves.toBe(true);
  });
});
