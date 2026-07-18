const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const {
  getDesktopStorageContract,
} = require("../foundation/storageContractBridge.cjs");
const {
  getLocalUserSettings,
  setLocalUserSettings,
  clearLocalUserSettings,
} = require("../foundation/localSettingsStore.cjs");
const {
  exportLocalUserBackup,
  importLocalUserBackup,
} = require("../foundation/localBackupStore.cjs");
const {
  TRUSTED_DESKTOP_HOSTS,
  normalizeTrustedHost,
  isTrustedDesktopOrigin,
  runDesktopRuntimeHealthcheck,
} = require("../foundation/runtimeHealthcheck.cjs");
const {
  shouldAutoStartDesktopRuntime,
  getManualRuntimeStartCommand,
  launchDesktopLocalRuntime,
  waitForRuntimeHealthcheck,
  resolveRuntimeHealthcheckWaitTimeout,
  stopDesktopLaunchedRuntime,
} = require("../foundation/runtimeLauncher.cjs");

const STORAGE_CONTRACT_CHANNEL = "swarmsy:get-storage-contract";
const GET_LOCAL_USER_SETTINGS_CHANNEL = "swarmsy:get-local-user-settings";
const SET_LOCAL_USER_SETTINGS_CHANNEL = "swarmsy:set-local-user-settings";
const CLEAR_LOCAL_USER_SETTINGS_CHANNEL = "swarmsy:clear-local-user-settings";
const EXPORT_LOCAL_USER_BACKUP_CHANNEL = "swarmsy:export-local-user-backup";
const IMPORT_LOCAL_USER_BACKUP_CHANNEL = "swarmsy:import-local-user-backup";
const GET_RUNTIME_STATUS_CHANNEL = "swarmsy:get-runtime-status";
const RUNTIME_LOG_FILENAME = "runtime-startup.log";
const RUNTIME_LOG_TAIL_BYTES = 24 * 1024;
const repoRoot = path.resolve(__dirname, "../..");

function isPublicPackagedRuntimeLaunch({ appInstance = app } = {}) {
  return !!appInstance?.isPackaged;
}
let managedRuntimeChild = null;
let managedRuntimeStopPromise = null;
let isQuittingAfterManagedRuntimeStop = false;

function resolveStartUrl() {
  const configured = String(process.env.SWARMSY_DESKTOP_START_URL || "").trim();
  return configured || "http://127.0.0.1:3000";
}

function resolveRuntimeStartupLogPath({ env = process.env } = {}) {
  const localAppData = String(env.LOCALAPPDATA || "").trim();
  if (!localAppData) return path.join(process.cwd(), RUNTIME_LOG_FILENAME);
  return path.join(localAppData, "SWY", RUNTIME_LOG_FILENAME);
}

function readRuntimeStartupLogTail({
  env = process.env,
  readFileSyncImpl = fs.readFileSync,
  statSyncImpl = fs.statSync,
} = {}) {
  const logPath = resolveRuntimeStartupLogPath({ env });
  try {
    const stats = statSyncImpl(logPath);
    const content = readFileSyncImpl(logPath, "utf8");
    const tail =
      stats.size > RUNTIME_LOG_TAIL_BYTES
        ? content.slice(-RUNTIME_LOG_TAIL_BYTES)
        : content;
    return {
      ok: true,
      path: logPath,
      content: tail.trim(),
      truncated: stats.size > RUNTIME_LOG_TAIL_BYTES,
    };
  } catch {
    return {
      ok: false,
      path: logPath,
      content: "",
      truncated: false,
    };
  }
}

