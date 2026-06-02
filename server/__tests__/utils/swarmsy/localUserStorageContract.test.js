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
        path.join("/Users/alice", "Library", "Application Support", "SWARMSY")
      );
    });

    it("resolves Linux XDG path", () => {
      const root = getLocalUserDataRoot({
        platform: "linux",
        env: { XDG_CONFIG_HOME: "/home/alice/.xdg" },
        homeDir: "/home/alice",
      });

      expect(root).toBe(path.join("/home/alice/.xdg", "swarmsy"));
    });

    it("uses safe fallback for unknown platforms", () => {
      const root = getLocalUserDataRoot({
        platform: "freebsd",
        homeDir: "/home/alice",
      });

      expect(root).toBe(path.join("/home/alice", ".config", "swarmsy"));
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
        expect(layout.paths[key]).toBe(path.join(layout.root, segment));
      }
    });
  });

  describe("validateLocalUserStoragePath", () => {
    const layout = getLocalUserStorageLayout({
      platform: "linux",
      homeDir: "/home/alice",
      env: { XDG_CONFIG_HOME: "/home/alice/.config" },
    });

    it("accepts valid paths under local root", () => {
      const result = validateLocalUserStoragePath(layout.paths.profile, { layout });
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
      const outside = path.resolve(layout.root, "..", "..", "server", "storage");
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
  });
});
