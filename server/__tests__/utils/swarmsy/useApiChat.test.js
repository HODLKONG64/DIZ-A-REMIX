const {
  NO_API_KEY_CONNECTED_MESSAGE,
  API_PROVIDER_NOT_WIRED_MESSAGE,
  normalizeUseApiIntent,
  hasConnectedOnlineProviderConfig,
  buildUseApiGuardResponse,
  useApiSsePayload,
} = require("../../../utils/swarmsy/useApiChat");

describe("SWARMSY Use API chat guard", () => {
  it("defaults missing and false useApi intent to local/default flow", () => {
    expect(normalizeUseApiIntent(undefined)).toBe(false);
    expect(normalizeUseApiIntent(null)).toBe(false);
    expect(normalizeUseApiIntent(false)).toBe(false);
    expect(normalizeUseApiIntent("true")).toBe(false);
  });

  it("accepts only explicit boolean true as API intent", () => {
    expect(normalizeUseApiIntent(true)).toBe(true);
  });

  it("returns Needs user action when no provider key is connected", () => {
    expect(hasConnectedOnlineProviderConfig({})).toBe(false);
    expect(buildUseApiGuardResponse({ hasProviderConfig: false })).toEqual({
      success: false,
      mode: "api_requested",
      status: "needs_user_action",
      message: NO_API_KEY_CONNECTED_MESSAGE,
    });
  });

  it("returns not-wired status without exposing key values when a key exists", () => {
    const secret = "sk-test-secret-do-not-return";
    expect(hasConnectedOnlineProviderConfig({ OPEN_AI_KEY: secret })).toBe(
      true
    );
    const result = buildUseApiGuardResponse({ hasProviderConfig: true });
    expect(result.status).toBe("not_wired");
    expect(result.message).toBe(API_PROVIDER_NOT_WIRED_MESSAGE);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("builds a user-facing SSE payload without API key values", () => {
    const secret = "sk-test-secret-do-not-return";
    const payload = useApiSsePayload({
      uuid: "message-1",
      hasProviderConfig: hasConnectedOnlineProviderConfig({
        OPEN_AI_KEY: secret,
      }),
    });

    expect(payload).toEqual(
      expect.objectContaining({
        uuid: "message-1",
        type: "statusResponse",
        success: false,
        mode: "api_requested",
        status: "not_wired",
        close: true,
      })
    );
    expect(JSON.stringify(payload)).not.toContain(secret);
  });
});
