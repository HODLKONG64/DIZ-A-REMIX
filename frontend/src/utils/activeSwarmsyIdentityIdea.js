const ACTIVE_SWARMSY_IDENTITY_IDEA = "swarmsy_active_identity_idea";

function normalizedScope({ workspaceSlug = "", threadSlug = null } = {}) {
  return {
    workspaceSlug: String(workspaceSlug || "").trim(),
    threadSlug: threadSlug ? String(threadSlug).trim() : null,
  };
}

function readPayload(storage) {
  try {
    return JSON.parse(storage?.getItem(ACTIVE_SWARMSY_IDENTITY_IDEA) || "null");
  } catch {
    return null;
  }
}

export function getActiveSwarmsyIdentityIdea(scope, storage = sessionStorage) {
  const expected = normalizedScope(scope);
  const payload = readPayload(storage);
  if (
    !expected.workspaceSlug ||
    payload?.workspaceSlug !== expected.workspaceSlug ||
    payload?.threadSlug !== expected.threadSlug ||
    !payload?.idea?.id
  ) {
    return null;
  }
  return payload.idea;
}

export function storeActiveSwarmsyIdentityIdea(
  scope,
  idea,
  storage = sessionStorage
) {
  const target = normalizedScope(scope);
  if (!target.workspaceSlug || !idea?.id) return false;
  storage?.setItem(
    ACTIVE_SWARMSY_IDENTITY_IDEA,
    JSON.stringify({ ...target, idea })
  );
  return true;
}

export function clearActiveSwarmsyIdentityIdea(
  scope,
  storage = sessionStorage
) {
  const target = normalizedScope(scope);
  const payload = readPayload(storage);
  if (
    payload?.workspaceSlug === target.workspaceSlug &&
    payload?.threadSlug === target.threadSlug
  ) {
    storage?.removeItem(ACTIVE_SWARMSY_IDENTITY_IDEA);
  }
}

export { ACTIVE_SWARMSY_IDENTITY_IDEA };
