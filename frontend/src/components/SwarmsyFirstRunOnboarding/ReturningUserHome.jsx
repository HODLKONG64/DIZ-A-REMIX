import { useEffect, useState } from "react";
import { ArrowRight, SpinnerGap } from "@phosphor-icons/react";
import SwarmsyOnboarding from "@/models/swarmsyOnboarding";
import { buildIdentityIdeaSparkyMessage } from "./identityIdea";
import { getReturningUserStep } from "./returningUser";

export default function ReturningUserHome({
  workspaceSlug,
  busy = false,
  onContinueIntake,
  onContinueIdea,
  onShowChoices,
}) {
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [step, setStep] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceSlug) {
      setLoading(false);
      setStep(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    Promise.all([
      SwarmsyOnboarding.activeIntakeSession(workspaceSlug),
      SwarmsyOnboarding.identityIdeas(workspaceSlug),
    ]).then(([intakeResult, ideasResult]) => {
      if (cancelled) return;
      setStep(
        getReturningUserStep({
          session: intakeResult?.success ? intakeResult.session : null,
          ideas: ideasResult?.success ? ideasResult.ideas : [],
        })
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  if (!workspaceSlug || (!loading && !step)) return null;

  function continueWithSparky() {
    if (step?.kind === "intake") {
      onContinueIntake?.(step.session);
      return;
    }
    if (step?.kind === "review") {
      onShowChoices?.();
      return;
    }
    if (step?.kind === "idea") {
      const message = buildIdentityIdeaSparkyMessage(step.idea);
      if (!message) return;
      onContinueIdea?.(message, {
        identityIdea: {
          id: step.idea.id,
          title: step.idea.title,
        },
      });
    }
  }

  const title =
    step?.kind === "intake"
      ? "Continue your questions"
      : step?.kind === "review"
      ? "Your new idea is ready"
      : `Continue “${step?.idea?.title || "your idea"}”`;
  const description =
    step?.kind === "intake"
      ? "SPARKY saved your answers. Carry on from where you stopped—nothing needs to be entered again."
      : step?.kind === "review"
      ? "SPARKY has an Identity Idea waiting for you. Keep it, delete it, or ask for another direction."
      : step?.idea?.status === "saved"
      ? "This idea is saved to your SWARMSY workspace. Keep shaping it with SPARKY whenever you are ready."
      : "You kept this idea for discussion. Continue the same SPARKY brainstorm without starting over.";
  const buttonLabel =
    step?.kind === "intake"
      ? "Continue your questions"
      : step?.kind === "review"
      ? "Review my idea"
      : "Continue with SPARKY";

  return (
    <section
      aria-labelledby="swarmsy-welcome-back-title"
      className="rounded-2xl border border-teal/40 bg-teal/10 p-5"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-theme-text-secondary">
          <SpinnerGap className="animate-spin" size={18} />
          SPARKY is finding where you left off...
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal">
              Welcome back
            </p>
            <h2
              id="swarmsy-welcome-back-title"
              className="mt-2 text-2xl font-semibold text-theme-text-primary"
            >
              {title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-theme-text-secondary">
              {description}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={continueWithSparky}
              className="flex items-center justify-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-teal/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowRight size={18} />
              {buttonLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onShowChoices}
              className="rounded-lg border border-theme-sidebar-border bg-theme-bg-secondary px-4 py-2 text-sm font-medium text-theme-text-primary transition hover:bg-theme-bg-menu disabled:cursor-not-allowed disabled:opacity-60"
            >
              See all choices
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
