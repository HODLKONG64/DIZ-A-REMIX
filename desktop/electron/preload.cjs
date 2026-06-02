const { contextBridge } = require("electron");
const {
  getDesktopStorageContract,
} = require("../foundation/storageContractBridge.cjs");

contextBridge.exposeInMainWorld("swarmsyDesktop", {
  foundation: {
    getStorageContract: () => getDesktopStorageContract(),
    mode: "foundation_only",
  },
});
