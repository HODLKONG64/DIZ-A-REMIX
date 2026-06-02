const os = require("os");
const path = require("path");
const {
  LOCAL_USER_STORAGE_SCHEMA,
  LOCAL_USER_STORAGE_VERSION,
  STORAGE_LAYOUT_SEGMENTS,
  REQUIRED_PATH_KEYS,
  getLocalUserDataRoot,
  getLocalUserStorageLayout,
  validateLocalUserStoragePath,
  createLocalUserStorageManifest,
  validateLocalUserStorageManifest,
} = require("../../../utils/swarmsy/localUserStorageContract");

describe("SWARMSY local user storage contract", () => {
  describe("getLocalUserDataRoot", () => {
    it("resolves Windows AppData path", () => {
      const root = getLocalUserDataRoot({
        platform: "win32",
        env: { APPDATA: "C:\\Users\\alice\\AppData\\Roaming" },
        homeDir: "C:\\Users\\alice",
      });

      expect(root).toBe(
        path.win32.join("C:\\Users\\alice\\AppData\\Roaming", "SWARMSY")
      );
    });

    it("resolves macOS Application Support path", () => {
      const root = getLocalUserDataRoot({
        platform: "darwin",
        homeDir: "/Users/alice",
      });

      expect(root).toBe(
        path.posix.join(
          "/Users/alice",
          "Library",
          "Application Support",
          "SWARMSY"
        )
      );
    });

    it("resolves Linux XDG path", () => {
      const root = getLocalUserDataRoot({
        platform: "linux",
        env: { XDG_CONFIG_HOME: "/home/alice/.xdg" },
        homeDir: "/home/alice",
      });

      expect(root).toBe(path.posix.join("/home/alice/.xdg", "swarmsy"));
    });

    it("uses safe fallback for unknown platforms", () => {
      const root = getLocalUserDataRoot({
        platform: "freebsd",
        homeDir: "/home/alice",
      });

      expect(root).toBe(path.posix.join("/home/alice", ".config", "swarmsy"));
    });

    it("falls back to os.homedir for blank or non-string homeDir overrides", () => {
      const homedirSpy = jest.spyOn(os, "homedir").mockReturnValue("/home/fallback");
      try {
        const expectedRoot = path.posix.join("/home/fallback", ".config", "swarmsy");

        const blankRoot = getLocalUserDataRoot({
          platform: "linux",
          env: {},
          homeDir: "",
        });
        const whitespaceRoot = getLocalUserDataRoot({
          platform: "linux",
          env: {},
          homeDir: "   ",
        });
        const nullRoot = getLocalUserDataRoot({
          platform: "linux",
          env: {},
          homeDir: null,
        });

        expect(blankRoot).toBe(expectedRoot);
        expect(whitespaceRoot).toBe(expectedRoot);
        expect(nullRoot).toBe(expectedRoot);

        const cwdRoot = path.posix.join(
          path.posix.resolve(process.cwd()),
          ".config",
          "swarmsy"
        );
        expect(blankRoot).not.toBe(cwdRoot);
        expect(whitespaceRoot).not.toBe(cwdRoot);
        expect(nullRoot).not.toBe(cwdRoot);
      } finally {
        homedirSpy.mockRestore();
      }
    });

    it("falls back to process.platform when platform is blank", () => {
      const root = getLocalUserDataRoot({ platform: "", homeDir: "/home/alice" });
      expect(typeof root).toBe("string");
      expect(root.length).toBeGreaterThan(0);
    });

    it("falls back to process.platform when platform is whitespace", () => {
      const root = getLocalUserDataRoot({ platform: "   ", homeDir: "/home/alice" });
      expect(typeof root).toBe("string");
      expect(root.length).toBeGreaterThan(0);
    });

    it("falls back to process.platform when platform is null", () => {
      const root = getLocalUserDataRoot({ platform: null, homeDir: "/home/alice" });
      expect(typeof root).toBe("string");
      expect(root.length).toBeGreaterThan(0);
    });

    it("falls back to process.platform when platform is undefined", () => {
      const root = getLocalUserDataRoot({ homeDir: "/home/alice" });
      expect(typeof root).toBe("string");
      expect(root.length).toBeGreaterThan(0);
    });

    it("trims platform string before branching", () => {
      const rootLinux = getLocalUserDataRoot({
        platform: "linux",
        homeDir: "/home/alice",
      });
      const rootLinuxPadded = getLocalUserDataRoot({
        platform: "  linux  ",
        homeDir: "/home/alice",
      });
      expect(rootLinux).toBe(rootLinuxPadded);
    });
  });

  describe("getLocalUserStorageLayout", () => {
    it("includes all required SWARMSY local folders", () => {
      const layout = getLocalUserStorageLayout({
        platform: "linux",
        homeDir: "/home/alice",
      });

      expect(Object.keys(layout.paths).sort()).toEqual([...REQUIRED_PATH_KEYS].sort());

      for (const [key, segment] of Object.entries(STORAGE_LAYOUT_SEGMENTS)) {
        expect(layout.paths[key]).toBe(path.posix.join(layout.root, segment));
      }
    });

    it("reports a consistent platform when blank platform is passed", () => {
      const layout = getLocalUserStorageLayout({ platform: "", homeDir: "/home/alice" });
      expect(layout.platform).toBe(process.platform);
    });

    it("reports a consistent platform when null platform is passed", () => {
      const layout = getLocalUserStorageLayout({ platform: null, homeDir: "/home/alice" });
      expect(layout.platform).toBe(process.platform);
    });

    it("uses the same platform for root and paths when platform is sanitized", () => {
      const layout = getLocalUserStorageLayout({
        platform: "linux",
        homeDir: "/home/alice",
      });
      expect(layout.platform).toBe("linux");
      for (const childPath of Object.values(layout.paths)) {
        expect(childPath.startsWith(layout.root)).toBe(true);
      }
    });
  });

  describe("validateLocalUserStoragePath", () => {
    const layout = getLocalUserStorageLayout({
      platform: "linux",
      homeDir: "/home/alice",
      env: { XDG_CONFIG_HOME: "/home/alice/.config" },
    });
    const winLayout = getLocalUserStorageLayout({
      platform: "win32",
      homeDir: "C:\\Users\\alice",
      env: { APPDATA: "C:\\Users\\alice\\AppData\\Roaming" },
    });
    const darwinLayout = getLocalUserStorageLayout({
      platform: "darwin",
      homeDir: "/Users/alice",
    });

    it("accepts valid paths under local root", () => {
      const result = validateLocalUserStoragePath(layout.paths.profile, { layout });
      expect(result.valid).toBe(true);
    });

    it("keeps linux path validation on posix semantics for backslash-looking paths", () => {
      const result = validateLocalUserStoragePath(
        "C:\\Users\\alice\\AppData\\Roaming\\SWARMSY\\profile",
        { layout }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("inside the SWARMSY Local User data root");
    });

    it("keeps darwin path validation on posix semantics for backslash-looking paths", () => {
      const result = validateLocalUserStoragePath(
        "C:\\Users\\alice\\AppData\\Roaming\\SWARMSY\\profile",
        { layout: darwinLayout }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("inside the SWARMSY Local User data root");
    });

    it("keeps win32 path validation on win32 semantics", () => {
      const result = validateLocalUserStoragePath(winLayout.paths.profile, {
        layout: winLayout,
      });
      expect(result.valid).toBe(true);
    });

    it("accepts child directory names that start with two dots", () => {
      const result = validateLocalUserStoragePath(
        path.posix.join(layout.root, "..foo"),
        { layout }
      );
      expect(result.valid).toBe(true);
    });

    it("rejects using the local data root as a storage path by default", () => {
      const result = validateLocalUserStoragePath(layout.root, { layout });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("inside the SWARMSY Local User data root");
    });

    it("can explicitly allow the local data root when opted in", () => {
      const result = validateLocalUserStoragePath(layout.root, {
        layout,
        allowRoot: true,
      });
      expect(result.valid).toBe(true);
    });

    it("rejects traversal outside root", () => {
      const outside = path.posix.resolve(
        layout.root,
        "..",
        "..",
        "server",
        "storage"
      );
      const result = validateLocalUserStoragePath(outside, { layout });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("inside the SWARMSY Local User data root");
    });

    it("rejects hosted/server db paths", () => {
      const result = validateLocalUserStoragePath(
        "/var/lib/anythingllm/server/storage/anythingllm.db",
        { layout }
      );

      expect(result.valid).toBe(false);
    });

    it("rejects whitespace-only storage paths before any cwd-based fallback", () => {
      const result = validateLocalUserStoragePath("   ", { layout });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Storage path must be a non-empty string.");
    });

    it("rejects empty layout roots before any cwd-based fallback", () => {
      const result = validateLocalUserStoragePath("/some/path", {
        layout: { root: "", platform: "linux" },
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Storage layout root must be a non-empty string.");
    });

    it("rejects undefined layout roots before any cwd-based fallback", () => {
      const result = validateLocalUserStoragePath("/some/path", {
        layout: { platform: "linux" },
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Storage layout root must be a non-empty string.");
    });

    it("rejects null layout roots before any cwd-based fallback", () => {
      const result = validateLocalUserStoragePath("/some/path", {
        layout: { root: null, platform: "linux" },
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Storage layout root must be a non-empty string.");
    });

    it("rejects whitespace-only layout roots before any cwd-based fallback", () => {
      const result = validateLocalUserStoragePath("/some/path", {
        layout: { root: "   ", platform: "linux" },
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Storage layout root must be a non-empty string.");
    });

    it("sanitizes whitespace-only layout platform before picking path semantics", () => {
      const result = validateLocalUserStoragePath(
        path.posix.join(layout.root, "profile"),
        {
          layout: {
            ...layout,
            platform: "   ",
          },
        }
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("manifest contract", () => {
    const layout = getLocalUserStorageLayout({
      platform: "linux",
      homeDir: "/home/alice",
      env: { XDG_CONFIG_HOME: "/home/alice/.config" },
    });

    it("creates a valid v1 manifest shape", () => {
      const manifest = createLocalUserStorageManifest({
        layout,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });

      expect(manifest).toMatchObject({
        schema: LOCAL_USER_STORAGE_SCHEMA,
        version: LOCAL_USER_STORAGE_VERSION,
        app: "SWARMSY",
        mode: "local_user",
      });
      expect(Object.keys(manifest.paths).sort()).toEqual([...REQUIRED_PATH_KEYS].sort());

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("does not throw when layout is null, uses default layout", () => {
      expect(() => createLocalUserStorageManifest({ layout: null })).not.toThrow();
      const manifest = createLocalUserStorageManifest({ layout: null });
      expect(manifest.schema).toBe(LOCAL_USER_STORAGE_SCHEMA);
      expect(Object.keys(manifest.paths).sort()).toEqual([...REQUIRED_PATH_KEYS].sort());
    });

    it("does not throw when layout is an array, uses default layout", () => {
      expect(() => createLocalUserStorageManifest({ layout: [] })).not.toThrow();
      const manifest = createLocalUserStorageManifest({ layout: [] });
      expect(manifest.schema).toBe(LOCAL_USER_STORAGE_SCHEMA);
      expect(Object.keys(manifest.paths).sort()).toEqual([...REQUIRED_PATH_KEYS].sort());
    });

    it("does not throw when layout is an empty object, uses default layout", () => {
      expect(() => createLocalUserStorageManifest({ layout: {} })).not.toThrow();
      const manifest = createLocalUserStorageManifest({ layout: {} });
      expect(manifest.schema).toBe(LOCAL_USER_STORAGE_SCHEMA);
      expect(Object.keys(manifest.paths).sort()).toEqual([...REQUIRED_PATH_KEYS].sort());
    });

    it("creates a valid manifest when an invalid layout falls back to the default layout", () => {
      const manifest = createLocalUserStorageManifest({ layout: {} });
      const validation = validateLocalUserStorageManifest(manifest);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("does not throw when layout.root is empty, uses default layout", () => {
      expect(() =>
        createLocalUserStorageManifest({ layout: { root: "" } })
      ).not.toThrow();
      const manifest = createLocalUserStorageManifest({ layout: { root: "" } });
      expect(manifest.schema).toBe(LOCAL_USER_STORAGE_SCHEMA);
      expect(Object.keys(manifest.paths).sort()).toEqual([...REQUIRED_PATH_KEYS].sort());
    });

    it("does not throw when layout.root is whitespace-only, uses default layout", () => {
      expect(() =>
        createLocalUserStorageManifest({ layout: { root: "   " } })
      ).not.toThrow();
      const manifest = createLocalUserStorageManifest({ layout: { root: "   " } });
      expect(manifest.schema).toBe(LOCAL_USER_STORAGE_SCHEMA);
      expect(Object.keys(manifest.paths).sort()).toEqual([...REQUIRED_PATH_KEYS].sort());
    });

    it("rejects wrong schema", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      manifest.schema = "wrong_schema";

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((error) => error.includes("Invalid schema"))).toBe(true);
    });

    it("rejects wrong version", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      manifest.version = LOCAL_USER_STORAGE_VERSION + 1;

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((error) => error.includes("Unsupported manifest version"))).toBe(true);
    });

    it("rejects loose non-ISO timestamp strings", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      manifest.createdAt = "01/01/2026";
      manifest.updatedAt = "2026-01-01 00:00:00";

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("createdAt must be a valid ISO date string.");
      expect(validation.errors).toContain("updatedAt must be a valid ISO date string.");
    });

    it("rejects missing required paths", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      delete manifest.paths.runtime;

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((error) => error.includes("Missing required paths.runtime"))).toBe(true);
    });

    it("rejects unsafe path traversal out of root", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      manifest.paths.uploads = "/tmp/../etc";

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((error) => error.includes("Invalid paths.uploads"))).toBe(true);
    });

    it("rejects hosted/server path values", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      manifest.paths.hives = "/var/lib/anythingllm/server/storage";

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((error) => error.includes("Invalid paths.hives"))).toBe(true);
    });

    it("rejects required manifest paths set to the local data root", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      manifest.paths.profile = layout.root;

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((error) => error.includes("Invalid paths.profile"))).toBe(true);
    });

    it("rejects auth/session/api key fields", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      manifest.authToken = "secret";
      manifest.sessionId = "abc";
      manifest.paths.apiKey = "/home/alice/.config/swarmsy/settings/api-key";

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((error) => error.includes("authToken"))).toBe(true);
      expect(validation.errors.some((error) => error.includes("sessionId"))).toBe(true);
      expect(validation.errors.some((error) => error.includes("apiKey"))).toBe(true);
    });

    it("rejects unknown top-level field not related to secrets", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      manifest.metadata = { extra: true };

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(
        validation.errors.some((error) =>
          error.includes('Unknown manifest field "metadata"')
        )
      ).toBe(true);
    });

    it("rejects unknown paths key not related to secrets", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      manifest.paths.extraDir = layout.root + "/extra";

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(
        validation.errors.some((error) =>
          error.includes('Unknown paths key "extraDir"')
        )
      ).toBe(true);
    });

    it("rejects unknown paths key pointing outside root", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      manifest.paths.extraDir = "/var/lib/anythingllm/server/storage";

      const validation = validateLocalUserStorageManifest(manifest, { layout });
      expect(validation.valid).toBe(false);
      expect(
        validation.errors.some((error) =>
          error.includes('Unknown paths key "extraDir"')
        )
      ).toBe(true);
    });

    it("rejects manifest validation when storage layout root is invalid", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      const validation = validateLocalUserStorageManifest(manifest, {
        layout: { root: "", platform: "linux" },
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "Storage layout root must be a non-empty string."
      );
    });

    it("rejects manifest validation when storage layout root is whitespace-only", () => {
      const manifest = createLocalUserStorageManifest({ layout });
      const validation = validateLocalUserStorageManifest(manifest, {
        layout: { root: "   ", platform: "linux" },
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "Storage layout root must be a non-empty string."
      );
    });
  });
});
