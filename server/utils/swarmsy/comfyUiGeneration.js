const {
  DEFAULT_LOCAL_IMAGE_ENGINE_URL,
  detectLocalImageEngine,
  resolveLocalImageEngineUrl,
} = require("./localImageEngine");

const COMFYUI_GENERATION_UNAVAILABLE_MESSAGE =
  "ComfyUI is not connected. Start your local image engine before image generation.";
const DEFAULT_GENERATION_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;
const DEFAULT_WORKFLOW_NAME = "user_supplied";

function unavailableGenerationResult(url = DEFAULT_LOCAL_IMAGE_ENGINE_URL) {
  return {
    success: false,
    mode: "local_user",
    engine: "comfyui",
    status: "unavailable",
    url,
    message: COMFYUI_GENERATION_UNAVAILABLE_MESSAGE,
  };
}

function parseSize(size = "1024x1024") {
  const [width, height] = String(size || "")
    .toLowerCase()
    .split("x")
    .map((value) => Number.parseInt(value, 10));

  return {
    width: Number.isInteger(width) && width > 0 ? width : 1024,
    height: Number.isInteger(height) && height > 0 ? height : 1024,
  };
}

function isObjectShaped(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function workflowLabel(workflow) {
  if (typeof workflow === "string" && workflow.trim()) return workflow.trim();
  return DEFAULT_WORKFLOW_NAME;
}

function resolveWorkflowPayload({
  workflow,
  workflowJson,
  prompt,
  negativePrompt,
  seed,
  size,
}) {
  const sourceWorkflow = isObjectShaped(workflowJson)
    ? workflowJson
    : isObjectShaped(workflow)
      ? workflow
      : null;

  if (!sourceWorkflow) {
    return {
      error:
        "ComfyUI generation requires a user-provided workflow JSON object for this MVP.",
    };
  }

  const { width, height } = parseSize(size);
  const replacements = {
    "{{prompt}}": prompt,
    "{{negativePrompt}}": negativePrompt || "",
    "{{seed}}": seed ?? "",
    "{{width}}": width,
    "{{height}}": height,
  };

  const workflowText = JSON.stringify(sourceWorkflow);
  const hydratedText = Object.entries(replacements).reduce(
    (text, [token, value]) => text.split(token).join(String(value)),
    workflowText
  );

  return { workflow: JSON.parse(hydratedText) };
}

function isLocalComfyUiUrl(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "[::1]" ||
      host === "host.docker.internal" ||
      host.endsWith(".local") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

function buildUrl(baseUrl, path) {
  return `${baseUrl}${path}`;
}

function buildViewUrl(baseUrl, image = {}) {
  const params = new URLSearchParams();
  params.set("filename", image.filename);
  if (image.subfolder) params.set("subfolder", image.subfolder);
  if (image.type) params.set("type", image.type);
  return `${baseUrl}/view?${params.toString()}`;
}

function getHeader(response, name) {
  if (typeof response?.headers?.get === "function")
    return response.headers.get(name);
  return (
    response?.headers?.[name] || response?.headers?.[name.toLowerCase()] || null
  );
}

function findFirstOutputImage(historyPayload = null, promptId = null) {
  const history =
    promptId && historyPayload?.[promptId]
      ? historyPayload[promptId]
      : historyPayload;
  const outputs = history?.outputs;
  if (!outputs || typeof outputs !== "object") return null;

  for (const output of Object.values(outputs)) {
    const images = Array.isArray(output?.images) ? output.images : [];
    const image = images.find((candidate) => candidate?.filename);
    if (image) return image;
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(
  fetchImpl,
  url,
  options = {},
  timeoutMs = DEFAULT_GENERATION_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
    const data = await response?.json?.().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function submitComfyUiPrompt({
  fetchImpl,
  baseUrl,
  workflow,
  clientId,
  timeoutMs,
}) {
  return await fetchJson(
    fetchImpl,
    buildUrl(baseUrl, "/prompt"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    },
    timeoutMs
  );
}

async function pollComfyUiHistory({
  fetchImpl,
  baseUrl,
  promptId,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
  timeoutMs,
}) {
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const { response, data } = await fetchJson(
      fetchImpl,
      buildUrl(baseUrl, `/history/${encodeURIComponent(promptId)}`),
      { method: "GET" },
      timeoutMs
    );

    if (!response?.ok) {
      return {
        success: false,
        message: `ComfyUI history returned HTTP ${response?.status ?? "unknown"}.`,
      };
    }

    const image = findFirstOutputImage(data, promptId);
    if (image) return { success: true, image, history: data };

    if (attempt + 1 < maxPollAttempts) await sleep(pollIntervalMs);
  }

  return {
    success: false,
    message: "ComfyUI generation did not finish before the polling timeout.",
  };
}

async function retrieveComfyUiImage({ fetchImpl, baseUrl, image, timeoutMs }) {
  const imageUrl = buildViewUrl(baseUrl, image);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(imageUrl, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response?.ok) {
      return {
        success: false,
        message: `ComfyUI image retrieval returned HTTP ${response?.status ?? "unknown"}.`,
      };
    }

    return {
      success: true,
      image: {
        filename: image.filename,
        subfolder: image.subfolder || "",
        type: image.type || "output",
        url: imageUrl,
        mimeType: getHeader(response, "content-type") || "image/png",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateComfyUiImage({
  prompt,
  negativePrompt = "",
  size = "1024x1024",
  seed = null,
  workflow = "default",
  workflowJson = null,
  url,
  fetchImpl = global.fetch,
  timeoutMs = DEFAULT_GENERATION_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
  now = () => new Date(),
  clientId = "swarmsy-local-user",
} = {}) {
  const resolvedUrl = resolveLocalImageEngineUrl(url);
  const safePrompt = String(prompt || "").trim();
  if (!safePrompt) {
    return {
      success: false,
      mode: "local_user",
      engine: "comfyui",
      status: "invalid_request",
      message: "Prompt is required for local ComfyUI image generation.",
    };
  }

  if (typeof fetchImpl !== "function")
    return unavailableGenerationResult(resolvedUrl);

  if (!isLocalComfyUiUrl(resolvedUrl)) {
    return {
      success: false,
      mode: "local_user",
      engine: "comfyui",
      status: "blocked",
      url: resolvedUrl,
      message:
        "ComfyUI generation is local-only. Configure a local ComfyUI URL.",
    };
  }

  const readiness = await detectLocalImageEngine({
    url: resolvedUrl,
    fetchImpl,
    timeoutMs,
  });
  if (!readiness?.available) return unavailableGenerationResult(resolvedUrl);

  const workflowPayload = resolveWorkflowPayload({
    workflow,
    workflowJson,
    prompt: safePrompt,
    negativePrompt,
    seed,
    size,
  });
  if (workflowPayload.error) {
    return {
      success: false,
      mode: "local_user",
      engine: "comfyui",
      status: "invalid_request",
      url: resolvedUrl,
      message: workflowPayload.error,
    };
  }

  try {
    const submitted = await submitComfyUiPrompt({
      fetchImpl,
      baseUrl: resolvedUrl,
      workflow: workflowPayload.workflow,
      clientId,
      timeoutMs,
    });

    if (!submitted.response?.ok) {
      return {
        success: false,
        mode: "local_user",
        engine: "comfyui",
        status: "failed",
        url: resolvedUrl,
        message: `ComfyUI generation request returned HTTP ${submitted.response?.status ?? "unknown"}.`,
      };
    }

    const promptId = submitted.data?.prompt_id;
    if (!promptId) {
      return {
        success: false,
        mode: "local_user",
        engine: "comfyui",
        status: "failed",
        url: resolvedUrl,
        message:
          "ComfyUI did not return a prompt_id for the generation request.",
      };
    }

    const history = await pollComfyUiHistory({
      fetchImpl,
      baseUrl: resolvedUrl,
      promptId,
      pollIntervalMs,
      maxPollAttempts,
      timeoutMs,
    });
    if (!history.success) {
      return {
        success: false,
        mode: "local_user",
        engine: "comfyui",
        status: "failed",
        url: resolvedUrl,
        message: history.message,
      };
    }

    const retrieved = await retrieveComfyUiImage({
      fetchImpl,
      baseUrl: resolvedUrl,
      image: history.image,
      timeoutMs,
    });
    if (!retrieved.success) {
      return {
        success: false,
        mode: "local_user",
        engine: "comfyui",
        status: "failed",
        url: resolvedUrl,
        message: retrieved.message,
      };
    }

    return {
      success: true,
      mode: "local_user",
      engine: "comfyui",
      status: "completed",
      image: retrieved.image,
      metadata: {
        prompt: safePrompt,
        negativePrompt: String(negativePrompt || ""),
        seed,
        size,
        workflow: workflowLabel(workflow),
        promptId,
        createdAt: now().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      mode: "local_user",
      engine: "comfyui",
      status: "failed",
      url: resolvedUrl,
      message: `ComfyUI generation failed: ${String(error?.message || "unknown error")}`,
    };
  }
}

module.exports = {
  COMFYUI_GENERATION_UNAVAILABLE_MESSAGE,
  DEFAULT_GENERATION_TIMEOUT_MS,
  DEFAULT_MAX_POLL_ATTEMPTS,
  DEFAULT_POLL_INTERVAL_MS,
  buildViewUrl,
  generateComfyUiImage,
  isLocalComfyUiUrl,
  resolveWorkflowPayload,
};
