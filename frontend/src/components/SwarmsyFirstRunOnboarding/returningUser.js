export function getReturningUserStep({ session = null, ideas = [] } = {}) {
  if (session?.id && session?.mode) {
    return {
      kind: "intake",
      session,
    };
  }

  const safeIdeas = Array.isArray(ideas) ? ideas : [];
  const idea =
    safeIdeas.find((item) => item?.status === "kept") ||
    safeIdeas.find((item) => item?.status === "saved") ||
    safeIdeas.find((item) => item?.status === "proposed") ||
    null;
  if (!idea?.id) return null;

  return {
    kind: idea.status === "proposed" ? "review" : "idea",
    idea,
  };
}
