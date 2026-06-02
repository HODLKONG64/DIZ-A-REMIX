const { EventEmitter } = require("events");
const path = require("path");

describe("desktop runtime launcher foundation", () => {
  const repoRoot = path.resolve(__dirname, "../../..");
  const launcherPath = path.resolve(
    repoRoot,
    "desktop/foundation/runtimeLauncher.cjs"
  );

  function createMockChild({ pid = 12345 } = {}) {
    const child = new EventEmitter();
    child.pid = pid;
    child.exitCode = null;
    child.signalCode = null;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = jest.fn((signal) => {
      child.signalCode = signal;
      child.emit("exit", 0, signal);
      return true;
    });
    return child;
  }

  it("does not auto-start runtime by default", () => {
    const { isDesktopRuntimeAutoStartEnabled } = require(launcherPath);
    expect(isDesktopRuntimeAutoStartEnabled({ env: {} })).toBe(false);
  });

  it("enables auto-start only when explicitly true", () => {
    const { isDesktopRuntimeAutoStartEnabled } = require(launcherPath);
    expect(
      isDesktopRuntimeAutoStartEnabled({
        env: { SWARMSY_DESKTOP_AUTO_START_RUNTIME: "true" },
      })
    ).toBe(true);
    expect(
      isDesktopRuntimeAutoStartEnabled({
        env: { SWARMSY_DESKTOP_AUTO_START_RUNTIME: "TRUE" },
      })
    ).toBe(true);
    expect(
      isDesktopRuntimeAutoStartEnabled({
        env: { SWARMSY_DESKTOP_AUTO_START_RUNTIME: "1" },
      })
    ).toBe(false);
  });

  it("resolves allowlisted runtime script and rejects unsafe env script names", () => {
    const { resolveRuntimeLaunchScript } = require(launcherPath);
    expect(
      resolveRuntimeLaunchScript({
        env: {},
        packageScripts: {
          "desktop:runtime:dev": "yarn dev:all",
        },
      })
    ).toEqual(
      expect.objectContaining({
        ok: true,
        scriptName: "desktop:runtime:dev",
      })
    );

    expect(
      resolveRuntimeLaunchScript({
        env: {
          SWARMSY_DESKTOP_RUNTIME_SCRIPT: "node dangerous.js",
        },
        packageScripts: {
          "desktop:runtime:dev": "yarn dev:all",
          "node dangerous.js": "node dangerous.js",
        },
      })
    ).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "unsafe_runtime_script",
      })
    );
  });

  it("launcher does not spawn when auto-start flag is disabled", async () => {
    const { launchDesktopLocalRuntime } = require(launcherPath);
    const spawnImpl = jest.fn();
    const result = await launchDesktopLocalRuntime({
      env: {},
      spawnImpl,
      packageScripts: {
        "desktop:runtime:dev": "yarn dev:all",
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "runtime_auto_start_disabled",
      })
    );
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("launcher spawns allowlisted runtime script when auto-start is enabled", async () => {
    const { launchDesktopLocalRuntime } = require(launcherPath);
    const child = createMockChild({ pid: 4242 });
    const spawnImpl = jest.fn(() => {
      setImmediate(() => child.emit("spawn"));
      return child;
    });
    const result = await launchDesktopLocalRuntime({
      env: { SWARMSY_DESKTOP_AUTO_START_RUNTIME: "true" },
      spawnImpl,
      platform: "linux",
      packageScripts: {
        "desktop:runtime:dev": "yarn dev:all",
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        pid: 4242,
        mode: "desktop_local_runtime_launcher",
        scriptName: "desktop:runtime:dev",
      })
    );
    expect(spawnImpl).toHaveBeenCalledWith(
      "yarn",
      ["run", "desktop:runtime:dev"],
      expect.objectContaining({
        shell: false,
        detached: true,
      })
    );
  });

  it("launcher returns structured failure on spawn error", async () => {
    const { launchDesktopLocalRuntime } = require(launcherPath);
    const child = createMockChild({ pid: 6789 });
    const spawnImpl = jest.fn(() => {
      setImmediate(() => child.emit("error", new Error("spawn failed")));
      return child;
    });
    const result = await launchDesktopLocalRuntime({
      env: { SWARMSY_DESKTOP_AUTO_START_RUNTIME: "true" },
      spawnImpl,
      packageScripts: {
        "desktop:runtime:dev": "yarn dev:all",
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "runtime_launch_failed",
        message: "Failed to start SWARMSY local runtime.",
      })
    );
  });

  it("healthcheck retry succeeds after initial failure", async () => {
    const { waitForRuntimeHealthcheck } = require(launcherPath);
    const runtimeHealthcheckImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        reason: "runtime_unreachable",
      })
      .mockResolvedValueOnce({
        ok: true,
        startUrl: "http://127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
      });
    const result = await waitForRuntimeHealthcheck({
      startUrl: "http://127.0.0.1:3000",
      retryIntervalMs: 1,
      timeoutMs: 100,
      runtimeHealthcheckImpl,
      launchResult: { child: createMockChild() },
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        mode: "desktop_local_runtime_launcher",
      })
    );
  });

  it("healthcheck timeout returns structured timeout failure", async () => {
    const { waitForRuntimeHealthcheck } = require(launcherPath);
    const runtimeHealthcheckImpl = jest.fn().mockResolvedValue({
      ok: false,
      reason: "runtime_unreachable",
    });
    const result = await waitForRuntimeHealthcheck({
      startUrl: "http://127.0.0.1:3000",
      retryIntervalMs: 1,
      timeoutMs: 5,
      runtimeHealthcheckImpl,
      launchResult: { child: createMockChild() },
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "runtime_healthcheck_timeout",
      })
    );
  });

  it("cleanup on quit stops only tracked child process", async () => {
    const { stopDesktopLaunchedRuntime } = require(launcherPath);
    const processKillSpy = jest.spyOn(process, "kill").mockImplementation(() => true);
    const child = createMockChild({ pid: 2222 });
    setImmediate(() => child.emit("exit", 0, "SIGTERM"));
    try {
      const result = await stopDesktopLaunchedRuntime({
        child,
        platform: "linux",
      });
      expect(result.ok).toBe(true);
      expect(processKillSpy).toHaveBeenCalledWith(-2222, "SIGTERM");
    } finally {
      processKillSpy.mockRestore();
    }
  });
});
