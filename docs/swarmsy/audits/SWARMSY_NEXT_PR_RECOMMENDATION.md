# SWARMSY Next PR Recommendation

Audit date: 2026-05-31
Based on: `SWARMSY_BUILD_READINESS_AUDIT.md`, `SWARMSY_DOCTRINE_COVERAGE_AUDIT.md`, `SWARMSY_RUNTIME_WIRING_AUDIT.md`

---

## Decision Tree

### Step 1 — Are doctrine and manifest consistent?

**Check:** Do all required doctrine groups have 100% file coverage, and do all manifest paths point to real files?

**Result:** ✅ Yes.

- 5 required groups, 44 required files, 0 missing.
- 2 optional groups, 17 optional files, 0 missing.
- 61 manifest paths, 61 verified present.
- No broken manifest references.
- No duplicate groups.

→ Proceed to Step 2.

---

### Step 2 — Are required docs ingested or ingestible?

**Check:** Is the ingestion route implemented, stable, and documented?

**Result:** ✅ Yes.

- `POST /api/admin/swarmsy/workspace-preset/hive/ingest-required-docs` is implemented.
- Route handles: collector-offline (503), already-attached dedup, per-file partial failures.
- Route is documented in `docs/swarmsy/runtime/SWARMSY_REQUIRED_DOCS_INGESTION_ROUTE.md`.
- Required docs status route (`GET /api/admin/swarmsy/required-docs/status`) is also implemented and working.

→ Proceed to Step 3.

---

### Step 3 — Are SWARMSY routes documented?

**Check:** Do the runtime routes have matching docs?

**Result:** ✅ Yes, with one caveat.

- `SWARMSY_HIVE_ADMIN_ROUTE.md` — accurate.
- `SWARMSY_REQUIRED_DOCS_INGESTION_ROUTE.md` — accurate.
- `SWARMSY_DEFAULT_WORKSPACE_PRESET_WIRING.md` — accurate.
- `SWARMSY_REQUIRED_DOCS_STATUS_HELPER.md` — **partially outdated**: still says "status-only, future PR for ingestion" when ingestion route has already landed. Needs correction but does not block the next PR.

→ Proceed to Step 4.

---

### Step 4 — Does the manifest miss any required files?

**Result:** ✅ No. Zero missing files.

→ Proceed to recommendation.

---

## Recommendation

### Next runtime PR

**Add SWARMSY first-run onboarding entrypoint**

---

## Purpose

A user currently has no guided path to enter SWARMSY mode. The runtime pieces exist (workspace creation route, required docs status route, ingestion route) but there is no user-facing entrypoint that:

- Detects first-run state.
- Offers Face Identity / Hidden Identity / Existing Project / Load Memory Lock choices.
- Can create or select the SWARMSY HIVE workspace.
- Can call the required docs status check.
- Can trigger the required docs ingestion route if docs are not yet attached.
- Prevents the user from landing in a generic AnythingLLM blank chat.

Without this entrypoint, SWARMSY exists only at the admin API level. The system never activates for users.

---

## Entrypoint Spec (summary)

The first-run onboarding entrypoint should:

1. Detect whether a SWARMSY HIVE workspace exists for the current user.
2. If not, offer to create one by calling `POST /api/admin/swarmsy/workspace-preset/hive`.
3. Check required docs status via `GET /api/admin/swarmsy/required-docs/status`.
4. If required docs are not fully ingested, offer to trigger `POST /api/admin/swarmsy/workspace-preset/hive/ingest-required-docs`.
5. Present the four starting choices: Face Identity / Hidden Identity / Existing Project / Load Memory Lock.
6. Route the user to the SWARMSY HIVE workspace, not a generic AnythingLLM workspace.
7. Not auto-run on every boot. Should be triggered by an explicit user or admin action.

The full onboarding spec is at:
`docs/swarmsy/app-mode/SWARMSY_FIRST_RUN_ONBOARDING_SPEC.md`

---

## Secondary Actions (can follow but do not block)

These are not blockers for the next PR. They should be tracked for a future cleanup PR:

| Item | Action |
|---|---|
| `SWARMSY_REQUIRED_DOCS_STATUS_HELPER.md` says no ingestion route | Update doc to acknowledge ingestion route has landed |
| No tests for `applyWorkspacePreset.js` | Add unit tests (separate PR or alongside first-run PR) |
| No tests for admin SWARMSY routes | Add integration/unit tests (separate PR or alongside first-run PR) |

---

## What This PR Must Not Do

- Do not add new doctrine folders.
- Do not add new feature systems.
- Do not add runtime code beyond the first-run entrypoint.
- Do not add Spark Library expansions.
- Do not add Space Agent.
- Do not add old SWARMSY salvage.
- Do not change package or build files.
- Do not add dependencies.
- Do not break generic AnythingLLM behavior for non-SWARMSY users.
