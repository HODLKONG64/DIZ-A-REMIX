# SWARMSY Next PR Recommendation

Audit date: 2026-07-12
Based on: `SWARMSY_MVP_KNOWN_GAPS.md`, current `server/endpoints/swarmsy.js`, current SWARMSY endpoint tests, and merged PRs #84 through #87.

---

## Current State

The previous recommendation targeted durable Memory Lock continuity. That work has now landed across focused PRs:

| Area | Current status |
|---|---|
| User-safe onboarding status route | Implemented: `GET /api/swarmsy/onboarding/status` |
| User-safe HIVE creation route | Implemented: `POST /api/swarmsy/onboarding/create-hive` |
| User-safe required-docs ingestion route | Implemented: `POST /api/swarmsy/onboarding/ingest-required-docs` |
| Memory Lock storage foundation | Implemented in PR #84 with workspace/user ownership, versioning, active state, and model tests |
| Authenticated Memory Lock API | Implemented in PR #85 for list, retrieve, and import flows scoped to the current user and workspace |
| Frontend Memory Lock API helpers | Implemented in PR #86 with model tests and stored-lock metadata handoff support |
| Saved Memory Lock viewer/import UI | Implemented in PR #87 inside the SWARMSY HIVE Action Hub |
| Local User/Ollama saved-lock handoff guard | Implemented in PR #87 so saved and pasted Memory Lock handoff use the shared runtime payload contract |
| Onboarding route tests | Present in `server/__tests__/endpoints/swarmsy.test.js` |
| Required-docs ingestion utility tests | Present in `server/__tests__/utils/swarmsy/ingestRequiredDocs.test.js` |
| Workspace preset tests | Present in `server/__tests__/utils/swarmsy/applyWorkspacePreset.test.js` |
| Frontend onboarding tests | Present in `server/__tests__/frontend/swarmsyOnboarding.test.js` and `server/__tests__/frontend/actionHub.test.js` |

The old Memory Lock recommendation should no longer be used as the active next-PR plan because its storage, API, frontend helper, and minimal viewer/import surface are represented in the codebase.

---

## Recommended Next PR

`Add SWARMSY Proof Tracker persistence and history viewer`

Proof Tracker persistence is now the highest-priority continuity gap after Memory Locks. The current Proof Review action can generate a chat handoff from pasted proof text, but there is no dedicated proof-review record, retrieval API, or history viewer for returning users.

A focused next PR should add the smallest durable Proof Tracker layer that supports returning-user continuity:

1. Store submitted proof-review content and generated review metadata in a dedicated persistence layer instead of relying only on chat history.
2. Associate every proof record with both the owning user and the owning SWARMSY HIVE workspace, matching the same isolation standard now used by Memory Locks.
3. Add a server model for listing, retrieving, creating/importing, archiving, and marking proof records reviewed or active where appropriate.
4. Add authenticated routes for listing, retrieving, and importing only the current user's proof records for the selected workspace.
5. Add a minimal Action Hub history surface that lets a returning user select or inspect previous proof-review inputs.
6. Preserve the existing pasted Proof Review chat handoff so current behavior keeps working.
7. Add focused tests for ownership checks, same-workspace isolation, empty-content rejection, route protection, import behavior, and retrieval behavior.

---

## Scope Guardrails

Keep the PR limited to Proof Tracker continuity. Do not bundle it with unrelated Phase 2 systems.

Do not include:

- Advanced Memory Lock controls such as compare, upload, export, delete, or mark-active unless directly required by shared helper cleanup.
- Campaign calendar persistence.
- Space Agent integration.
- Optional advanced doctrine ingestion UI.
- Legacy SWARMSY migration tooling.
- Broad dashboard redesign.
- Package, workflow, desktop artifact, or build-system changes unless directly required by Proof Tracker implementation.

---

## Why This Is Next

Memory Locks now give returning users a durable identity/continuity primitive. Proof Tracker persistence is the next direct gap because proof-review work is also user-specific, workspace-specific, and easy to lose if it only exists inside ordinary chat history.

A dedicated proof-review storage and viewer path gives SWARMSY a second concrete continuity primitive before larger dashboard, campaign, or Space Agent features are built.

---

## Secondary Actions

These remain valid follow-up candidates, but they should not be mixed into the Proof Tracker PR:

| Item | Suggested follow-up |
|---|---|
| Advanced Memory Lock controls | Add archive/delete/export/upload/compare/mark-active after Proof Tracker persistence is scoped |
| Campaign persistence | Store campaign-day output and show completed dates |
| SWARMSY dashboard | Surface active project state after core continuity primitives exist |
| Collector setup helper | Add in-app recovery guidance for `COLLECTOR_OFFLINE` first-run failures |
| Admin route tests | Add coverage for admin-only SWARMSY routes separately from user-safe onboarding tests |

---

## Historical Note

Earlier versions of this document recommended first-run onboarding, user-safe route wiring, and Memory Lock continuity. Those recommendations have been superseded by the current codebase. Use this document with `SWARMSY_MVP_KNOWN_GAPS.md` when choosing the next runtime PR.
