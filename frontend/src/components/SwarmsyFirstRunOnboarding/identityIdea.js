export const IDENTITY_IDEA_ACTION_LABELS = {
  keep: "Keep this idea",
  delete: "Delete",
  "try-another": "Try another",
  brainstorm: "Talk it through with SPARKY",
  save: "Save this idea",
};

export function getIdentityIdeaActions(idea = null) {
  if (!idea?.id) return [];

  if (idea.status === "proposed") {
    return [
      { id: "keep", label: IDENTITY_IDEA_ACTION_LABELS.keep },
      { id: "try-another", label: IDENTITY_IDEA_ACTION_LABELS["try-another"] },
      { id: "delete", label: IDENTITY_IDEA_ACTION_LABELS.delete },
    ];
  }

  if (idea.status === "kept") {
    return [
      { id: "brainstorm", label: IDENTITY_IDEA_ACTION_LABELS.brainstorm },
      { id: "save", label: IDENTITY_IDEA_ACTION_LABELS.save },
      { id: "delete", label: IDENTITY_IDEA_ACTION_LABELS.delete },
    ];
  }

  if (idea.status === "saved") {
    return [
      { id: "brainstorm", label: IDENTITY_IDEA_ACTION_LABELS.brainstorm },
      { id: "delete", label: IDENTITY_IDEA_ACTION_LABELS.delete },
    ];
  }

  return [];
}

export const IDENTITY_IMAGE_SUCCESS_MESSAGE =
  "SPARKY created this version. Here is the exact prompt. Use it in another image AI for more versions, then choose your favourite.";
export const IDENTITY_IMAGE_FALLBACK_MESSAGE =
  "SPARKY could not make an image this time, but your exact prompt is ready. Copy it into ChatGPT or any image AI to create versions.";

export function isExplicitIdentityIdeaSaveMessage(message = "") {
  const content = String(message || "")
    .trim()
    .toLowerCase()
    .replace(/[.!]+$/g, "")
    .trim();
  if (!content) return false;

  if (
    /\b(?:don't|do not|dont|not yet|not ready|maybe|later|should|why|how|if)\b/.test(
      content
    )
  ) {
    return false;
  }

  return [
    /^(?:(?:great|perfect|love it|yes|yep|ok|okay|done|that's it|that is it)[,\s-]*)?(?:please\s+)?save\s+(?:this|that|the)\s+idea(?:\s+to\s+(?:(?:my|the|this)\s+)?workspace)?(?:\s*,?\s*please)?$/,
    /^(?:(?:great|perfect|love it|yes|yep|ok|okay|done|that's it|that is it)[,\s-]*)?(?:please\s+)?save\s+it(?:\s+to\s+(?:(?:my|the|this)\s+)?workspace)?(?:\s*,?\s*please)?$/,
    /^(?:(?:great|perfect|love it|yes|yep|ok|okay)[,\s-]*)?(?:please\s+)?lock\s+it\s+in(?:\s*,?\s*please)?$/,
  ].some((pattern) => pattern.test(content));
}

export function buildIdentityIdeaImagePrompt(idea = null) {
  const title = String(idea?.title || "").trim();
  const content = String(idea?.content || "").trim();
  if (!title || !content) return null;

  return `Create one striking, polished concept mockup for a SWARMSY identity called "${title}".

Creative direction:
${content}

Build the visual around three clearly connected parts:
1. MESSAGE: make the central statement or tagline readable and emotionally immediate.
2. DOODAD: include one simple, memorable, repeatable symbol, animal, object, face, or silhouette.
3. PLACEMENT: show the idea in a fictional, legal mockup location that strengthens the message.

Keep it raw, distinctive, stencil-friendly, and easy to recognise at a glance. Follow the requested SAFE or WTF intensity if it appears in the creative direction. This is concept art only: do not depict instructions for trespass, vandalism, property damage, or unsafe activity. Do not add unrelated logos, watermarks, or extra slogans.`;
}

export function getIdentityIdeaImageMessage(result = null) {
  return result?.success && result?.image?.url
    ? IDENTITY_IMAGE_SUCCESS_MESSAGE
    : IDENTITY_IMAGE_FALLBACK_MESSAGE;
}

export function buildIdentityIdeaSparkyMessage(
  idea,
  { tryAnother = false } = {}
) {
  const title = String(idea?.title || "").trim();
  const content = String(idea?.content || "").trim();
  if (!title || !content) return null;

  if (tryAnother) {
    return `SPARKY, create a clearly different identity idea based on what you already learned from me.

Do not overwrite or save the current idea. Keep it available until I explicitly delete it.
Explain the new direction in simple language and let me choose Keep, Delete, or Try Another.

Current idea to move away from:
${title}

${content}`;
  }

  return `SPARKY, help me think through this identity idea.

You remain my SWARMSY guide regardless of which AI provider is helping underneath.
Answer my questions, explain your reasoning simply, and change the working idea when I ask.
Do not mark the idea as finally saved until I explicitly say to save it.

Identity idea:
${title}

${content}`;
}
