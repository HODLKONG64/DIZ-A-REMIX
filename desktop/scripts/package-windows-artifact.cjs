#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "../..");
const artifactsRoot = path.join(repoRoot, "desktop", "artifacts");
const appName = "swarmsy-desktop-win32-x64";
const packageRoot = path.join(artifactsRoot, appName);
const appResourcesRoot = path.join(packageRoot, "resources", "app");
const serverRuntimeRoot = path.join(appResourcesRoot, "server");
const packagedRuntimeLauncherPath = path.join(
  appResourcesRoot,
  "desktop",
  "foundation",
  "runtimeLauncher.cjs"
);
const frontendBuildEntry = path.join(
  repoRoot,
  "frontend",
  "dist",
  "_index.html"
);
const electronDistPath = process.env.ELECTRON_DIST_PATH
  ? path.resolve(process.env.ELECTRON_DIST_PATH)
  : "";

const copyEntries = [
  { from: "desktop/electron", to: "desktop/electron" },
  { from: "desktop/foundation", to: "desktop/foundation" },
  { from: "desktop/runtime", to: "desktop/runtime" },
  { from: "frontend/dist", to: "frontend/dist" },
];

function ensureExists(targetPath, label = targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} does not exist: ${targetPath}`);
  }
}

function removeIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function toPortableLower(filePath) {
  return String(filePath || "").replace(/\\/g, "/").toLowerCase();
}

function portablePathIncludes(portablePath, fragment) {
  return (
    portablePath.includes(`${fragment}/`) || portablePath.endsWith(fragment)
  );
}

function isUnderNodeModules(source) {
  return portablePathIncludes(toPortableLower(source), "/node_modules");
}

function shouldExcludeRuntimeCopy(source) {
  const base = path.basename(source).toLowerCase();
  const portable = toPortableLower(source);

  if (base.startsWith(".env") || base.endsWith(".local")) return true;
  if (
    portablePathIncludes(portable, "/.yarn") ||
    portablePathIncludes(portable, "/.yarnrc.yml") ||
    portablePathIncludes(portable, "/__tests__")
  ) {
    return true;
  }
  if (isUnderNodeModules(source)) return false;
  return [
    "/server/storage",
    "/server/documents",
    "/server/vector-cache",
    "/collector/hotdir",
    "/session-store",
  ].some((fragment) => portablePathIncludes(portable, fragment));
}

function copyDirectory(from, to, { excludeNodeModules = false } = {}) {
  ensureExists(from);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, {
    recursive: true,
    filter: (source) =>
      !(excludeNodeModules && isUnderNodeModules(source)) &&
      !shouldExcludeRuntimeCopy(source),
  });
}

function optimizePackagedRuntimeLauncher() {
  ensureExists(packagedRuntimeLauncherPath, "Packaged runtime launcher");
  const source = fs.readFileSync(packagedRuntimeLauncherPath, "utf8");
  const original = `function copyRuntimeTree(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, {
    recursive: true,
    filter: (source) => !shouldExcludeRuntimeCopy(source),
  });
}`;
  const optimized = `function copyRuntimeTree(from, to) {
  const sourceNodeModules = path.join(from, "node_modules");
  const shouldLinkNodeModules =
    path.basename(from).toLowerCase() === "server" &&
    fs.existsSync(sourceNodeModules);

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, {
    recursive: true,
    filter: (source) =>
      !(shouldLinkNodeModules && isUnderNodeModules(source)) &&
      !shouldExcludeRuntimeCopy(source),
  });

  if (shouldLinkNodeModules) {
    const managedNodeModules = path.join(to, "node_modules");
    fs.rmSync(managedNodeModules, { recursive: true, force: true });
    fs.symlinkSync(
      sourceNodeModules,
      managedNodeModules,
      process.platform === "win32" ? "junction" : "dir"
    );
  }
}`;

  if (!source.includes(original)) {
    throw new Error(
      "Packaged runtime launcher no longer contains the expected runtime-copy implementation."
    );
  }

  fs.writeFileSync(
    packagedRuntimeLauncherPath,
    source.replace(original, optimized)
  );
  console.log(
    "[desktop:artifact] Optimized first-run runtime staging to link production node_modules"
  );
}

function sanitizeProductionServerDependencies(nodeModulesPath) {
  let removed = 0;

  function removeEntry(targetPath) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } catch (error) {
      throw new Error(
        `[desktop:artifact] Failed to remove non-runtime dependency content ${targetPath}: ${error.message}`
      );
    }
    removed++;
  }

  function sanitizeDirectory(directory) {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      throw new Error(
        `[desktop:artifact] Failed to inspect production dependencies at ${directory}: ${error.message}`
      );
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const basename = entry.name.toLowerCase();
      const isUnsafeMetadata =
        basename.startsWith(".env") || basename.endsWith(".local");
      const isDeclaration =
        basename.endsWith(".d.ts") || basename.endsWith(".d.ts.map");
      const isTestDirectory = entry.isDirectory() && basename === "__tests__";

      if (isUnsafeMetadata || isDeclaration || isTestDirectory) {
        removeEntry(fullPath);
      } else if (entry.isDirectory()) {
        sanitizeDirectory(fullPath);
      }
    }
  }

  ensureExists(nodeModulesPath, "Production server node_modules");
  sanitizeDirectory(nodeModulesPath);
  if (removed > 0) {
    console.log(
      `[desktop:artifact] Removed ${removed} non-runtime dependency file(s) or directory(s)`
    );
  }
  return removed;
}

function generateProductionPrismaClient({
  runtimeServerPath,
  nodeModulesPath,
  platform = process.platform,
  yarnCommand = platform === "win32" ? "yarn.cmd" : "yarn",
  spawnSyncImpl = spawnSync,
} = {}) {
  const result = spawnSyncImpl(yarnCommand, ["prisma", "generate"], {
    cwd: runtimeServerPath,
    stdio: "inherit",
    shell: platform === "win32",
    env: { ...process.env, NODE_ENV: "production" },
  });

  if (result.error || result.status !== 0) {
    throw (
      result.error ||
      new Error(
        `${yarnCommand} prisma generate exited with ${result.status} while generating the packaged Prisma client.`
      )
    );
  }

  const generatedClientPath = path.join(
    nodeModulesPath,
    ".prisma",
    "client",
    "index.js"
  );
  ensureExists(generatedClientPath, "Generated Prisma client runtime");
  const generatedClient = fs.readFileSync(generatedClientPath, "utf8");
  if (generatedClient.includes("@prisma/client did not initialize yet")) {
    throw new Error(
      `Prisma client generation left the placeholder runtime in place: ${generatedClientPath}`
    );
  }
  console.log("[desktop:artifact] Generated packaged Prisma client runtime");
  return generatedClientPath;
}

function installProductionServerDependencies({
  runtimeServerPath = serverRuntimeRoot,
  platform = process.platform,
  spawnSyncImpl = spawnSync,
} = {}) {
  ensureExists(path.join(runtimeServerPath, "package.json"), "Server package.json");
  ensureExists(path.join(runtimeServerPath, "yarn.lock"), "Server yarn.lock");

  const yarnCommand = platform === "win32" ? "yarn.cmd" : "yarn";
  const args = [
    "install",
    "--production=true",
    "--frozen-lockfile",
    "--non-interactive",
  ];
  const result = spawnSyncImpl(yarnCommand, args, {
    cwd: runtimeServerPath,
    stdio: "inherit",
    shell: platform === "win32",
    env: { ...process.env, NODE_ENV: "production" },
  });

  if (result.error || result.status !== 0) {
    throw (
      result.error ||
      new Error(
        `${yarnCommand} exited with ${result.status} while installing the production server runtime.`
      )
    );
  }

  const nodeModulesPath = path.join(runtimeServerPath, "node_modules");
  ensureExists(nodeModulesPath, "Production server node_modules");
  ensureExists(
    path.join(nodeModulesPath, "@prisma", "client", "package.json"),
    "Prisma client runtime"
  );
  ensureExists(
    path.join(nodeModulesPath, "prisma", "package.json"),
    "Prisma CLI runtime"
  );
  generateProductionPrismaClient({
    runtimeServerPath,
    nodeModulesPath,
    platform,
    yarnCommand,
    spawnSyncImpl,
  });
  sanitizeProductionServerDependencies(nodeModulesPath);
}

function copyServerRuntime() {
  copyDirectory(path.join(repoRoot, "server"), serverRuntimeRoot, {
    excludeNodeModules: true,
  });
  installProductionServerDependencies({ runtimeServerPath: serverRuntimeRoot });
}

function writeDesktopPackageJson() {
  const rootPackage = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
  );
  const desktopPackage = {
    name: "swarmsy-desktop-artifact",
    productName: "SWARMSY Desktop",
    version: rootPackage.version || "0.0.0",
    private: true,
    main: "desktop/electron/main.cjs",
    description:
      "Unsigned SWARMSY Windows desktop artifact for GitHub Actions manual testing.",
  };
  fs.writeFileSync(
    path.join(appResourcesRoot, "package.json"),
    `${JSON.stringify(desktopPackage, null, 2)}\n`
  );
}

function copyDirectoryContents(from, to) {
  ensureExists(from);
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from)) {
    copyDirectory(path.join(from, entry), path.join(to, entry));
  }
}

function copyElectronRuntime() {
  if (!electronDistPath) {
    throw new Error(
      "ELECTRON_DIST_PATH must point to an extracted Windows Electron runtime."
    );
  }
  ensureExists(electronDistPath, "Electron runtime distribution");
  copyDirectoryContents(electronDistPath, packageRoot);
  const electronExe = path.join(packageRoot, "electron.exe");
  ensureExists(electronExe, "Electron executable");
  fs.renameSync(electronExe, path.join(packageRoot, "SWARMSY Desktop.exe"));
}

function packageAppResources() {
  for (const entry of copyEntries) {
    copyDirectory(
      path.join(repoRoot, entry.from),
      path.join(appResourcesRoot, entry.to)
    );
  }
  optimizePackagedRuntimeLauncher();
  copyServerRuntime();
  copyDirectory(
    path.join(repoRoot, "frontend", "dist"),
    path.join(serverRuntimeRoot, "public")
  );
  writeDesktopPackageJson();
}

function buildArchiveCommand({
  platform = process.platform,
  packageDirectory = packageRoot,
  archivePath = path.join(artifactsRoot, `${appName}.zip`),
} = {}) {
  if (platform === "win32") {
    return {
      command: "tar.exe",
      args: ["-a", "-c", "-f", archivePath, "-C", packageDirectory, "."],
    };
  }

  const escapedPackageRoot = packageDirectory.replace(/'/g, "''");
  const escapedArchivePath = archivePath.replace(/'/g, "''");
  return {
    command: "pwsh",
    args: [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${escapedPackageRoot}/*' -DestinationPath '${escapedArchivePath}' -Force`,
    ],
  };
}

