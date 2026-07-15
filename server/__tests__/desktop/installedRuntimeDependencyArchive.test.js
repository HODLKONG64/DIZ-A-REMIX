const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const installerBuilderPath = path.join(
  repoRoot,
  "desktop/scripts/build-windows-installer.cjs"
);
const runtimePath = path.join(
  repoRoot,
  "desktop/runtime/start-local-runtime.cjs"
);

describe("installed desktop runtime dependency archive", () => {
  it("archives production dependencies, removes them from NSIS input, and restores the artifact", () => {
    const builder = require(installerBuilderPath);
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "swarmsy-installer-deps-")
    );
    const artifactDir = path.join(tempRoot, "artifact");
    const nodeModulesPath = path.join(
      artifactDir,
      "resources/app/server/node_modules"
    );
    const runtimeDir = path.join(
      artifactDir,
      "resources/app/desktop/runtime"
    );
    fs.mkdirSync(path.join(nodeModulesPath, ".bin"), { recursive: true });
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(path.join(nodeModulesPath, ".bin/prisma"), "shim");

    const spawnSyncImpl = jest.fn((_command, args) => {
      fs.writeFileSync(args[1], "archive");
      return { status: 0, error: null };
    });

    try {
      const archivePath = builder.createRuntimeDependencyArchive({
        artifactDir,
        platform: "win32",
        spawnSyncImpl,
      });
      expect(archivePath).toBe(
        path.join(runtimeDir, builder.runtimeDependencyArchiveName)
      );
      expect(fs.statSync(archivePath).size).toBeGreaterThan(0);
      expect(spawnSyncImpl).toHaveBeenCalledWith(
        "tar.exe",
        ["-czf", archivePath, "-C", path.dirname(nodeModulesPath), "node_modules"],
        expect.objectContaining({ shell: false })
      );

      const detached = builder.detachRuntimeDependenciesForNsis({
        artifactDir,
        stagingRoot: tempRoot,
      });
      expect(fs.existsSync(nodeModulesPath)).toBe(false);
      expect(fs.existsSync(detached.detachedPath)).toBe(true);

      detached.restore();
      expect(fs.existsSync(path.join(nodeModulesPath, ".bin/prisma"))).toBe(
        true
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("extracts the installed archive into a short cache and links the managed server runtime", () => {
    const runtime = require(runtimePath);
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "swarmsy-runtime-deps-")
    );
    const appRoot = path.join(tempRoot, "app");
    const serverRoot = path.join(appRoot, "server");
    const runtimeDir = path.join(appRoot, "desktop/runtime");
    const archivePath = path.join(
      runtimeDir,
      runtime.RUNTIME_DEPENDENCY_ARCHIVE
    );
    const cacheRoot = path.join(tempRoot, "short-cache");
    fs.mkdirSync(serverRoot, { recursive: true });
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(archivePath, "archive-content");

    const spawnSyncImpl = jest.fn((_command, args) => {
      const destinationRoot = args[args.indexOf("-C") + 1];
      const prismaPath = path.join(
        destinationRoot,
        "node_modules/.bin/prisma"
      );
      fs.mkdirSync(path.dirname(prismaPath), { recursive: true });
      fs.writeFileSync(prismaPath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
      fs.mkdirSync(path.join(destinationRoot, "node_modules/express"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(destinationRoot, "node_modules/express/package.json"),
        "{}"
      );
      return { status: 0, error: null };
    });

    try {
      const linkedPath = runtime.ensureServerRuntimeDependencies(serverRoot, {
        env: { SWARMSY_DESKTOP_RUNTIME_DEPENDENCIES_DIR: cacheRoot },
        platform: "win32",
        spawnSyncImpl,
      });

      expect(linkedPath).toBe(path.join(serverRoot, "node_modules"));
      expect(fs.lstatSync(linkedPath).isSymbolicLink()).toBe(true);
      expect(runtime.resolvePrismaBin(serverRoot, { platform: "win32" })).toBe(
        path.join(serverRoot, "node_modules/.bin/prisma")
      );
      expect(
        fs.existsSync(path.join(serverRoot, "node_modules/express/package.json"))
      ).toBe(true);
      expect(spawnSyncImpl).toHaveBeenCalledTimes(1);

      runtime.ensureServerRuntimeDependencies(serverRoot, {
        env: { SWARMSY_DESKTOP_RUNTIME_DEPENDENCIES_DIR: cacheRoot },
        platform: "win32",
        spawnSyncImpl,
      });
      expect(spawnSyncImpl).toHaveBeenCalledTimes(1);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
