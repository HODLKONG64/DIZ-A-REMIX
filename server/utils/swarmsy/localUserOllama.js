const DEFAULT_LOCAL_OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";
const DEFAULT_TIMEOUT_MS = 2_500;

function normalizeOllamaModels(models = []) {
  return models
    .filter((model) => typeof model?.name === "string" && model.name.trim())
    .map((model) => ({
      id: model.name,
      name: model.name,
      size: Number.isFinite(model?.size) ? model.size : null,
      digest: model?.digest || null,
      modifiedAt: model?.modified_at || null,
    }));
}

function unreachableResult(endpoint) {
  return {
    success: true,
    mode: "local_user",
    provider: "ollama",
    endpoint,
    reachable: false,
    status: "unreachable",
    models: [],
    message: "Local Ollama is not reachable at the default localhost endpoint.",
  };
}

function errorResult(endpoint, message) {
  return {
    success: true,
    mode: "local_user",
    provider: "ollama",
    endpoint,
    reachable: false,
    status: "error",
    models: [],
    message,
  };
}

function isUnreachableError(error = null) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.name === "AbortError" ||
    message.includes("fetch failed") ||
    message.includes("networkerror") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("ehostunreach") ||
    message.includes("enotfound") ||
    message.includes("timed out")
  );
}

async function fetchWithTimeout(fetchImpl, endpoint, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(endpoint, {
      method: "GET",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function detectLocalOllama({
  endpoint = DEFAULT_LOCAL_OLLAMA_TAGS_URL,
  fetchImpl = global.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== "function") {
    return errorResult(endpoint, "Fetch is unavailable for local Ollama detection.");
  }

  try {
    const response = await fetchWithTimeout(fetchImpl, endpoint, timeoutMs);
    if (!response?.ok) {
      return errorResult(
        endpoint,
        `Local Ollama returned an unexpected status (${response?.status ?? "unknown"}).`
      );
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.models)) {
      return errorResult(
        endpoint,
        "Local Ollama returned an unexpected response payload."
      );
    }

    const models = normalizeOllamaModels(payload.models);
    if (models.length === 0) {
      return {
        success: true,
        mode: "local_user",
        provider: "ollama",
        endpoint,
        reachable: true,
        status: "no_models",
        models: [],
        message: "Local Ollama is reachable, but no models are installed yet.",
      };
    }

    return {
      success: true,
      mode: "local_user",
      provider: "ollama",
      endpoint,
      reachable: true,
      status: "reachable",
      models,
      message: "Local Ollama is reachable and installed models were detected.",
    };
  } catch (error) {
    if (isUnreachableError(error)) return unreachableResult(endpoint);
    return errorResult(
      endpoint,
      error?.message || "Local Ollama detection failed unexpectedly."
    );
  }
}

module.exports = {
  DEFAULT_LOCAL_OLLAMA_TAGS_URL,
  detectLocalOllama,
  normalizeOllamaModels,
};
