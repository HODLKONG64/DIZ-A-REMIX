#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureLocalSecret(file) {
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, `${secret}\n`, { mode: 0o600 });
  return secret;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.status}`
    );
  }
}

function resolvePrismaBin(serverRoot) {
  const suffix = process.platform === "win32" ? "prisma.cmd" : "prisma";
  return path.join(serverRoot, "node_modules", ".bin", suffix);
}

function initializeLocalRuntime(serverRoot) {
  const storageRoot = path.join(serverRoot, "storage");
  ensureDir(storageRoot);
  ensureDir(path.join(storageRoot, "documents"));
  ensureDir(path.join(storageRoot, "vector-cache"));
  ensureDir(path.join(storageRoot, "assets"));

  process.env.NODE_ENV = "production";
  process.env.SERVER_PORT = process.env.SERVER_PORT || "3000";
  process.env.STORAGE_DIR = storageRoot;
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ||
    ensureLocalSecret(path.join(storageRoot, "local-runtime.jwt"));
  process.env.SIG_KEY =
    process.env.SIG_KEY ||
    ensureLocalSecret(path.join(storageRoot, "local-runtime.sig"));
  process.env.DISABLE_TELEMETRY = process.env.DISABLE_TELEMETRY || "true";
  process.env.SWARMSY_DESKTOP_LOCAL_RUNTIME = "true";

  const prismaBin = resolvePrismaBin(serverRoot);
  if (!fs.existsSync(prismaBin)) {
    throw new Error(`Bundled Prisma CLI is missing at ${prismaBin}`);
  }

  run(prismaBin, ["migrate", "deploy"], {
    cwd: serverRoot,
    env: process.env,
  });
  run(prismaBin, ["db", "seed"], { cwd: serverRoot, env: process.env });
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

main();
