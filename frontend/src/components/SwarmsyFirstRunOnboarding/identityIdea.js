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
