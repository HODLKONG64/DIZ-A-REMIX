const fs = require("fs");
const path = require("path");
const {
  validateLocalUserStorageManifest,
} = require("../../utils/swarmsy/localUserStorageContract");

describe("SWARMSY desktop wrapper foundation", () => {
  const repoRoot = path.resolve(__dirname, "../../..");

  it("registers desktop foundation scripts at repo root", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(repoRoot, "package.json"), "utf8")
    );

    expect(packageJson.scripts["desktop:dev"]).toBe(
      "node desktop/scripts/run-desktop-dev.cjs"
    );
    expect(packageJson.scripts["desktop:smoke"]).toBe(
      "node desktop/scripts/desktop-smoke-check.cjs"
    );
  });

  it("builds desktop storage contract data from the Local User manifest contract", () => {
    const {
      getDesktopStorageContract,
    } = require(path.resolve(
      repoRoot,
      "desktop/foundation/storageContractBridge.cjs"
    ));

    const contract = getDesktopStorageContract({
      platform: "linux",
      homeDir: "/tmp/swarmsy-home",
      env: {},
    });

    expect(contract.layout.mode).toBe("local_user");
    expect(contract.layout.root).toContain("/tmp/swarmsy-home/.config/swarmsy");

    const validation = validateLocalUserStorageManifest(contract.manifest, {
      layout: contract.layout,
    });
    expect(validation.valid).toBe(true);
  });

  it("resolves the Electron shim path across supported platforms", () => {
    const {
      resolveElectronBinary,
    } = require(path.resolve(repoRoot, "desktop/scripts/run-desktop-dev.cjs"));

    expect(
      resolveElectronBinary({ platform: "linux", rootDir: "/repo" })
    ).toBe(path.posix.join("/repo", "node_modules", ".bin", "electron"));
    expect(
      resolveElectronBinary({ platform: "darwin", rootDir: "/repo" })
    ).toBe(path.posix.join("/repo", "node_modules", ".bin", "electron"));
    expect(
      resolveElectronBinary({ platform: "win32", rootDir: "C:\\repo" })
    ).toBe(path.win32.join("C:\\repo", "node_modules", ".bin", "electron.cmd"));
  });

  it("uses shell: true when spawning the Electron shim on Windows", () => {
    jest.resetModules();
    const fs = require("fs");
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);

    try {
      const { runDesktopDev } = require(path.resolve(
        repoRoot,
        "desktop/scripts/run-desktop-dev.cjs"
      ));

      const spawnImpl = jest.fn(() => ({ on: jest.fn() }));

      runDesktopDev({
        spawnImpl,
        platform: "win32",
        rootDir: path.resolve(repoRoot),
        env: { ...process.env, SWARMSY_DESKTOP_START_URL: "http://localhost:3001" },
      });

      expect(spawnImpl).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ shell: true })
      );
    } finally {
      existsSyncSpy.mockRestore();
    }
  });

  it("does not set shell: true when spawning the Electron shim on macOS/Linux", () => {
    jest.resetModules();
    const fs = require("fs");
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);

    try {
      const { runDesktopDev } = require(path.resolve(
        repoRoot,
        "desktop/scripts/run-desktop-dev.cjs"
      ));

      for (const platform of ["linux", "darwin"]) {
        const spawnImpl = jest.fn(() => ({ on: jest.fn() }));

        runDesktopDev({
          spawnImpl,
          platform,
          rootDir: path.resolve(repoRoot),
          env: { ...process.env, SWARMSY_DESKTOP_START_URL: "http://localhost:3001" },
        });

        expect(spawnImpl).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Array),
          expect.not.objectContaining({ shell: true })
        );
      }
    } finally {
      existsSyncSpy.mockRestore();
    }
  });

  it("keeps BrowserWindow sandboxed and routes storage contract IPC through main", async () => {
    jest.resetModules();
    jest.doMock(
      "electron",
      () => ({
        app: {
          whenReady: jest.fn(() => Promise.resolve()),
          on: jest.fn(),
          quit: jest.fn(),
        },
        BrowserWindow: jest.fn(),
        ipcMain: {
          handle: jest.fn(),
          removeHandler: jest.fn(),
        },
        shell: {
          openExternal: jest.fn(),
        },
      }),
      { virtual: true }
    );

    const main = require(path.resolve(repoRoot, "desktop/electron/main.cjs"));
    const shellApi = { openExternal: jest.fn() };
    const webContents = {
      setWindowOpenHandler: jest.fn(),
      on: jest.fn(),
    };
    const loadURL = jest.fn().mockResolvedValue(undefined);
    const BrowserWindowCtor = jest.fn(() => ({
      webContents,
      loadURL,
    }));

    await main.createWindow({
      BrowserWindowCtor,
      startUrl: "http://127.0.0.1:3000",
      shellApi,
    });

    expect(BrowserWindowCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          preload: path.resolve(repoRoot, "desktop/electron/preload.cjs"),
        }),
      })
    );
    expect(loadURL).toHaveBeenCalledWith("http://127.0.0.1:3000");

    const windowOpenHandler = webContents.setWindowOpenHandler.mock.calls[0][0];
    expect(windowOpenHandler({ url: "https://example.com/docs" })).toEqual({
      action: "deny",
    });
    expect(shellApi.openExternal).toHaveBeenCalledWith(
      "https://example.com/docs"
    );

    const willNavigateHandler = webContents.on.mock.calls.find(
      ([eventName]) => eventName === "will-navigate"
    )[1];
    const externalEvent = { preventDefault: jest.fn() };
    willNavigateHandler(externalEvent, "https://example.com");
    expect(externalEvent.preventDefault).toHaveBeenCalled();
    expect(shellApi.openExternal).toHaveBeenCalledWith("https://example.com");

    const internalEvent = { preventDefault: jest.fn() };
    willNavigateHandler(internalEvent, "http://127.0.0.1:3000/settings");
    expect(internalEvent.preventDefault).not.toHaveBeenCalled();

    const ipcMainApi = {
      handle: jest.fn(),
      removeHandler: jest.fn(),
    };
    main.registerDesktopIpc({ ipcMainApi });
    const ipcHandler = ipcMainApi.handle.mock.calls[0][1];

    const trustedContract = ipcHandler({
      senderFrame: { url: "http://localhost:3000" },
    });
    expect(trustedContract).toEqual(
      expect.objectContaining({
        layout: expect.objectContaining({ mode: "local_user" }),
        manifest: expect.any(Object),
      })
    );
    expect(
      validateLocalUserStorageManifest(trustedContract.manifest, {
        layout: trustedContract.layout,
      }).valid
    ).toBe(true);

    expect(
      ipcHandler({
        senderFrame: { url: "https://hosted.example.com" },
      })
    ).toBeNull();
  });

  it("only exposes the preload bridge on trusted local origins", async () => {
    jest.resetModules();
    const exposeInMainWorld = jest.fn();
    const invoke = jest.fn().mockResolvedValue({ ok: true });
    jest.doMock(
      "electron",
      () => ({
        contextBridge: { exposeInMainWorld },
        ipcRenderer: { invoke },
      }),
      { virtual: true }
    );

    global.location = { href: "https://hosted.example.com" };
    const preload = require(path.resolve(repoRoot, "desktop/electron/preload.cjs"));
    expect(exposeInMainWorld).not.toHaveBeenCalled();

    const trustedContextBridge = { exposeInMainWorld: jest.fn() };
    const trustedIpcRenderer = { invoke: jest.fn().mockResolvedValue({ ok: true }) };
    const didExpose = preload.exposeDesktopBridge({
      contextBridgeApi: trustedContextBridge,
      ipcRendererApi: trustedIpcRenderer,
      locationHref: "http://127.0.0.1:3000",
    });

    expect(didExpose).toBe(true);
    expect(trustedContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      "swarmsyDesktop",
      expect.objectContaining({
        foundation: expect.objectContaining({
          mode: "foundation_only",
          getStorageContract: expect.any(Function),
        }),
      })
    );

    const bridge =
      trustedContextBridge.exposeInMainWorld.mock.calls[0][1].foundation;
    expect(await bridge.getStorageContract()).toEqual({ ok: true });
    expect(trustedIpcRenderer.invoke).toHaveBeenCalledWith(
      "swarmsy:get-storage-contract"
    );
    expect(preload.isTrustedDesktopOrigin("https://hosted.example.com")).toBe(
      false
    );
    expect(preload.isTrustedDesktopOrigin("http://localhost:3000")).toBe(true);
  });
});
