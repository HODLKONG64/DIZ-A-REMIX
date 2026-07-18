const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const mainPath = path.join(repoRoot, "desktop/electron/main.cjs");

describe("desktop runtime failure diagnostics page", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock(
      "electron",
      () => ({
        app: {},
        BrowserWindow: jest.fn(),
        ipcMain: { handle: jest.fn(), removeHandler: jest.fn() },
        shell: { openExternal: jest.fn() },
      }),
      { virtual: true }
    );
  });

  it("shows runtime startup diagnostics on the normal-user failure page", () => {
    const main = require(mainPath);
    const failurePage = main.renderFailurePage({
      reason: "runtime_launch_failed",
      message:
        "SWARMSY local runtime exited before passing desktop healthcheck.",
      startUrl: "http://127.0.0.1:3000",
      runtimeStartupLog: {
        ok: true,
        path: "C:\\Users\\GOD\\AppData\\Local\\SWY\\runtime-startup.log",
        content:
          "[SWARMSY runtime] startup failed\nStage:\nprisma migrate deploy\nError: migration failed",
        truncated: false,
      },
    });
    const failureMarkup = decodeURIComponent(failurePage.split(",")[1]);

    expect(failureMarkup).toContain("Startup diagnostics");
    expect(failureMarkup).toContain("runtime-startup.log");
    expect(failureMarkup).toContain("prisma migrate deploy");
    expect(failureMarkup).toContain("migration failed");
  });

  it("reads only the startup log tail from disk", () => {
    const main = require(mainPath);
    const logPath = path.join(
      "C:\\Users\\GOD\\AppData\\Local",
      "SWY",
      "runtime-startup.log"
    );
    const openSyncImpl = jest.fn(() => 42);
    const closeSyncImpl = jest.fn();
    const readSyncImpl = jest.fn((fd, buffer, offset, length, position) => {
      expect(fd).toBe(42);
      expect(offset).toBe(0);
      expect(length).toBe(24 * 1024);
      expect(position).toBe(1024);
      const written = buffer.write("latest diagnostics");
      return written;
    });

    const result = main.readRuntimeStartupLogTail({
      env: { LOCALAPPDATA: "C:\\Users\\GOD\\AppData\\Local" },
      statSyncImpl: jest.fn(() => ({ size: 25 * 1024 })),
      openSyncImpl,
      readSyncImpl,
      closeSyncImpl,
    });

    expect(result).toEqual({
      ok: true,
      path: logPath,
      content: "latest diagnostics",
      truncated: true,
    });
    expect(openSyncImpl).toHaveBeenCalledWith(logPath, "r");
    expect(closeSyncImpl).toHaveBeenCalledWith(42);
  });
});
