const NO_API_KEY_CONNECTED_MESSAGE =
  "No API key is connected yet. Add one in settings or continue with local AI.";
const API_PROVIDER_NOT_WIRED_MESSAGE =
  "Use API was requested, but online provider execution is not wired for chat yet. Continue with local AI or connect a supported provider after API chat routing is enabled.";

const ONLINE_PROVIDER_KEY_ENV_VARS = [
  "OPEN_AI_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GROQ_API_KEY",
  "OPEN_ROUTER_API_KEY",
  "OPENROUTER_API_KEY",
  "MISTRAL_API_KEY",
  "PERPLEXITY_API_KEY",
  "TOGETHER_AI_API_KEY",
  "COHERE_API_KEY",
  "FIREWORKS_AI_API_KEY",
  "NOVITA_API_KEY",
];

function normalizeUseApiIntent(useApi) {
  return useApi === true;
}

function hasConnectedOnlineProviderConfig(env = process.env) {
  return ONLINE_PROVIDER_KEY_ENV_VARS.some((key) => {
    const value = env?.[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function buildUseApiGuardResponse({ hasProviderConfig = false } = {}) {
  if (!hasProviderConfig) {
    return {
      success: false,
      mode: "api_requested",
      status: "needs_user_action",
      message: NO_API_KEY_CONNECTED_MESSAGE,
    };
  }

  return {
    success: false,
    mode: "api_requested",
    status: "not_wired",
    message: API_PROVIDER_NOT_WIRED_MESSAGE,
  };
}

function useApiSsePayload({ uuid, hasProviderConfig = false } = {}) {
  const guard = buildUseApiGuardResponse({ hasProviderConfig });
  return {
    id: uuid,
    uuid,
    type: "statusResponse",
    textResponse: guard.message,
    sources: [],
    close: true,
    error: null,
    success: guard.success,
    mode: guard.mode,
    status: guard.status,
  };
}

module.exports = {
  NO_API_KEY_CONNECTED_MESSAGE,
  API_PROVIDER_NOT_WIRED_MESSAGE,
  ONLINE_PROVIDER_KEY_ENV_VARS,
  normalizeUseApiIntent,
  hasConnectedOnlineProviderConfig,
  buildUseApiGuardResponse,
  useApiSsePayload,
};
