import { useEffect, useMemo, useState } from "react";
import { ArrowClockwise, ArrowRight, SpinnerGap } from "@phosphor-icons/react";
import SwarmsyOnboarding from "@/models/swarmsyOnboarding";
import showToast from "@/utils/toast";
import { listProofReviews } from "./proofReviewHistory";
import {
  buildProjectDashboardSnapshot,
  getProjectDashboardNextAction,
  projectDashboardStatusCards,
} from "./projectDashboard";

const LOAD_ERROR = "SPARKY could not load your full project status.";

export default function ProjectDashboard({
  workspaceSlug,
  busy = false,
  onContinueIntake,
  onContinueIdea,
  onContinueMemoryLock,
  onShowChoices,
}) {
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(() => buildProjectDashboardSnapshot());

  async function loadDashboard() {
    if (!workspaceSlug) return;
    setLoading(true);
    setError("");

    try {
      const [intakeResult, ideasResult, locksResult, reviewsResult] =
        await Promise.all([
          SwarmsyOnboarding.activeIntakeSession(workspaceSlug),
          SwarmsyOnboarding.identityIdeas(workspaceSlug),
          SwarmsyOnboarding.memoryLocks(workspaceSlug),
          listProofReviews(workspaceSlug),
        ]);

      setSnapshot(
        buildProjectDashboardSnapshot({
          session: intakeResult?.success ? intakeResult.session : null,
          ideas: ideasResult?.success ? ideasResult.ideas : [],
          locks: locksResult?.success ? locksResult.locks : [],
          reviews: reviewsResult?.success ? reviewsResult.reviews : [],
        })
      );

      if (
        !intakeResult?.success ||
        !ideasResult?.success ||
        !locksResult?.success ||
        !reviewsResult?.success
      ) {
        setError(LOAD_ERROR);
      }
    } catch {
      setError(LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!workspaceSlug) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    Promise.all([
      SwarmsyOnboarding.activeIntakeSession(workspaceSlug),
      SwarmsyOnboarding.identityIdeas(workspaceSlug),
      SwarmsyOnboarding.memoryLocks(workspaceSlug),
      listProofReviews(workspaceSlug),
    ])
      .then(([intakeResult, ideasResult, locksResult, reviewsResult]) => {
        if (cancelled) return;
        setSnapshot(
          buildProjectDashboardSnapshot({
            session: intakeResult?.success ? intakeResult.session : null,
            ideas: ideasResult?.success ? ideasResult.ideas : [],
            locks: locksResult?.success ? locksResult.locks : [],
            reviews: reviewsResult?.success ? reviewsResult.reviews : [],
          })
        );
        if (
          !intakeResult?.success ||
          !ideasResult?.success ||
          !locksResult?.success ||
          !reviewsResult?.success
        ) {
          setError(LOAD_ERROR);
        }
      })
      .catch(() => {
        if (!cancelled) setError(LOAD_ERROR);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const nextAction = useMemo(
    () => getProjectDashboardNextAction(snapshot),
    [snapshot]
  );
  const cards = useMemo(
    () => projectDashboardStatusCards(snapshot),
    [snapshot]
  );

  function runNextAction() {
    if (nextAction.kind === "intake") {
      onContinueIntake?.(nextAction.value);
      return;
    }
    if (nextAction.kind === "review-idea") {
      onShowChoices?.();
      return;
    }
    if (
      nextAction.kind === "continue-idea" ||
      nextAction.kind === "continue-proof"
    ) {
      if (!nextAction.message) {
        showToast("SPARKY could not prepare this saved work.", "warning");
        return;
      }
      onContinueIdea?.(nextAction.message, {
        identityIdea:
          nextAction.kind === "continue-idea"
            ? {
                id: nextAction.value?.id,
                title: nextAction.value?.title,
              }
            : null,
      });
      return;
    }
    if (nextAction.kind === "continue-lock") {
      onContinueMemoryLock?.(nextAction.value);
      return;
    }
    onShowChoices?.();
  }

  if (!workspaceSlug) return null;

  return (
    <section
      aria-labelledby="swarmsy-project-dashboard-title"
      className="rounded-2xl border border-teal/40 bg-teal/10 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal">
            Welcome back
          </p>
          <h2
            id="swarmsy-project-dashboard-title"
            className="mt-2 text-2xl font-semibold text-theme-text-primary"
          >
            Your project dashboard
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-theme-text-secondary">
            See what is active, what is saved, and the clearest next step.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || busy}
          onClick={loadDashboard}
          className="flex items-center gap-2 rounded-lg border border-theme-sidebar-border px-3 py-2 text-sm font-medium text-theme-text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <SpinnerGap size={17} className="animate-spin" />
          ) : (
            <ArrowClockwise size={17} />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 light:text-amber-800">
          {error} Some saved sections may still be available below.
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className="rounded-xl border border-theme-sidebar-border bg-theme-bg-secondary p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
              {card.label}
            </p>
            <p className="mt-2 break-words text-lg font-semibold text-theme-text-primary">
              {card.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-theme-text-secondary">
              {card.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-xl border border-teal/30 bg-theme-bg-primary p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
            Recommended next step
          </p>
          <h3 className="mt-2 text-lg font-semibold text-theme-text-primary">
            {nextAction.label}
          </h3>
          <p className="mt-1 text-sm text-theme-text-secondary">
            {nextAction.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || busy}
            onClick={runNextAction}
            className="flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowRight size={18} />
            {nextAction.label}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onShowChoices}
            className="rounded-lg border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary disabled:opacity-60"
          >
            See all choices
          </button>
        </div>
      </div>
    </section>
  );
}
