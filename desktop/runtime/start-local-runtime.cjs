#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RUNTIME_DEPENDENCY_ARCHIVE = "server-node-modules.tar.gz";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensurePrismaStorageLink(
  serverRoot,
  storageRoot,
  { platform = process.platform } = {}
) {
  const prismaStorageRoot = path.join(serverRoot, "storage");
  if (path.resolve(prismaStorageRoot) === path.resolve(storageRoot)) {
    ensureDir(storageRoot);
    return prismaStorageRoot;
  }

  ensureDir(storageRoot);
  if (fs.existsSync(prismaStorageRoot)) {
    const current = fs.lstatSync(prismaStorageRoot);
    if (current.isSymbolicLink()) {
      if (fs.realpathSync(prismaStorageRoot) === fs.realpathSync(storageRoot)) {
        return prismaStorageRoot;
      }
      fs.unlinkSync(prismaStorageRoot);
    } else if (current.isDirectory()) {
      // Recover data written by older desktop builds before the persistent
      // storage link existed. Never overwrite a file already in Local User data.
      for (const entry of fs.readdirSync(prismaStorageRoot)) {
        const source = path.join(prismaStorageRoot, entry);
        const destination = path.join(storageRoot, entry);
        if (fs.existsSync(destination)) {
          throw new Error(
            `Cannot move legacy desktop data because ${destination} already exists.`
          );
        }
        fs.renameSync(source, destination);
      }
      fs.rmdirSync(prismaStorageRoot);
    } else {
      throw new Error(
        `Expected Prisma storage to be a directory: ${prismaStorageRoot}`
      );
    }
  }

  fs.symlinkSync(
    storageRoot,
    prismaStorageRoot,
    platform === "win32" ? "junction" : "dir"
  );
  return prismaStorageRoot;
}

function ensureLocalSecret(file) {
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, `${secret}\n`, { mode: 0o600 });
  return secret;
}