function renderFailurePage(failure) {
  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"]/g, (char) => {
      if (char === "&") return "&amp;";
      if (char === "<") return "&lt;";
      if (char === ">") return "&gt;";
      return "&quot;";
    });
  const message = String(
    failure?.message || failure || "Unknown desktop launch error"
  );
  const manualStartCommand = String(
    failure?.manualStartCommand || "yarn desktop:runtime:dev"
  );
  const configuredRetryTarget =
    process.env.SWARMSY_DESKTOP_START_URL || "http://127.0.0.1:3000";
  const safeRetryTarget = isTrustedDesktopOrigin(configuredRetryTarget)
    ? configuredRetryTarget
    : "http://127.0.0.1:3000";
  const retryUrl = escapeHtml(safeRetryTarget);
  const autoStartHint =
    failure?.reason === "runtime_auto_start_disabled"
      ? `<p>Desktop dev mode did not auto-start the local runtime because <code>SWARMSY_DESKTOP_AUTO_START_RUNTIME=true</code> was not set.</p>`
      : "";
  const expectedUrl =
    failure?.reason === "runtime_unreachable"
      || failure?.reason === "runtime_auto_start_disabled"
      || failure?.reason === "runtime_healthcheck_timeout"
      || failure?.reason === "runtime_launch_failed"
      ? String(
          failure?.startUrl ||
            process.env.SWARMSY_DESKTOP_START_URL ||
            "http://127.0.0.1:3000"
        )
      : "http://127.0.0.1:3000";
  const escaped = escapeHtml(message);
  const escapedExpectedUrl = escapeHtml(expectedUrl);
  const startupLog =
    failure?.runtimeStartupLog ||
    readRuntimeStartupLogTail({ env: failure?.env || process.env });
  const startupLogMarkup = startupLog?.ok
    ? `
        <h3 style="margin-top:24px;">Startup diagnostics</h3>
        <p>Copy this block into the bug report. It is the local runtime startup log from <code>${escapeHtml(
          startupLog.path
        )}</code>.</p>
        ${
          startupLog.truncated
            ? "<p><strong>Note:</strong> showing the latest part of a large log.</p>"
            : ""
        }
        <textarea readonly style="box-sizing:border-box;width:100%;min-height:320px;background:#020617;color:#e5e7eb;border:1px solid #334155;border-radius:8px;padding:12px;font-family:Consolas, monospace;font-size:12px;white-space:pre;">${escapeHtml(
          startupLog.content
        )}</textarea>
      `
    : `
        <h3 style="margin-top:24px;">Startup diagnostics</h3>
        <p>No runtime startup log was found at <code>${escapeHtml(
          startupLog?.path || ""
        )}</code>. This usually means the packaged runtime failed before it could write diagnostics.</p>
      `;

  return `data:text/html;charset=utf-8,${encodeURIComponent(`
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px; background: #111827; color: #f9fafb;">
        <h2>SWARMSY Desktop could not reach the local runtime</h2>
        <p>${escaped}</p>
        <p>Expected local runtime URL: <code>${escapedExpectedUrl}</code>.</p>
        ${autoStartHint}
        <p>Use the button below to retry after restarting SWARMSY Desktop. If this is a development checkout, you can still start the runtime with <code>${escapeHtml(
          manualStartCommand
        )}</code> and relaunch with <code>yarn desktop:dev</code>.</p>
        <p><a href="${retryUrl}" style="display:inline-block;background:#38bdf8;color:#0f172a;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:bold;">Retry local runtime</a></p>
        ${startupLogMarkup}
        <p>Hosted/Admin deployment is unchanged by this desktop local runtime foundation.</p>
      </body>
    </html>
  `)}`;
}

function getOrigin(targetUrl) {
  try {
    return new URL(String(targetUrl || "").trim()).origin;
  } catch {
    return "";
  }
}

function shouldOpenExternally(targetUrl, allowedOrigin) {
  try {
    const parsed = new URL(String(targetUrl || "").trim());
    return !allowedOrigin || parsed.origin !== allowedOrigin;
  } catch {
    return false;
  }
}

