const path = require("path");
const { app, BrowserWindow } = require("electron");

function resolveStartUrl() {
  const configured = String(process.env.SWARMSY_DESKTOP_START_URL || "").trim();
  if (!configured) return "http://127.0.0.1:3000";

  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Unsupported protocol "${parsed.protocol}"`);
    }
    return parsed.toString();
  } catch (error) {
    throw new Error(
      `SWARMSY_DESKTOP_START_URL must be a valid http(s) URL. Received "${configured}". ${error.message}`
    );
  }
}

function renderFailurePage(error) {
  const message = String(error?.message || error || "Unknown desktop launch error");
  const escaped = message.replace(/[&<>"]/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    return "&quot;";
  });

  return `data:text/html;charset=utf-8,${encodeURIComponent(`
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px; background: #111827; color: #f9fafb;">
        <h2>SWARMSY Desktop Foundation Launch Failed</h2>
        <p>${escaped}</p>
        <p>Start URL defaults to <code>http://127.0.0.1:3000</code>.</p>
        <p>You can override with <code>SWARMSY_DESKTOP_START_URL</code> to target local dev or hosted environments.</p>
      </body>
    </html>
  `)}`;
}

async function createWindow() {
  const window = new BrowserWindow({
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
    await window.loadURL(resolveStartUrl());
  } catch (error) {
    await window.loadURL(renderFailurePage(error));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