function run(command, args, options = {}) {
  const {
    platform = process.platform,
    spawnSyncImpl = spawnSync,
    ...spawnOptions
  } = options;
  const isPowerShellScript =
    platform === "win32" &&
    String(command || "")
      .toLowerCase()
      .endsWith(".ps1");
  const actualCommand = isPowerShellScript ? "powershell.exe" : command;
  const actualArgs = isPowerShellScript
    ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", command, ...args]
    : args;

  const result = spawnSyncImpl(actualCommand, actualArgs, {
    stdio: "inherit",
    shell: platform === "win32" && !isPowerShellScript,
    windowsHide: true,
    ...spawnOptions,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${actualCommand} ${actualArgs.join(" ")} exited with ${result.status}`
    );
  }
}

function resolveRuntimeDataRoot(serverRoot, { env = process.env } = {}) {
  const userDataDir = String(env.SWARMSY_DESKTOP_USER_DATA_DIR || "").trim();
  if (userDataDir) {
    return path.join(userDataDir, "local-user-data", "runtime");
  }

  const managedRoot = String(
    env.SWARMSY_DESKTOP_MANAGED_RUNTIME_DIR || ""
  ).trim();
  if (managedRoot) {
    return path.join(managedRoot, "local-user-data", "runtime");
  }

  return path.join(serverRoot, "storage");
}

function resolvePrismaBin(serverRoot, { platform = process.platform } = {}) {
  const binDir = path.join(serverRoot, "node_modules", ".bin");
  const candidates =
    platform === "win32" ? ["prisma.cmd", "prisma.ps1", "prisma"] : ["prisma"];

  for (const candidate of candidates) {
    const fullPath = path.join(binDir, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return "";
}

function resolveRuntimeDependencyArchive(serverRoot) {
  return path.resolve(
    serverRoot,
    "..",
    "desktop",
    "runtime",
    RUNTIME_DEPENDENCY_ARCHIVE
  );
}

function hashFileSync(file) {
  const hash = crypto.createHash("sha256");
  const handle = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest("hex");
}

function resolveRuntimeDependencyCacheRoot({ env = process.env } = {}) {
  const configured = String(
    env.SWARMSY_DESKTOP_RUNTIME_DEPENDENCIES_DIR || ""
  ).trim();
  if (configured) return path.resolve(configured);

  const localAppData = String(env.LOCALAPPDATA || "").trim();
  if (localAppData) return path.join(localAppData, "SWY", "d");

  const managedRoot = String(
    env.SWARMSY_DESKTOP_MANAGED_RUNTIME_DIR || ""
  ).trim();
  if (managedRoot) return path.join(path.dirname(managedRoot), "runtime-deps");

  const userDataDir = String(env.SWARMSY_DESKTOP_USER_DATA_DIR || "").trim();
  if (userDataDir) return path.join(userDataDir, "runtime-deps");

  return "";
}

function removePathIfPresent(targetPath) {
  let stat;
  try {
    stat = fs.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  if (stat.isSymbolicLink()) {
    fs.unlinkSync(targetPath);
  } else {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function extractRuntimeDependencyArchive(
  archivePath,
  destinationRoot,
  { platform = process.platform, spawnSyncImpl = spawnSync } = {}
) {
  ensureDir(destinationRoot);
  const command = platform === "win32" ? "tar.exe" : "tar";
  const result = spawnSyncImpl(
    command,
    ["-xzf", archivePath, "-C", destinationRoot],
    {
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    }
  );
  if (result.error || result.status !== 0) {
    throw (
      result.error ||
      new Error(
        `${command} exited with ${result.status} while extracting bundled server runtime dependencies.`
      )
    );
  }
}

function ensureServerRuntimeDependencies(
  serverRoot,
  {
    env = process.env,
    platform = process.platform,
    spawnSyncImpl = spawnSync,
  } = {}
) {
  const existingPrisma = resolvePrismaBin(serverRoot, { platform });
  if (existingPrisma) return path.join(serverRoot, "node_modules");

  const archivePath = resolveRuntimeDependencyArchive(serverRoot);
  if (!fs.existsSync(archivePath)) return "";

  const cacheRoot = resolveRuntimeDependencyCacheRoot({ env });
  if (!cacheRoot) {
    throw new Error(
      "Could not resolve a writable cache directory for bundled server runtime dependencies."
    );
  }

  const fingerprint = hashFileSync(archivePath).slice(0, 16);
  const dependencyRoot = path.join(cacheRoot, fingerprint);
  const dependencyNodeModules = path.join(dependencyRoot, "node_modules");
  const dependencyPrisma = resolvePrismaBin(dependencyRoot, { platform });

  if (!dependencyPrisma) {
    removePathIfPresent(dependencyRoot);
    ensureDir(dependencyRoot);
    extractRuntimeDependencyArchive(archivePath, dependencyRoot, {
      platform,
      spawnSyncImpl,
    });
  }

  if (!resolvePrismaBin(dependencyRoot, { platform })) {
    throw new Error(
      `Bundled dependency archive did not produce a Prisma CLI under ${path.join(
        dependencyNodeModules,
        ".bin"
      )}`
    );
  }

  const serverNodeModules = path.join(serverRoot, "node_modules");
  removePathIfPresent(serverNodeModules);
  fs.symlinkSync(
    dependencyNodeModules,
    serverNodeModules,
    platform === "win32" ? "junction" : "dir"
  );

  if (!resolvePrismaBin(serverRoot, { platform })) {
    throw new Error(
      `Bundled Prisma CLI is missing under ${path.join(
        serverRoot,
        "node_modules",
        ".bin"
      )}`
    );
  }

  return serverNodeModules;
}

function sqliteFileUrl(filePath) {
  return `file:${String(filePath || "").replace(/\\/g, "/")}`;
}

function initializeLocalRuntime(
  serverRoot,
  {
    env = process.env,
    platform = process.platform,
    spawnSyncImpl = spawnSync,
  } = {}
) {
  const storageRoot = resolveRuntimeDataRoot(serverRoot, { env });
  ensureDir(storageRoot);
  ensureDir(path.join(storageRoot, "documents"));
  ensureDir(path.join(storageRoot, "vector-cache"));
  ensureDir(path.join(storageRoot, "assets"));
  ensurePrismaStorageLink(serverRoot, storageRoot, { platform });
  ensureServerRuntimeDependencies(serverRoot, {
    env,
    platform,
    spawnSyncImpl,
  });

  env.NODE_ENV = "production";
  env.SERVER_PORT = env.SERVER_PORT || "3000";
  env.STORAGE_DIR = storageRoot;
  env.DATABASE_URL = sqliteFileUrl(path.join(storageRoot, "anythingllm.db"));
  env.JWT_SECRET =
    env.JWT_SECRET ||
    ensureLocalSecret(path.join(storageRoot, "local-runtime.jwt"));
  env.SIG_KEY =
    env.SIG_KEY ||
    ensureLocalSecret(path.join(storageRoot, "local-runtime.sig"));
  env.DISABLE_TELEMETRY = env.DISABLE_TELEMETRY || "true";
  env.SWARMSY_DESKTOP_LOCAL_RUNTIME = "true";

  const prismaBin = resolvePrismaBin(serverRoot, { platform });
  if (!prismaBin) {
    throw new Error(
      `Bundled Prisma CLI is missing under ${path.join(
        serverRoot,
        "node_modules",
        ".bin"
      )}`
    );
  }

  run(prismaBin, ["migrate", "deploy"], {
    cwd: serverRoot,
    env,
    platform,
    spawnSyncImpl,
  });
  run(prismaBin, ["db", "seed"], {
    cwd: serverRoot,
    env,
    platform,
    spawnSyncImpl,
  });
}

function main() {
  const serverRoot = path.resolve(__dirname, "..", "..", "server");
  if (!fs.existsSync(path.join(serverRoot, "index.js"))) {
    throw new Error(
      `Bundled SWARMSY server runtime is missing at ${serverRoot}`
    );
  }
  initializeLocalRuntime(serverRoot);
  require(path.join(serverRoot, "index.js"));
}

if (require.main === module) main();

module.exports = {
  RUNTIME_DEPENDENCY_ARCHIVE,
  ensureDir,
  ensureLocalSecret,
  ensurePrismaStorageLink,
  ensureServerRuntimeDependencies,
  extractRuntimeDependencyArchive,
  hashFileSync,
  initializeLocalRuntime,
  removePathIfPresent,
  resolvePrismaBin,
  resolveRuntimeDataRoot,
  resolveRuntimeDependencyArchive,
  resolveRuntimeDependencyCacheRoot,
  run,
  sqliteFileUrl,
};
