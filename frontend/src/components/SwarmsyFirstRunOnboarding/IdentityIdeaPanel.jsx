import { useCallback, useEffect, useState } from "react";
import { SpinnerGap } from "@phosphor-icons/react";
import SwarmsyOnboarding from "@/models/swarmsyOnboarding";
import {
  buildIdentityIdeaSparkyMessage,
  getIdentityIdeaActions,
} from "./identityIdea";

const STATUS_LABELS = {
  proposed: "New idea from SPARKY",
  kept: "Kept for discussion",
  saved: "Saved to this workspace",
};

export default function IdentityIdeaPanel({
  workspaceSlug,
  onOpenChat,
  confirmDelete = (message) => window.confirm(message),
}) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [busyAction, setBusyAction] = useState(null);
  const [error, setError] = useState("");

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

  useEffect(() => {
    void loadIdeas();
  }, [loadIdeas]);

  async function recordDecision(idea, decision) {
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
    const message = buildIdentityIdeaSparkyMessage(idea, { tryAnother });
    if (!message || typeof onOpenChat !== "function") {
      setError("SPARKY could not open this idea. Try again.");
      return;
    }
    onOpenChat(message);
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
          {ideas.map((idea) => (
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
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300 light:text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