function createZipArchive({
  platform = process.platform,
  spawnSyncImpl = spawnSync,
} = {}) {
  const archivePath = path.join(artifactsRoot, `${appName}.zip`);
  removeIfExists(archivePath);

  const archiveCommand = buildArchiveCommand({ platform, archivePath });
  const result = spawnSyncImpl(archiveCommand.command, archiveCommand.args, {
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    throw (
      result.error ||
      new Error(
        `${archiveCommand.command} exited with ${result.status} while creating the desktop artifact archive.`
      )
    );
  }
  ensureExists(archivePath, "Desktop artifact archive");
}

function main() {
  ensureExists(frontendBuildEntry, "Frontend build entry");
  removeIfExists(artifactsRoot);
  fs.mkdirSync(artifactsRoot, { recursive: true });

  copyElectronRuntime();
  fs.mkdirSync(appResourcesRoot, { recursive: true });
  packageAppResources();
  createZipArchive();

  console.log(`[desktop:artifact] Created ${packageRoot}`);
  console.log(
    `[desktop:artifact] Created ${path.join(artifactsRoot, `${appName}.zip`)}`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  appResourcesRoot,
  buildArchiveCommand,
  copyDirectory,
  copyEntries,
  copyServerRuntime,
  createZipArchive,
  generateProductionPrismaClient,
  installProductionServerDependencies,
  isUnderNodeModules,
  main,
  optimizePackagedRuntimeLauncher,
  packageAppResources,
  sanitizeProductionServerDependencies,
  serverRuntimeRoot,
  shouldExcludeRuntimeCopy,
  toPortableLower,
};
