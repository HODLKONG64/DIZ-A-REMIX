const {
  COMFYUI_GENERATION_UNAVAILABLE_MESSAGE,
  generateComfyUiImage,
  isLocalComfyUiUrl,
} = require("../../../utils/swarmsy/comfyUiGeneration");

function jsonResponse({ ok = true, status = 200, body = {}, headers = {} } = {}) {
  return {
    ok,
    status,
    headers: { get: (name) => headers[name] || headers[name.toLowerCase()] },
    json: jest.fn().mockResolvedValue(body),
  };
}

describe("ComfyUI local generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects missing prompt before calling ComfyUI", async () => {
    const fetchImpl = jest.fn();

    const result = await generateComfyUiImage({ fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      mode: "local_user",
      engine: "comfyui",
      status: "invalid_request",
      message: "Prompt is required for local ComfyUI image generation.",
    });
  });

  it("returns unavailable when ComfyUI is unreachable", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await generateComfyUiImage({
      prompt: "high contrast stencil street art",
      workflowJson: { "1": { inputs: { text: "{{prompt}}" } } },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:8188", {
      method: "GET",
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual({
      success: false,
      mode: "local_user",
      engine: "comfyui",
      status: "unavailable",
      url: "http://localhost:8188",
      message: COMFYUI_GENERATION_UNAVAILABLE_MESSAGE,
    });
  });

  it("requires object-shaped workflow JSON and does not auto-select or download models", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse());

    const result = await generateComfyUiImage({
      prompt: "poster art",
      workflow: "default",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalledWith(
      expect.stringContaining("/prompt"),
      expect.any(Object)
    );
    expect(result).toMatchObject({
      success: false,
      status: "invalid_request",
      message:
        "ComfyUI generation requires a user-provided workflow JSON object for this MVP.",
    });
  });

  it("handles ComfyUI non-OK generation response clearly", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(jsonResponse({ ok: false, status: 500 }));

    const result = await generateComfyUiImage({
      prompt: "poster art",
      workflowJson: { "1": { inputs: { text: "{{prompt}}" } } },
      fetchImpl,
    });

    expect(result).toMatchObject({
      success: false,
      status: "failed",
      message: "ComfyUI generation request returned HTTP 500.",
    });
  });

  it("returns normalized image metadata after mocked ComfyUI generation succeeds", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(
        jsonResponse({ body: { prompt_id: "abc-123", number: 1 } })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            "abc-123": {
              outputs: {
                "9": {
                  images: [
                    {
                      filename: "swarmsy.png",
                      subfolder: "",
                      type: "output",
                    },
                  ],
                },
              },
            },
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ headers: { "content-type": "image/png" } })
      );

    const result = await generateComfyUiImage({
      prompt: "high contrast stencil street art",
      negativePrompt: "blurry, low quality",
      size: "1024x1024",
      seed: 123456,
      workflow: { "1": { inputs: { text: "{{prompt}}", seed: "{{seed}}" } } },
      fetchImpl,
      pollIntervalMs: 0,
      now: () => new Date("2026-06-05T00:00:00.000Z"),
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, "http://localhost:8188", {
      method: "GET",
      signal: expect.any(AbortSignal),
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8188/prompt",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(fetchImpl.mock.calls[1][1].body).toContain(
      "high contrast stencil street art"
    );
    expect(fetchImpl.mock.calls[1][1].body).toContain("123456");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8188/history/abc-123",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8188/view?filename=swarmsy.png&type=output",
      expect.objectContaining({ method: "GET" })
    );
    expect(result).toEqual({
      success: true,
      mode: "local_user",
      engine: "comfyui",
      status: "completed",
      image: {
        filename: "swarmsy.png",
        subfolder: "",
        type: "output",
        url: "http://localhost:8188/view?filename=swarmsy.png&type=output",
        mimeType: "image/png",
      },
      metadata: {
        prompt: "high contrast stencil street art",
        negativePrompt: "blurry, low quality",
        seed: 123456,
        size: "1024x1024",
        workflow: "user_supplied",
        promptId: "abc-123",
        createdAt: "2026-06-05T00:00:00.000Z",
      },
    });
  });

  it("blocks non-local image engine URLs so online APIs are not called", async () => {
    const fetchImpl = jest.fn();

    const result = await generateComfyUiImage({
      prompt: "poster art",
      workflowJson: { "1": {} },
      url: "https://api.example.com/comfy",
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      status: "blocked",
      message: "ComfyUI generation is local-only. Configure a local ComfyUI URL.",
    });
  });

  it("allows only local/private ComfyUI URLs", () => {
    expect(isLocalComfyUiUrl("http://localhost:8188")).toBe(true);
    expect(isLocalComfyUiUrl("http://192.168.1.10:8188")).toBe(true);
    expect(isLocalComfyUiUrl("https://api.openai.com/v1/images")).toBe(false);
  });
});
