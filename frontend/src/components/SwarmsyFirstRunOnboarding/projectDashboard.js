import { buildIdentityIdeaSparkyMessage } from "./identityIdea";
import { buildMemoryLockStarterMessage } from "./memoryLock";
import { buildProofReviewReopenMessage, normalizeProofReviews } from "./proofReviewHistory";

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function newestById(items = []) {
  return safeList(items)
    .filter((item) => item && Number.isInteger(Number(item.id)))
    .sort((left, right) => Number(right.id) - Number(left.id));
}

export function buildProjectDashboardSnapshot({
  session = null,
  ideas = [],
  locks = [],
  reviews = [],
} = {}) {
  const safeIdeas = newestById(ideas);
  const safeLocks = newestById(locks);
  const safeReviews = normalizeProofReviews(reviews);
  const activeLock = safeLocks.find((lock) => lock?.isActive) || safeLocks[0] || null;
  const activeReview =
    safeReviews.find((review) => review?.isActive) || safeReviews[0] || null;
  const currentIdea =
    safeIdeas.find((idea) => idea?.status === "proposed") ||
    safeIdeas.find((idea) => idea?.status === "kept") ||
    safeIdeas.find((idea) => idea?.status === "saved") ||
    safeIdeas[0] ||
    null;

  return {
    session: session?.id ? session : null,
    ideas: safeIdeas,
    locks: safeLocks,
    reviews: safeReviews,
    currentIdea,
    activeLock,
    activeReview,
    counts: {
      ideas: safeIdeas.length,
      locks: safeLocks.length,
      reviews: safeReviews.length,
    },
  };
}

export function getProjectDashboardNextAction(snapshot = {}) {
  if (snapshot?.session?.id) {
    return {
      kind: "intake",
      label: "Continue your questions",
      description: "SPARKY saved your intake progress.",
      value: snapshot.session,
    };
  }

  if (snapshot?.currentIdea?.status === "proposed") {
    return {
      kind: "review-idea",
      label: "Review your new idea",
      description: "Keep it, delete it, or ask SPARKY for another direction.",
      value: snapshot.currentIdea,
    };
  }

  if (snapshot?.currentIdea?.id) {
    return {
      kind: "continue-idea",
      label: "Continue your identity",
      description: "Keep shaping the same saved project with SPARKY.",
      value: snapshot.currentIdea,
      message: buildIdentityIdeaSparkyMessage(snapshot.currentIdea),
    };
  }

  if (snapshot?.activeReview?.id) {
    return {
      kind: "continue-proof",
      label: "Continue your proof review",
      description: "Re-check claims, missing evidence and the next proof action.",
      value: snapshot.activeReview,
      message: buildProofReviewReopenMessage(snapshot.activeReview),
    };
  }

  if (snapshot?.activeLock?.id) {
    return {
      kind: "continue-lock",
      label: "Continue from saved progress",
      description: "Restart from the current approved project truth.",
      value: snapshot.activeLock,
      message: buildMemoryLockStarterMessage(snapshot.activeLock.content, {
        lock: snapshot.activeLock,
      }),
    };
  }

  return {
    kind: "start",
    label: "Choose what to build",
    description: "Start a new identity or bring in an existing project.",
    value: null,
  };
}

export function projectDashboardStatusCards(snapshot = {}) {
  return [
    {
      id: "identity",
      label: "Identity",
      value: snapshot?.currentIdea?.title || "Not created yet",
      detail: snapshot?.currentIdea?.status
        ? `Status: ${snapshot.currentIdea.status}`
        : "Start with SPARKY to create one.",
    },
    {
      id: "intake",
      label: "Questions",
      value: snapshot?.session?.id ? "In progress" : "No active intake",
      detail: snapshot?.session?.mode
        ? `Mode: ${snapshot.session.mode}`
        : "Your next intake will be saved automatically.",
    },
    {
      id: "memory",
      label: "Memory Locks",
      value: String(snapshot?.counts?.locks || 0),
      detail: snapshot?.activeLock ? "Active project truth available." : "No active lock yet.",
    },
    {
      id: "proof",
      label: "Proof Reviews",
      value: String(snapshot?.counts?.reviews || 0),
      detail: snapshot?.activeReview ? "Active evidence review available." : "No saved review yet.",
    },
  ];
}