function isExternalWebUrl(targetUrl) {
  try {
    const parsed = new URL(String(targetUrl || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function configureWindowSecurity(window, startUrl, { shellApi = shell } = {}) {
  const allowedOrigin = getOrigin(startUrl);
  const openExternalSafely = (url) => {
    void shellApi.openExternal(url).catch((error) => {
      console.error("[desktop] Failed to open external URL:", error);
    });
  };

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (
      shouldOpenExternally(url, allowedOrigin) &&
      isExternalWebUrl(url)
    ) {
      openExternalSafely(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (shouldOpenExternally(url, allowedOrigin)) {
      event.preventDefault();
      if (isExternalWebUrl(url)) {
        openExternalSafely(url);
      }
    }
  });
}

function registerDesktopIpc({
  ipcMainApi = ipcMain,
  runtimeHealthcheck = runDesktopRuntimeHealthcheck,
} = {}) {
  ipcMainApi.removeHandler?.(STORAGE_CONTRACT_CHANNEL);
  ipcMainApi.removeHandler?.(GET_RUNTIME_STATUS_CHANNEL);
  ipcMainApi.removeHandler?.(GET_LOCAL_USER_SETTINGS_CHANNEL);
  ipcMainApi.removeHandler?.(SET_LOCAL_USER_SETTINGS_CHANNEL);
  ipcMainApi.removeHandler?.(CLEAR_LOCAL_USER_SETTINGS_CHANNEL);
  ipcMainApi.removeHandler?.(EXPORT_LOCAL_USER_BACKUP_CHANNEL);
  ipcMainApi.removeHandler?.(IMPORT_LOCAL_USER_BACKUP_CHANNEL);
  ipcMainApi.handle(GET_RUNTIME_STATUS_CHANNEL, async (event) => {
    const senderUrl =
      event?.senderFrame?.url || event?.sender?.getURL?.() || "";
    const startUrl = resolveStartUrl();
    const managed = !!managedRuntimeChild;
    if (!isTrustedDesktopOrigin(senderUrl)) {
      return {
        ok: false,
        responding: false,
        reason: "untrusted_origin",
        startUrl,
        managed,
      };
    }

    try {
      const health = await runtimeHealthcheck({ startUrl });
      if (health?.ok) {
        return {
          ok: true,
          responding: true,
          mode: health?.mode || "desktop_local_runtime",
          startUrl: health?.startUrl || startUrl,
          managed,
        };
      }

      return {
        ok: false,
        responding: false,
        reason: health?.reason || "runtime_healthcheck_failed",
        mode: health?.mode || "desktop_local_runtime",
        startUrl: health?.startUrl || startUrl,
        managed,
      };
    } catch {
      return {
        ok: false,
        responding: false,
        reason: "runtime_healthcheck_failed",
        mode: "desktop_local_runtime",
        startUrl,
        managed,
      };
    }
  });

  ipcMainApi.handle(STORAGE_CONTRACT_CHANNEL, (event) => {
    const senderUrl =
      event?.senderFrame?.url || event?.sender?.getURL?.() || "";

    if (!isTrustedDesktopOrigin(senderUrl)) {
      return null;
    }

    return getDesktopStorageContract();
  });

  ipcMainApi.handle(GET_LOCAL_USER_SETTINGS_CHANNEL, async (event) => {
    const senderUrl =
      event?.senderFrame?.url || event?.sender?.getURL?.() || "";
    if (!isTrustedDesktopOrigin(senderUrl)) {
      return { ok: false, reason: "untrusted_origin" };
    }
    return getLocalUserSettings();
  });

  ipcMainApi.handle(SET_LOCAL_USER_SETTINGS_CHANNEL, async (event, payload) => {
    const senderUrl =
      event?.senderFrame?.url || event?.sender?.getURL?.() || "";
    if (!isTrustedDesktopOrigin(senderUrl)) {
      return { ok: false, reason: "untrusted_origin" };
    }
    return setLocalUserSettings(payload || {});
  });

  ipcMainApi.handle(CLEAR_LOCAL_USER_SETTINGS_CHANNEL, async (event) => {
    const senderUrl =
      event?.senderFrame?.url || event?.sender?.getURL?.() || "";
    if (!isTrustedDesktopOrigin(senderUrl)) {
      return { ok: false, reason: "untrusted_origin" };
    }
    return clearLocalUserSettings();
  });

  ipcMainApi.handle(EXPORT_LOCAL_USER_BACKUP_CHANNEL, async (event) => {
    const senderUrl =
      event?.senderFrame?.url || event?.sender?.getURL?.() || "";
    if (!isTrustedDesktopOrigin(senderUrl)) {
      return { ok: false, reason: "untrusted_origin" };
    }
    return exportLocalUserBackup();
  });

  ipcMainApi.handle(IMPORT_LOCAL_USER_BACKUP_CHANNEL, async (event, payload) => {
    const senderUrl =
      event?.senderFrame?.url || event?.sender?.getURL?.() || "";
    if (!isTrustedDesktopOrigin(senderUrl)) {
      return { ok: false, reason: "untrusted_origin" };
    }
    return importLocalUserBackup(payload);
  });
}

async function ensureDesktopRuntimeReady({
  startUrl,
  env = process.env,
  rootDir = repoRoot,
  runtimeHealthcheck = runDesktopRuntimeHealthcheck,
  runtimeLauncher = launchDesktopLocalRuntime,
  runtimeHealthWaiter = waitForRuntimeHealthcheck,
  runtimeStopper = stopDesktopLaunchedRuntime,
  packagedRuntime = false,
  appInstance = app,
} = {}) {
  const health = await runtimeHealthcheck({ startUrl });
  if (health?.ok) {
    return {
      ok: true,
      health,
    };
  }

  if (health?.reason !== "runtime_unreachable") {
    return {
      ok: false,
      failure: health,
    };
  }

  const shouldAutoStart = shouldAutoStartDesktopRuntime({
    env,
    packagedRuntime,
  });

  if (!shouldAutoStart) {
    return {
      ok: false,
      failure: {
        ...health,
        reason: "runtime_auto_start_disabled",
        message:
          "SWARMSY local runtime is not reachable and desktop runtime auto-start is disabled.",
        manualStartCommand: getManualRuntimeStartCommand({ env }),
      },
    };
  }

  const launchEnv = {
    ...env,
    SWARMSY_DESKTOP_USER_DATA_DIR:
      env.SWARMSY_DESKTOP_USER_DATA_DIR ||
      appInstance?.getPath?.("userData") ||
      "",
  };
  const launchResult = await runtimeLauncher({
    rootDir,
    env: launchEnv,
    packagedRuntime,
  });

  if (!launchResult?.ok) {
    return {
      ok: false,
      failure: {
        ...launchResult,
        startUrl,
        manualStartCommand: getManualRuntimeStartCommand({ env }),
      },
    };
  }

  managedRuntimeChild = launchResult.child || managedRuntimeChild;

  const waitedHealth = await runtimeHealthWaiter({
    startUrl,
    launchResult,
    runtimeHealthcheckImpl: runtimeHealthcheck,
    timeoutMs: resolveRuntimeHealthcheckWaitTimeout({
      env,
      packagedRuntime,
    }),
  });

  if (!waitedHealth?.ok) {
    await runtimeStopper({
      child: launchResult.child,
    });
    if (managedRuntimeChild === launchResult.child) {
      managedRuntimeChild = null;
    }
    return {
      ok: false,
      failure: {
        ...waitedHealth,
        startUrl,
        manualStartCommand: getManualRuntimeStartCommand({ env }),
      },
    };
  }

  return {
    ok: true,
    health: waitedHealth,
  };
}

async function stopManagedRuntime({ runtimeStopper = stopDesktopLaunchedRuntime } = {}) {
  if (managedRuntimeStopPromise) return managedRuntimeStopPromise;

  if (!managedRuntimeChild) {
    return { ok: true };
  }

  const child = managedRuntimeChild;

  managedRuntimeStopPromise = Promise.resolve()
    .then(() => runtimeStopper({ child }))
    .catch((error) => ({
      ok: false,
      reason: "runtime_stop_failed",
      message: error?.message || "Failed to stop SWARMSY local runtime.",
    }))
    .finally(() => {
      if (managedRuntimeChild === child) managedRuntimeChild = null;
      managedRuntimeStopPromise = null;
    });

  return managedRuntimeStopPromise;
}

async function createWindow({
  BrowserWindowCtor = BrowserWindow,
  startUrl = null,
  shellApi = shell,
  runtimeOrchestrator = ensureDesktopRuntimeReady,
  runtimeHealthcheck = runDesktopRuntimeHealthcheck,
  appInstance = app,
} = {}) {
  const window = new BrowserWindowCtor({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.resolve(__dirname, "preload.cjs"),
    },
  });

  try {
    const resolvedStartUrl =
      startUrl !== null && startUrl !== undefined ? startUrl : resolveStartUrl();
    const runOrchestrator =
      runtimeHealthcheck === runDesktopRuntimeHealthcheck
        ? runtimeOrchestrator
        : (options) =>
            runtimeOrchestrator({
              ...options,
              runtimeHealthcheck,
            });
    const runtime = await runOrchestrator({
      startUrl: resolvedStartUrl,
      packagedRuntime: isPublicPackagedRuntimeLaunch({ appInstance }),
      appInstance,
    });
    if (!runtime?.ok) {
      await window.loadURL(renderFailurePage(runtime?.failure));
      return window;
    }
    configureWindowSecurity(window, runtime.health.startUrl, { shellApi });
    await window.loadURL(runtime.health.startUrl);
  } catch (error) {
    await window.loadURL(
      renderFailurePage({
        reason: "desktop_launch_failed",
        message: String(error?.message || error || "Unknown desktop launch error"),
      })
    );
  }

  return window;
}

function bootstrapDesktopApp({
  appInstance = app,
  BrowserWindowCtor = BrowserWindow,
  ipcMainApi = ipcMain,
  shellApi = shell,
  runtimeStopper = stopDesktopLaunchedRuntime,
} = {}) {
  registerDesktopIpc({ ipcMainApi });

  appInstance.whenReady().then(() => {
    createWindow({ BrowserWindowCtor, shellApi, appInstance }).catch(
      (error) => {
        console.error("[desktop] Failed to create window:", error);
      }
    );
    appInstance.on("activate", () => {
      if (BrowserWindowCtor.getAllWindows().length === 0) {
        createWindow({ BrowserWindowCtor, shellApi, appInstance }).catch((error) => {
          console.error("[desktop] Failed to re-create window:", error);
        });
      }
    });
  });

  appInstance.on("before-quit", (event) => {
    if (isQuittingAfterManagedRuntimeStop) return;
    event?.preventDefault?.();
    void stopManagedRuntime({ runtimeStopper }).finally(() => {
      isQuittingAfterManagedRuntimeStop = true;
      appInstance.quit();
    });
  });

  appInstance.on("window-all-closed", () => {
    void stopManagedRuntime({ runtimeStopper }).finally(() => {
      if (process.platform !== "darwin") appInstance.quit();
    });
  });
}

if (require.main === module) {
  bootstrapDesktopApp();
}

module.exports = {
  STORAGE_CONTRACT_CHANNEL,
  GET_LOCAL_USER_SETTINGS_CHANNEL,
  SET_LOCAL_USER_SETTINGS_CHANNEL,
  CLEAR_LOCAL_USER_SETTINGS_CHANNEL,
  EXPORT_LOCAL_USER_BACKUP_CHANNEL,
  IMPORT_LOCAL_USER_BACKUP_CHANNEL,
  GET_RUNTIME_STATUS_CHANNEL,
  TRUSTED_DESKTOP_HOSTS,
  normalizeTrustedHost,
  resolveStartUrl,
  resolveRuntimeStartupLogPath,
  readRuntimeStartupLogTail,
  renderFailurePage,
  isTrustedDesktopOrigin,
  shouldOpenExternally,
  isExternalWebUrl,
  configureWindowSecurity,
  registerDesktopIpc,
  ensureDesktopRuntimeReady,
  stopManagedRuntime,
  createWindow,
  isPublicPackagedRuntimeLaunch,
  bootstrapDesktopApp,
};
