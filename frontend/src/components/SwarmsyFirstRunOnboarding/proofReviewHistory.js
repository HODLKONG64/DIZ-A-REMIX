import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

export const PROOF_REVIEW_HISTORY_EMPTY =
  "No saved Proof Reviews yet. Use Check my proof to create the first one.";
export const PROOF_REVIEW_HISTORY_LOAD_ERROR =
  "SPARKY could not load your Proof Review history.";

async function parseResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (response.ok) return data;
  return {
    success: false,
    ...data,
    message: data?.message || fallbackMessage,
  };
}

export async function listProofReviews(workspaceSlug) {
  const slug = String(workspaceSlug || "").trim();
  if (!slug) {
    return {
      success: false,
      reviews: [],
      message: PROOF_REVIEW_HISTORY_LOAD_ERROR,
    };
  }

  return await fetch(
    `${API_BASE}/swarmsy/workspaces/${encodeURIComponent(slug)}/proof-reviews`,
    { headers: baseHeaders() }
  )
    .then((response) =>
      parseResponse(response, PROOF_REVIEW_HISTORY_LOAD_ERROR)
    )
    .catch(() => ({
      success: false,
      reviews: [],
      message: PROOF_REVIEW_HISTORY_LOAD_ERROR,
    }));
}

export function normalizeProofReviews(reviews = []) {
  return (Array.isArray(reviews) ? reviews : [])
    .filter((review) => review && Number.isInteger(Number(review.id)))
    .map((review) => ({
      ...review,
      id: Number(review.id),
      version: Number(review.version || 0),
      isActive: review.isActive === true,
      source: String(review.source || "pasted"),
      content: String(review.content || "").trim(),
      createdAt: review.createdAt || null,
      updatedAt: review.updatedAt || null,
    }))
    .sort((left, right) => {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
      if (left.version !== right.version) return right.version - left.version;
      return right.id - left.id;
    });
}

export function proofReviewLabel(review = null) {
  if (!review) return "Proof Review";
  const version = Number(review.version || 0);
  return version > 0 ? `Proof Review v${version}` : "Proof Review";
}

export function proofReviewDate(review = null) {
  const raw = review?.updatedAt || review?.createdAt;
  if (!raw) return "Date unavailable";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildProofReviewReopenMessage(review = null) {
  const content = String(review?.content || "").trim();
  if (!content) return "";

  return `Continue from this saved SWARMSY Proof Review.

Saved review: ${proofReviewLabel(review)}
Status: ${review?.isActive ? "Active" : "Earlier version"}
Source: ${String(review?.source || "pasted")}

${content}

Your task:
1. Re-check which claims are safe now.
2. Identify evidence that is still missing.
3. Flag anything outdated or overstated.
4. Give me the smallest next proof action.
5. Preserve the difference between an idea, proposal, completed work and verified result.

Do not invent proof or claim an action happened when it did not.`;
}

export function buildProofReviewMarkdown(review = null) {
  const content = String(review?.content || "").trim();
  if (!content) return "";

  return `# ${proofReviewLabel(review)}

- Status: ${review?.isActive ? "Active" : "Earlier version"}
- Source: ${String(review?.source || "pasted")}
- Saved: ${proofReviewDate(review)}

## Review

${content}
`;
}
