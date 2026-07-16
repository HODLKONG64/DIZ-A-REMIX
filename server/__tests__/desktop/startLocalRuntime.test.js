const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const runtimePath = path.join(
  repoRoot,
  "desktop/runtime/start-local-runtime.cjs"
);

function makeExecutable(targetPath, contents = "#!/bin/sh\nexit 0\n") {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents, { mode: 0o755 });
}

describe("packaged desktop local runtime entrypoint", () => {
  it("resolves the persistent runtime startup log under LocalAppData", () => {
    const { resolveRuntimeStartupLogPath } = require(runtimePath);

    expect(
      resolveRuntimeStartupLogPath({
        env: { LOCALAPPDATA: "C:\\Users\\GOD\\AppData\\Local" },
      })
    ).toBe(
      path.join("C:\\Users\\GOD\\AppData\\Local", "SWY", "runtime-startup.log")
    );
  });

  it("resolves persistent runtime data outside the managed app copy", () => {
    const { resolveRuntimeDataRoot } = require(runtimePath);
    const serverRoot = path.join(
      "/tmp",
      "managed-local-runtime",
      "app",
      "server"
    );

    expect(
      resolveRuntimeDataRoot(serverRoot, {
        env: { SWARMSY_DESKTOP_USER_DATA_DIR: "/tmp/swarmsy-user" },
      })
    ).toBe(path.join("/tmp/swarmsy-user", "local-user-data", "runtime"));

    expect(
      resolveRuntimeDataRoot(serverRoot, {
        env: { SWARMSY_DESKTOP_MANAGED_RUNTIME_DIR: "/tmp/managed" },
      })
    ).toBe(path.join("/tmp/managed", "local-user-data", "runtime"));

    expect(resolveRuntimeDataRoot(serverRoot, { env: {} })).toBe(
      path.join(serverRoot, "storage")
    );
  });

  it("resolves platform-tolerant Prisma shims", () => {
    const { resolvePrismaBin } = require(runtimePath);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "swarmsy-prisma-"));
    const binDir = path.join(root, "node_modules", ".bin");

    makeExecutable(path.join(binDir, "prisma.ps1"), "");
    expect(resolvePrismaBin(root, { platform: "win32" })).toBe(
      path.join(binDir, "prisma.ps1")
    );

    makeExecutable(path.join(binDir, "prisma.cmd"), "");
    expect(resolvePrismaBin(root, { platform: "win32" })).toBe(
      path.join(binDir, "prisma.cmd")
    );

    fs.rmSync(path.join(binDir, "prisma.cmd"), { force: true });
    fs.rmSync(path.join(binDir, "prisma.ps1"), { force: true });
    makeExecutable(path.join(binDir, "prisma"));
    expect(resolvePrismaBin(root, { platform: "linux" })).toBe(
      path.join(binDir, "prisma")
    );
  });

  it("runs PowerShell Prisma shims through powershell.exe", () => {
    const { run } = require(runtimePath);
    const spawnSyncImpl = jest.fn(() => ({ status: 0 }));

    const prismaPs1 = path.win32.join(
      "C:\\app",
      "node_modules",
      ".bin",
      "prisma.ps1"
    );
    run(prismaPs1, ["migrate", "deploy"], {
      platform: "win32",
      spawnSyncImpl,
      cwd: "C:\\app",
    });

    expect(spawnSyncImpl).toHaveBeenCalledWith(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        prismaPs1,
        "migrate",
        "deploy",
      ],
      expect.objectContaining({ shell: false, cwd: "C:\\app" })
    );
  });

  it("runs Windows cmd Prisma shims through cmd shell", () => {
    const { run } = require(runtimePath);
    const spawnSyncImpl = jest.fn(() => ({ status: 0 }));

    const prismaCmd = path.win32.join(
      "C:\\app",
      "node_modules",
      ".bin",
      "prisma.cmd"
    );
    run(prismaCmd, ["db", "seed"], {
      platform: "win32",
      spawnSyncImpl,
    });

    expect(spawnSyncImpl).toHaveBeenCalledWith(
      prismaCmd,
      ["db", "seed"],
      expect.objectContaining({ shell: true })
    );
  });

  it("initializes local storage and preserves secrets outside app code", () => {
    const { initializeLocalRuntime } = require(runtimePath);
    const serverRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "swarmsy-server-")
    );
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), "swarmsy-user-"));
    makeExecutable(path.join(serverRoot, "node_modules", ".bin", "prisma"));

    const env = { SWARMSY_DESKTOP_USER_DATA_DIR: userData };
    initializeLocalRuntime(serverRoot, { env });

    const runtimeRoot = path.join(userData, "local-user-data", "runtime");
    const jwtPath = path.join(runtimeRoot, "local-runtime.jwt");
    const firstJwt = fs.readFileSync(jwtPath, "utf8");

    expect(env.STORAGE_DIR).toBe(runtimeRoot);
    expect(env.DATABASE_URL).toBe(
      `file:${path.join(runtimeRoot, "anythingllm.db").replace(/\\/g, "/")}`
    );
    expect(fs.existsSync(path.join(runtimeRoot, "documents"))).toBe(true);
    expect(fs.existsSync(path.join(runtimeRoot, "vector-cache"))).toBe(true);
    expect(fs.existsSync(path.join(runtimeRoot, "assets"))).toBe(true);
    expect(
      fs.lstatSync(path.join(serverRoot, "storage")).isSymbolicLink()
    ).toBe(true);
    expect(fs.realpathSync(path.join(serverRoot, "storage"))).toBe(
      fs.realpathSync(runtimeRoot)
    );
    expect(env.DATABASE_URL.includes(serverRoot.replace(/\\/g, "/"))).toBe(
      false
    );

    initializeLocalRuntime(serverRoot, { env });
    expect(fs.readFileSync(jwtPath, "utf8")).toBe(firstJwt);
  });

  it("writes startup diagnostics when Prisma migration fails", () => {
    const {
      initializeLocalRuntime,
      resolveRuntimeStartupLogPath,
    } = require(runtimePath);
    const serverRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "swarmsy-server-")
    );
    const localAppData = fs.mkdtempSync(path.join(os.tmpdir(), "swarmsy-appdata-"));
    const prismaBin = path.join(serverRoot, "node_modules", ".bin", "prisma");
    makeExecutable(prismaBin);

    const env = { LOCALAPPDATA: localAppData };
    const spawnSyncImpl = jest.fn(() => ({
      status: 1,
      stdout: "migration stdout",
      stderr: "migration stderr",
    }));

    expect(() =>
      initializeLocalRuntime(serverRoot, {
        env,
        spawnSyncImpl,
      })
    ).toThrow(/exited with 1/);

    const logPath = resolveRuntimeStartupLogPath({ env });
    const log = fs.readFileSync(logPath, "utf8");

    expect(logPath).toBe(
      path.join(localAppData, "SWY", "runtime-startup.log")
    );
    expect(log).toContain("startup failed");
    expect(log).toContain("Stage:");
    expect(log).toContain("prisma migrate deploy");
    expect(log).toContain("Exit code: 1");
    expect(log).toContain("migration stdout");
    expect(log).toContain("migration stderr");
    expect(log).toContain("Command:");
  });

  it("writes startup diagnostics when server startup throws", () => {
    const { startServerRuntime, resolveRuntimeStartupLogPath } = require(runtimePath);
    const serverRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "swarmsy-server-")
    );
    const localAppData = fs.mkdtempSync(path.join(os.tmpdir(), "swarmsy-appdata-"));
    makeExecutable(path.join(serverRoot, "node_modules", ".bin", "prisma"));
    fs.mkdirSync(serverRoot, { recursive: true });
    fs.writeFileSync(
      path.join(serverRoot, "index.js"),
      'throw new Error("server boot exploded");'
    );

    const env = { LOCALAPPDATA: localAppData };
    const spawnSyncImpl = jest.fn(() => ({ status: 0 }));

    expect(() =>
      startServerRuntime(serverRoot, {
        env,
        spawnSyncImpl,
      })
    ).toThrow(/server boot exploded/);

    const logPath = resolveRuntimeStartupLogPath({ env });
    const log = fs.readFileSync(logPath, "utf8");

    expect(log).toContain("server startup");
    expect(log).toContain("server boot exploded");
    expect(log).toContain("require(");
  });

  it("moves legacy packaged database files into persistent Local User storage", () => {
    const { ensurePrismaStorageLink } = require(runtimePath);
    const serverRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "swarmsy-server-")
    );
    const storageRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "swarmsy-runtime-storage-")
    );
    const oldStorageRoot = path.join(serverRoot, "storage");
    fs.mkdirSync(oldStorageRoot);
    fs.writeFileSync(path.join(oldStorageRoot, "anythingllm.db"), "legacy-db");

    ensurePrismaStorageLink(serverRoot, storageRoot, { platform: "linux" });

    expect(
      fs.readFileSync(path.join(storageRoot, "anythingllm.db"), "utf8")
    ).toBe("legacy-db");
    expect(fs.lstatSync(oldStorageRoot).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(oldStorageRoot)).toBe(fs.realpathSync(storageRoot));
  });

  it("throws a clear error when no Prisma shim is bundled", () => {
    const { initializeLocalRuntime } = require(runtimePath);
    const serverRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "swarmsy-server-")
    );

    expect(() =>
      initializeLocalRuntime(serverRoot, {
        env: { SWARMSY_DESKTOP_USER_DATA_DIR: os.tmpdir() },
      })
    ).toThrow(/Bundled Prisma CLI is missing under/);
  });
});
