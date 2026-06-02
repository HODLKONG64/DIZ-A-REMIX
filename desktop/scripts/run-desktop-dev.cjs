#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const repoRoot = path.resolve(__dirname, "../..");
const electronMain = path.resolve(repoRoot, "desktop/electron/main.cjs");
const electronBinary = path.resolve(
  repoRoot,
  "node_modules",
  "electron",
  "dist",
  process.platform === "win32" ? "electron.exe" : "electron"
);

if (!fs.existsSync(electronMain)) {
  console.error(
    `[desktop:dev] Missing desktop entrypoint: ${electronMain}. Desktop foundation files are incomplete.`
  );
  process.exit(1);
}

if (!fs.existsSync(electronBinary)) {
  console.error(
    `[desktop:dev] Electron binary not found at ${electronBinary}.
Install Electron once in repo root:
  yarn add --dev electron`
  );
  process.exit(1);
}

const configuredStartUrl = String(
  process.env.SWARMSY_DESKTOP_START_URL || ""
).trim();
if (!configuredStartUrl) {
  console.log(
    "[desktop:dev] SWARMSY_DESKTOP_START_URL is not set, defaulting to http://127.0.0.1:3000"
  );
}

const child = spawn(electronBinary, [electronMain], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[desktop:dev] Electron exited via signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
