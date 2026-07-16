import { useCallback, useEffect, useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  Desktop,
  Warning,
  X,
} from "@phosphor-icons/react";
import useLoginMode from "@/hooks/useLoginMode";
import SwarmsyOnboarding from "@/models/swarmsyOnboarding";
import showToast from "@/utils/toast";
import {
  hasDesktopLocalSettingsBridge,
  mirrorDesktopLocalUserFirstRunCompleted,
  mirrorDesktopLocalUserOllamaModelSelection,
  persistDesktopFirstRunCompleted,
  persistLocalUserOllamaModelSelection,
  readDesktopFirstRunCompleted,
  readDesktopLocalUserFirstRunCompleted,
  readLocalUserOllamaModelSelection,
} from "@/components/SwarmsyFirstRunOnboarding/localUserOllamaSelection";
import { LOCAL_USER_SETTINGS_SYNC_EVENT } from "@/components/SwarmsyLocalUserSettingsHub/useLocalUserSettingsHub";

export const DESKTOP_FIRST_RUN_RELAUNCH_EVENT =
  "anythingllm_swarmsy_desktop_first_run_relaunch";

function trustedDesktopBridge() {
  if (typeof window === "undefined") return null;
  if (!hasDesktopLocalSettingsBridge({ targetWindow: window })) return null;
  return window.swarmsyDesktop?.foundation || null;
}

function normalizeModels(response = null) {
  if (!Array.isArray(response?.models)) return [];
  return response.models
    .map((model, index) => {
      const name = String(model?.name || model?.id || "").trim();
      if (!name) return null;
      return {
        id: String(model?.id || name || `model-${index}`).trim(),
        name,
      };
    })
    .filter(Boolean);
}

export default function SwarmsyDesktopWelcome() {
  const loginMode = useLoginMode();
  const isHostedAdminMode = loginMode === "multi";
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(
    readLocalUserOllamaModelSelection()
  );

  const checkDesktop = useCallback(async () => {
    const bridge = trustedDesktopBridge();
    if (!bridge || isHostedAdminMode) return;

    setChecking(true);
    try {
      const runtime =
        typeof bridge.getRuntimeStatus === "function"
          ? await bridge.getRuntimeStatus()
          : null;
      setRuntimeReady(runtime?.ok === true && runtime?.responding !== false);

      const ollama = await SwarmsyOnboarding.localUserOllamaStatus().catch(
        () => null
      );
      const installed = normalizeModels(ollama);
      setModels(installed);
      if (
        selectedModel &&
        !installed.some((model) => model.id === selectedModel)
      ) {
        setSelectedModel("");
      }
    } finally {
      setChecking(false);
    }
  }, [isHostedAdminMode, selectedModel]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    async function boot() {
      if (loginMode === null || isHostedAdminMode || !trustedDesktopBridge()) {
        return;
      }
      const desktopCompletion = await readDesktopLocalUserFirstRunCompleted({
        targetWindow: window,
      });
      const completed = desktopCompletion.ok
        ? desktopCompletion.completed
        : readDesktopFirstRunCompleted();
      if (!completed) {
        setVisible(true);
        void checkDesktop();
      }
    }

    void boot();
  }, [checkDesktop, isHostedAdminMode, loginMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function relaunch() {
      if (isHostedAdminMode || !trustedDesktopBridge()) return;
      setVisible(true);
      void checkDesktop();
    }
    window.addEventListener(DESKTOP_FIRST_RUN_RELAUNCH_EVENT, relaunch);
    return () =>
      window.removeEventListener(DESKTOP_FIRST_RUN_RELAUNCH_EVENT, relaunch);
  }, [checkDesktop, isHostedAdminMode]);

  async function chooseModel(modelId) {
    const normalized = String(modelId || "").trim();
    setSelectedModel(normalized);
    persistLocalUserOllamaModelSelection(normalized);
    await mirrorDesktopLocalUserOllamaModelSelection(normalized, {
      targetWindow: window,
    }).catch(() => null);
    window.dispatchEvent(
      new CustomEvent(LOCAL_USER_SETTINGS_SYNC_EVENT, {
        detail: { reason: "desktop_welcome_model", model: normalized },
      })
    );
  }

  async function continueToAnythingLlm() {
    persistDesktopFirstRunCompleted(true);
    await mirrorDesktopLocalUserFirstRunCompleted(true, {
      targetWindow: window,
    }).catch(() => null);
    setVisible(false);
    showToast("SWARMSY is ready. AnythingLLM remains fully available.", "success");
  }

  if (!visible || isHostedAdminMode) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
      <section className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-theme-sidebar-border bg-theme-bg-primary p-6 text-theme-text-primary shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-text-secondary">
              SWARMSY welcome
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold">
              <Desktop size={26} /> Start with a spark
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close SWARMSY welcome"
            onClick={() => setVisible(false)}
            className="rounded-lg border border-theme-sidebar-border p-2 hover:bg-theme-bg-secondary"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-theme-text-secondary">
          SWARMSY adds prompts, packs and a guided starting point. It does not
          replace or restrict AnythingLLM. Your normal workspaces, chats,
          documents, agents, tools and configured AI providers remain available.
        </p>

        <div className="mt-5 rounded-xl border border-theme-sidebar-border bg-theme-bg-secondary p-4">
          <div className="flex items-start gap-3">
            {runtimeReady ? (
              <CheckCircle className="mt-0.5 text-emerald-300" size={22} />
            ) : (
              <Warning className="mt-0.5 text-amber-300" size={22} />
            )}
            <div>
              <p className="font-semibold">Desktop runtime</p>
              <p className="mt-1 text-sm text-theme-text-secondary">
                {runtimeReady === true
                  ? "The local desktop runtime is responding."
                  : runtimeReady === false
                    ? "The runtime could not be confirmed. You can still enter AnythingLLM and check it again later."
                    : "Checking the desktop runtime..."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-theme-sidebar-border bg-theme-bg-secondary p-4">
          <label
            htmlFor="swarmsy-optional-local-model"
            className="text-sm font-semibold"
          >
            Optional local AI model
          </label>
          <p className="mt-1 text-sm text-theme-text-secondary">
            Ollama is optional. Leave this blank to use any provider already
            configured in AnythingLLM.
          </p>
          <select
            id="swarmsy-optional-local-model"
            value={selectedModel}
            onChange={(event) => chooseModel(event.target.value)}
            className="mt-3 w-full rounded-lg border border-theme-sidebar-border bg-theme-bg-primary px-3 py-2 text-sm outline-none focus:border-teal"
          >
            <option value="">Use AnythingLLM provider settings</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={checkDesktop}
            disabled={checking}
            className="flex items-center gap-2 rounded-lg border border-theme-sidebar-border px-4 py-2 text-sm font-medium hover:bg-theme-bg-secondary disabled:opacity-60"
          >
            <ArrowClockwise
              className={checking ? "animate-spin" : ""}
              size={18}
            />
            Check again
          </button>
          <button
            type="button"
            onClick={continueToAnythingLlm}
            className="rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-white"
          >
            Continue to AnythingLLM
          </button>
        </div>
      </section>
    </div>
  );
}
