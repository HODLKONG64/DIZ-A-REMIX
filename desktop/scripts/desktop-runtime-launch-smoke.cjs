#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "../..");
const packageRoot = path.join(
  repoRoot,
  "desktop",
  "artifacts",
  "swarmsy-desktop-win32-x64"
);
const desktopExecutable = path.join(packageRoot, "SWARMSY Desktop.exe");
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_RETRY_INTERVAL_MS = 1_000;

function fail(message) {
  throw new Error(message);
}

function reserveLocalPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = Number(address?.port);
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function requestText(
  targetUrl,
  { timeoutMs = 5_000, httpGetImpl = http.get } = {}
) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const request = httpGetImpl(
      targetUrl,
      { timeout: timeoutMs },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.once("error", (error) => settle(reject, error));
        response.once("aborted", () =>
          settle(reject, new Error("Response stream was aborted"))
        );
        response.once("end", () => {
          settle(resolve, {
            statusCode: response.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    request.on("timeout", () =>
      request.destroy(new Error("Request timed out"))
    );
    request.on("error", (error) => settle(reject, error));
  });
}

async function waitForCheck(
  check,
  {
    label,
    child = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryIntervalMs = DEFAULT_RETRY_INTERVAL_MS,
  } = {}
) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt <= timeoutMs) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      fail(
        `SWARMSY Desktop exited before ${label || "the smoke check"} completed.`
      );
    }
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
  }
  fail(
    `${label || "Desktop smoke check"} timed out.${
      lastError?.message ? ` Last error: ${lastError.message}` : ""
    }`
  );
}

function findLoadedDesktopPage(targets, expectedUrl) {
  const expected = new URL(expectedUrl);
  return (Array.isArray(targets) ? targets : []).find((target) => {
    if (target?.type !== "page" || !target?.url) return false;
    try {
      const loaded = new URL(target.url);
      return (
        loaded.origin === expected.origin &&
        loaded.pathname === expected.pathname &&
        loaded.search === expected.search
      );
    } catch {
      return false;
    }
  });
}

function firstRunPaths(userDataRoot) {
  const runtimeRoot = path.join(userDataRoot, "local-user-data", "runtime");
  return {
    database: path.join(runtimeRoot, "anythingllm.db"),
    jwtSecret: path.join(runtimeRoot, "local-runtime.jwt"),
    signatureSecret: path.join(runtimeRoot, "local-runtime.sig"),
    runtimeManifest: path.join(
      userDataRoot,
      "managed-local-runtime",
      "runtime-manifest.json"
    ),
  };
}

function validateFirstRunFiles(userDataRoot) {
  const files = firstRunPaths(userDataRoot);
  for (const [label, file] of Object.entries(files)) {
    if (!fs.existsSync(file))
      fail(`First-run ${label} was not created: ${file}`);
    if (fs.statSync(file).size <= 0)
      fail(`First-run ${label} is empty: ${file}`);
  }
  return files;
}

function stopWindowsProcessTree(pid, { spawnSyncImpl = spawnSync } = {}) {
  if (!Number.isInteger(Number(pid)) || Number(pid) <= 0) return false;
  const result = spawnSyncImpl("taskkill", ["/pid", String(pid), "/t", "/f"], {
    stdio: "inherit",
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

function cleanupFirstRunData(userDataRoot, { rmSyncImpl = fs.rmSync } = {}) {
  if (!String(userDataRoot || "").trim()) return false;
  try {
    rmSyncImpl(userDataRoot, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 250,
    });
    return true;
  } catch {
    return false;
  }
}

async function runDesktopRuntimeLaunchSmoke({
  platform = process.platform,
  spawnImpl = spawn,
} = {}) {
  if (platform !== "win32") {
    fail("The packaged desktop runtime launch smoke check requires Windows.");
  }
  if (!fs.existsSync(desktopExecutable)) {
    fail(`Packaged desktop executable is missing: ${desktopExecutable}`);
  }

  const runtimePort = await reserveLocalPort();
  let debugPort = await reserveLocalPort();
  while (debugPort === runtimePort) debugPort = await reserveLocalPort();

  const startUrl = `http://127.0.0.1:${runtimePort}`;
  const userDataRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "swarmsy-desktop-launch-smoke-")
  );
  const child = spawnImpl(
    desktopExecutable,
    [
      "--remote-debugging-address=127.0.0.1",
      `--remote-debugging-port=${debugPort}`,
    ],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        SERVER_PORT: String(runtimePort),
        SWARMSY_DESKTOP_START_URL: startUrl,
        SWARMSY_DESKTOP_USER_DATA_DIR: userDataRoot,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }
  );

  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  let smokeCompleted = false;
  try {
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });

    const runtimeResponse = await waitForCheck(
      async () => {
        const response = await requestText(startUrl);
        return response.statusCode >= 200 && response.statusCode < 400
          ? response
          : null;
      },
      { label: "the packaged local runtime", child }
    );
    if (!/id=["']root["']/.test(runtimeResponse.body)) {
      fail("Packaged local runtime did not serve the SWARMSY frontend shell.");
    }

    const expectedPageUrl = new URL("/onboarding", startUrl).toString();
    const loadedPage = await waitForCheck(
      async () => {
        const response = await requestText(
          `http://127.0.0.1:${debugPort}/json/list`
        );
        if (response.statusCode !== 200) return null;
        return findLoadedDesktopPage(
          JSON.parse(response.body),
          expectedPageUrl
        );
      },
      { label: "Electron to load the SWARMSY page", child }
    );

    const files = validateFirstRunFiles(userDataRoot);
    console.log(
      `[desktop:runtime:smoke] Packaged EXE stayed running and loaded ${loadedPage.url}`
    );
    console.log(
      `[desktop:runtime:smoke] Fresh first-run data created at ${path.dirname(
        files.database
      )}`
    );
    smokeCompleted = true;
    return { ok: true, startUrl, userDataRoot, loadedPage, files };
  } finally {
    const stopped = stopWindowsProcessTree(child.pid);
    const cleaned = cleanupFirstRunData(userDataRoot);
    if (!stopped) {
      const message = "Failed to stop the packaged desktop process tree.";
      if (smokeCompleted) fail(message);
      console.error(`[desktop:runtime:smoke] ${message}`);
    }
    if (!cleaned) {
      const message = `Failed to remove smoke-test data: ${userDataRoot}`;
      if (smokeCompleted) fail(message);
      console.error(`[desktop:runtime:smoke] ${message}`);
    }
  }
}

async function main() {
  try {
    await runDesktopRuntimeLaunchSmoke();
  } catch (error) {
    console.error(`[desktop:runtime:smoke] ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = {
  DEFAULT_RETRY_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  cleanupFirstRunData,
  desktopExecutable,
  findLoadedDesktopPage,
  firstRunPaths,
  packageRoot,
  requestText,
  reserveLocalPort,
  runDesktopRuntimeLaunchSmoke,
  stopWindowsProcessTree,
  validateFirstRunFiles,
  waitForCheck,
};
