import { useCallback, useEffect, useRef, useState } from "react";
import { SpinnerGap } from "@phosphor-icons/react";
import SwarmsyOnboarding from "@/models/swarmsyOnboarding";
import {
  buildIdentityIdeaImagePrompt,
  buildIdentityIdeaSparkyMessage,
  getIdentityIdeaActions,
  getIdentityIdeaImageMessage,
} from "./identityIdea";

const STATUS_LABELS = {
  proposed: "New idea from SPARKY",
  kept: "Kept for discussion",
  saved: "Saved to this workspace",
};

export default function IdentityIdeaPanel({
  workspaceSlug,
  onOpenChat,
  onConnectImageAI,
  canGenerateImages = false,
  confirmDelete = (message) => window.confirm(message),
}) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [busyAction, setBusyAction] = useState(null);
  const [imageStates, setImageStates] = useState({});
  const [copiedIdeaId, setCopiedIdeaId] = useState(null);
  const [error, setError] = useState("");
  const attemptedIdeaIdsRef = useRef(new Set());

  const loadIdeas = useCallback(async () => {
    if (!workspaceSlug) {
      setIdeas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const result = await SwarmsyOnboarding.identityIdeas(workspaceSlug);
    setLoading(false);

    if (!result?.success) {
      setIdeas([]);
      setError(result?.message || "SPARKY could not load your ideas.");
      return;
    }

    setIdeas(Array.isArray(result.ideas) ? result.ideas : []);
  }, [workspaceSlug]);

  const attemptImage = useCallback(
    async (idea, { retry = false } = {}) => {
      const prompt = buildIdentityIdeaImagePrompt(idea);
      if (!prompt || !canGenerateImages) return;

      const sessionKey = `swarmsy:image-attempt:${workspaceSlug}:${idea.id}`;
      let attemptedThisSession = false;
      try {
        attemptedThisSession = sessionStorage.getItem(sessionKey) === "1";
      } catch {
        attemptedThisSession = false;
      }
      if (
        !retry &&
        (attemptedIdeaIdsRef.current.has(idea.id) || attemptedThisSession)
      )
        return;
      attemptedIdeaIdsRef.current.add(idea.id);
      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {
        // A blocked browser store must never block the image attempt or prompt.
      }
      setImageStates((current) => ({
        ...current,
        [idea.id]: { status: "generating", prompt, result: null },
      }));

      const result = await SwarmsyOnboarding.localUserImageEngineGenerate({
        prompt,
        size: "1024x1024",
      });

      setImageStates((current) => ({
        ...current,
        [idea.id]: {
          status:
            result?.success && result?.image?.url ? "completed" : "prompt",
          prompt: result?.prompt || prompt,
          result,
        },
      }));
    },
    [canGenerateImages, workspaceSlug]
  );

  useEffect(() => {
    void loadIdeas();
  }, [loadIdeas]);

  useEffect(() => {
    if (!canGenerateImages) return;
    ideas
      .filter((idea) => idea.status === "proposed")
      .forEach((idea) => {
        void attemptImage(idea);
      });
  }, [attemptImage, canGenerateImages, ideas]);

  async function copyImagePrompt(ideaId, prompt) {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedIdeaId(ideaId);
      setError("");
    } catch {
      setError(
        "Your browser could not copy the prompt. Select the text and copy it."
      );
    }
  }

  async function recordDecision(idea, decision) {
    if (!workspaceSlug) {
      setError("Open your SWARMSY workspace before updating this idea.");
      return;
    }

    if (decision === "delete") {
      const confirmed = confirmDelete(
        `Delete “${idea.title}”? This removes it from your ideas.`
      );
      if (!confirmed) return;
    }

    setBusyAction({ ideaId: idea.id, actionId: decision });
    setError("");
    const result = await SwarmsyOnboarding.decideIdentityIdea(
      workspaceSlug,
      idea.id,
      decision
    );
    setBusyAction(null);

    if (!result?.success || !result?.idea) {
      setError(result?.message || "SPARKY could not update this idea.");
      return;
    }

    if (decision === "delete") {
      setIdeas((current) => current.filter((item) => item.id !== idea.id));
      return;
    }

    setIdeas((current) =>
      current.map((item) => (item.id === idea.id ? result.idea : item))
    );
  }

  function openChat(idea, tryAnother = false) {
    if (!workspaceSlug) {
      setError("Open your SWARMSY workspace before continuing with SPARKY.");
      return;
    }

    const message = buildIdentityIdeaSparkyMessage(idea, { tryAnother });
    if (!message || typeof onOpenChat !== "function") {
      setError("SPARKY could not open this idea. Try again.");
      return;
    }
    onOpenChat(message);
  }

  function connectImageAI() {
    if (typeof onConnectImageAI === "function") {
      onConnectImageAI();
      return;
    }
    setError(
      "No image maker is connected yet. Your prompt is still ready to copy."
    );
  }

  function handleAction(idea, actionId) {
    if (actionId === "keep" || actionId === "save" || actionId === "delete") {
      void recordDecision(idea, actionId);
      return;
    }
    if (actionId === "try-another") {
      openChat(idea, true);
      return;
    }
    if (actionId === "brainstorm") {
      openChat(idea);
    }
  }

  return (
    <section
      aria-labelledby="swarmsy-identity-ideas-title"
      className="mt-6 rounded-2xl border border-teal/40 bg-teal/5 p-5"
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal">
          Your creative direction
        </p>
        <h3
          id="swarmsy-identity-ideas-title"
          className="text-xl font-semibold text-theme-text-primary"
        >
          Your Identity Ideas
        </h3>
        <p className="max-w-3xl text-sm leading-6 text-theme-text-secondary">
          SPARKY keeps your ideas here. Choose what feels right, ask for another
          direction, or talk an idea through before saving it.
        </p>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-theme-text-secondary">
          <SpinnerGap className="animate-spin" size={18} />
          Loading your ideas...
        </div>
      ) : ideas.length === 0 ? (
        <div className="mt-5 rounded-xl border border-theme-sidebar-border bg-theme-bg-secondary p-4">
          <p className="font-medium text-theme-text-primary">
            No identity ideas yet.
          </p>
          <p className="mt-1 text-sm text-theme-text-secondary">
            Start creating with SPARKY. Your ideas will appear here when they
            are ready for you to choose.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {ideas.map((idea) => {
            const imageState = imageStates[idea.id];
            const prompt =
              imageState?.prompt || buildIdentityIdeaImagePrompt(idea);

            return (
              <article
                key={idea.id}
                className="rounded-2xl border border-theme-sidebar-border bg-theme-bg-secondary p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
                  {STATUS_LABELS[idea.status] || "Your idea"}
                </p>
                <h4 className="mt-2 text-lg font-semibold text-theme-text-primary">
                  {idea.title}
                </h4>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-theme-text-secondary">
                  {idea.content}
                </p>

                {prompt && (
                  <div className="mt-5 rounded-xl border border-teal/30 bg-theme-bg-menu p-4">
                    <p className="font-semibold text-theme-text-primary">
                      SPARKY image mockup
                    </p>

                    {imageState?.status === "generating" ? (
                      <p className="mt-2 flex items-center gap-2 text-sm text-theme-text-secondary">
                        <SpinnerGap className="animate-spin" size={18} />
                        SPARKY is trying to make this image...
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-theme-text-secondary">
                        {getIdentityIdeaImageMessage(imageState?.result)}
                      </p>
                    )}

                    {imageState?.result?.success &&
                      imageState.result?.image?.url && (
                        <img
                          src={imageState.result.image.url}
                          alt={`SPARKY mockup for ${idea.title}`}
                          className="mt-4 max-h-80 w-full rounded-xl object-contain"
                        />
                      )}

                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
                      Exact image prompt
                    </p>
                    <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-theme-sidebar-border bg-theme-bg-secondary p-3 text-xs leading-5 text-theme-text-primary">
                      {prompt}
                    </pre>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyImagePrompt(idea.id, prompt)}
                        className="rounded-lg border border-theme-sidebar-border px-3 py-2 text-sm font-medium text-theme-text-primary transition hover:border-teal hover:bg-teal/10"
                      >
                        {copiedIdeaId === idea.id
                          ? "Prompt copied"
                          : "Copy prompt"}
                      </button>
                      {canGenerateImages && (
                        <button
                          type="button"
                          disabled={imageState?.status === "generating"}
                          onClick={() =>
                            void attemptImage(idea, { retry: true })
                          }
                          className="rounded-lg border border-theme-sidebar-border px-3 py-2 text-sm font-medium text-theme-text-primary transition hover:border-teal hover:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Make another version
                        </button>
                      )}
                      {canGenerateImages &&
                        !imageState?.result?.success &&
                        typeof onConnectImageAI === "function" && (
                          <button
                            type="button"
                            onClick={connectImageAI}
                            className="rounded-lg border border-theme-sidebar-border px-3 py-2 text-sm font-medium text-theme-text-primary transition hover:border-teal hover:bg-teal/10"
                          >
                            Connect image AI
                          </button>
                        )}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-theme-text-secondary">
                      You can always paste this prompt into ChatGPT or another
                      image AI, make more versions, and pick your favourite.
                    </p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {getIdentityIdeaActions(idea).map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => handleAction(idea, action.id)}
                      className="rounded-lg border border-theme-sidebar-border px-3 py-2 text-sm font-medium text-theme-text-primary transition hover:border-teal hover:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction?.ideaId === idea.id &&
                      busyAction?.actionId === action.id
                        ? {
                            keep: "Keeping...",
                            save: "Saving...",
                            delete: "Deleting...",
                          }[action.id]
                        : action.label}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 text-sm text-red-300 light:text-red-700"
        >
          {error}
        </p>
      )}
    </section>
  );
}
