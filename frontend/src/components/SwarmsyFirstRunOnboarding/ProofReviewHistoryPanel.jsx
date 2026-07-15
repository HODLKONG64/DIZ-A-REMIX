import { useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  ArrowRight,
  DownloadSimple,
  SpinnerGap,
} from "@phosphor-icons/react";
import showToast from "@/utils/toast";
import {
  buildProofReviewMarkdown,
  buildProofReviewReopenMessage,
  listProofReviews,
  normalizeProofReviews,
  PROOF_REVIEW_HISTORY_EMPTY,
  PROOF_REVIEW_HISTORY_LOAD_ERROR,
  proofReviewDate,
  proofReviewLabel,
} from "./proofReviewHistory";

function downloadMarkdown(review) {
  const markdown = buildProofReviewMarkdown(review);
  if (!markdown) return false;

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `swarmsy-proof-review-v${
    Number(review?.version || 0) || 1
  }.md`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

export default function ProofReviewHistoryPanel({
  workspaceSlug,
  busy = false,
  onContinueWithSparky,
}) {
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  async function loadHistory() {
    if (!workspaceSlug) {
      setLoading(false);
      setReviews([]);
      setSelectedId(null);
      return;
    }

    setLoading(true);
    setError("");
    const result = await listProofReviews(workspaceSlug);
    const nextReviews = normalizeProofReviews(result?.reviews);
    setReviews(nextReviews);
    setSelectedId((current) => {
      if (nextReviews.some((review) => review.id === current)) return current;
      return nextReviews[0]?.id ?? null;
    });
    if (!result?.success) {
      setError(result?.message || PROOF_REVIEW_HISTORY_LOAD_ERROR);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    if (!workspaceSlug) {
      setLoading(false);
      setReviews([]);
      setSelectedId(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError("");
    listProofReviews(workspaceSlug)
      .then((result) => {
        if (cancelled) return;
        const nextReviews = normalizeProofReviews(result?.reviews);
        setReviews(nextReviews);
        setSelectedId(nextReviews[0]?.id ?? null);
        if (!result?.success) {
          setError(result?.message || PROOF_REVIEW_HISTORY_LOAD_ERROR);
        }
      })
      .catch(() => {
        if (!cancelled) setError(PROOF_REVIEW_HISTORY_LOAD_ERROR);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const selectedReview = useMemo(
    () =>
      reviews.find((review) => review.id === selectedId) || reviews[0] || null,
    [reviews, selectedId]
  );

  function continueWithSparky() {
    const message = buildProofReviewReopenMessage(selectedReview);
    if (!message) {
      showToast("This Proof Review has no content to continue.", "warning");
      return;
    }
    onContinueWithSparky?.(message, selectedReview);
  }

  function exportReview() {
    if (!downloadMarkdown(selectedReview)) {
      showToast("This Proof Review could not be exported.", "warning");
      return;
    }
    showToast("Proof Review exported as Markdown.", "success");
  }

  if (!workspaceSlug) return null;

  return (
    <section
      aria-labelledby="swarmsy-proof-history-title"
      className="rounded-2xl border border-theme-sidebar-border bg-theme-bg-secondary p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-theme-text-secondary">
            Saved proof
          </p>
          <h2
            id="swarmsy-proof-history-title"
            className="mt-2 text-xl font-semibold text-theme-text-primary"
          >
            Proof Review history
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-theme-text-secondary">
            Reopen earlier evidence checks, review saved versions, or export the
            selected review.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || busy}
          onClick={loadHistory}
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
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 light:text-red-800">
          {error}
        </p>
      )}

      {!loading && reviews.length === 0 ? (
        <p className="mt-4 text-sm text-theme-text-secondary">
          {PROOF_REVIEW_HISTORY_EMPTY}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr,1.2fr]">
          <div className="space-y-2">
            {reviews.map((review) => (
              <button
                key={review.id}
                type="button"
                onClick={() => setSelectedId(review.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedReview?.id === review.id
                    ? "border-teal/50 bg-teal/10"
                    : "border-theme-sidebar-border hover:bg-theme-bg-menu"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-theme-text-primary">
                    {proofReviewLabel(review)}
                  </span>
                  {review.isActive && (
                    <span className="rounded-full bg-teal/20 px-2 py-0.5 text-xs font-semibold text-teal">
                      Active
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-theme-text-secondary">
                  {proofReviewDate(review)} · {review.source}
                </p>
              </button>
            ))}
          </div>

          {selectedReview && (
            <div className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-theme-text-primary">
                    {proofReviewLabel(selectedReview)}
                  </h3>
                  <p className="mt-1 text-xs text-theme-text-secondary">
                    {selectedReview.isActive
                      ? "Active review"
                      : "Earlier version"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={exportReview}
                    className="flex items-center gap-2 rounded-lg border border-theme-sidebar-border px-3 py-2 text-sm font-medium text-theme-text-primary disabled:opacity-60"
                  >
                    <DownloadSimple size={17} />
                    Export
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={continueWithSparky}
                    className="flex items-center gap-2 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
                  >
                    <ArrowRight size={17} />
                    Continue with SPARKY
                  </button>
                </div>
              </div>
              <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-950/40 p-4 text-sm leading-6 text-theme-text-secondary light:bg-zinc-100">
                {selectedReview.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
