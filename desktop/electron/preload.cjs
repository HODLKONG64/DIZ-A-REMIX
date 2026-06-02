const { contextBridge, ipcRenderer } = require("electron");
const {
  TRUSTED_DESKTOP_HOSTS,
  normalizeTrustedHost,
  isTrustedDesktopOrigin,
} = require("../foundation/runtimeHealthcheck.cjs");

const STORAGE_CONTRACT_CHANNEL = "swarmsy:get-storage-contract";

function createDesktopBridge({ ipcRendererApi = ipcRenderer } = {}) {
  return {
    foundation: {
      getStorageContract: () => ipcRendererApi.invoke(STORAGE_CONTRACT_CHANNEL),
      mode: "foundation_only",
    },
  };
}

function exposeDesktopBridge({
  contextBridgeApi = contextBridge,
  ipcRendererApi = ipcRenderer,
  locationHref = globalThis.location?.href || "",
} = {}) {
  if (!isTrustedDesktopOrigin(locationHref)) {
    return false;
  }

  contextBridgeApi.exposeInMainWorld(
    "swarmsyDesktop",
    createDesktopBridge({ ipcRendererApi })
  );
  return true;
}

exposeDesktopBridge();

module.exports = {
  STORAGE_CONTRACT_CHANNEL,
  TRUSTED_DESKTOP_HOSTS,
  normalizeTrustedHost,
  isTrustedDesktopOrigin,
  createDesktopBridge,
  exposeDesktopBridge,
};
