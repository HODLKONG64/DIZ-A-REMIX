# SWARMSY MVP Known Gaps

Audit date: 2026-07-12
Branch: master after merged PRs #84 through #87

---

## Overview

This document lists known gaps in the current SWARMSY MVP layer.

All gaps listed here are things that do not exist in the current codebase or are intentionally limited to a minimal first slice. No feature is invented or speculated beyond what the code, merged PR trail, and existing spec docs describe.

Gaps that are already documented in spec docs have a cross-reference. Gaps that are not yet spec'd are noted as planned or not started.

---

## Gap 1 — No Proof Tracker database or viewer

**What exists today:** The Proof Tracker handoff allows users to paste proof notes and send them to SPARKY for review. SPARKY's proof-review response is stored in normal workspace chat history.

**What does not exist:** A dedicated Proof Tracker database table, a proof-gap history viewer, a proof-claim ledger, or any way to retrieve prior proof-review sessions without scrolling chat history.

| Property | Detail |
|---|---|
| Impact | Proof review is one-shot per session; no cross-session proof tracking |
| Priority | High — Memory Lock continuity is now durable, making proof persistence the next direct returning-user gap |
| Recommended future PR | Implement Proof Tracker storage and viewer surface (referenced in `SWARMSY_PROOF_TRACKER_HANDOFF.md`) |
| Blocks MVP? | No — handoff path works |

---

## Gap 2 — Memory Lock advanced controls are not built

**What exists today:** Memory Lock continuity now has a dedicated storage layer, authenticated list/retrieve/import API, frontend API helpers, and a minimal saved-lock viewer/import surface in the SWARMSY HIVE Action Hub. Stored locks are scoped by both user and workspace, and saved-lock chat handoff preserves the Local User/Ollama runtime contract.

**What does not exist:** Advanced lock management controls such as archive, delete, export/download, upload/import from file, compare versions, mark an older lock as active, or explicitly delegate lock visibility to another user.

| Property | Detail |
|---|---|
| Impact | Returning users can save, list, select, and continue from stored locks, but cannot yet manage the full lifecycle of older locks |
| Priority | Medium — the core continuity gap is solved; lifecycle controls are a follow-up |
| Recommended future PR | Add advanced Memory Lock controls after Proof Tracker persistence is scoped |
| Blocks MVP? | No — storage, retrieval, import, viewer, and handoff paths work |

---

## Gap 3 — No dashboard

**What exists today:** The SWARMSY onboarding surface renders on home and shows a HIVE snapshot card and an Action Hub.

**What does not exist:** A dedicated SWARMSY dashboard showing project state, last session summary, active memory lock, proof status, campaign history, or quick-action shortcuts for returning users. The dashboard spec exists in `docs/swarmsy/app-mode/SWARMSY_DASHBOARD_INFORMATION_ARCHITECTURE.md`.

| Property | Detail |
|---|---|
| Impact | Returning users see the full onboarding surface every time, not a project status view |
| Priority | Medium — usable without it; reduces friction for returning users |
| Recommended future PR | Implement SWARMSY dashboard surface after core continuity primitives exist |
| Blocks MVP? | No |

---

## Gap 4 — No campaign storage or calendar persistence

**What exists today:** The Campaign Calendar date picker seeds a campaign-day SPARKY starter and navigates to HIVE chat. Campaign output is stored in normal workspace chat history.

**What does not exist:** A campaign storage layer, a persistent calendar view showing which dates have existing campaign output, or any ability to retrieve a previous campaign-day pack without scrolling chat history.

| Property | Detail |
|---|---|
| Impact | Each campaign day is a fresh handoff; no cross-session campaign tracking |
| Priority | Medium — campaign handoff works for Day 1 planning; persistence is a Phase 2 improvement |
| Recommended future PR | Add campaign output storage and a calendar view showing completed campaign days |
| Blocks MVP? | No |

---

## Gap 5 — No local AI setup helper

**What exists today:** Doctrine ingestion requires the AnythingLLM collector to be online. If the collector is offline, the UI shows a `COLLECTOR_OFFLINE` error and the user must fix their setup manually.

**What does not exist:** A guided local AI / collector setup helper, a model provider troubleshooting surface, or an in-app setup wizard for getting the AI stack running. The SPARKY Operator Playbooks doc includes `SPARKY_MODEL_PROVIDER_TROUBLESHOOTING.md`, but it is a doc for SPARKY to follow in chat — not a UI helper.

| Property | Detail |
|---|---|
| Impact | First-run users whose collector is offline are blocked and have no in-app recovery path |
| Priority | Medium — affects first-run success rate |
| Recommended future PR | Add a collector status indicator and setup prompt on the onboarding surface |
| Blocks MVP? | Partially — `COLLECTOR_OFFLINE` is surfaced correctly, but no recovery UI exists |

---

## Gap 6 — No automated 76-question intake beyond chat handoff

**What exists today:** The Start Intake handoff sends SPARKY a mode-specific starter message referencing `01_SWARMSY_USER_INTAKE_76_QUESTIONS.md`. SPARKY then drives the intake through normal chat dialogue.

**What does not exist:** A structured step-by-step intake form, an intake progress tracker, an automatic intake state saver, or any way to resume a partially completed intake without restarting from the last memory lock.

| Property | Detail |
|---|---|
| Impact | 76-question intake is fully manual; SPARKY must hold state across the session |
| Priority | Low-medium — the current flow is functional; automation is a Phase 2 improvement |
| Recommended future PR | Add an intake form UI or intake session tracker after intake flow is validated through manual use |
| Blocks MVP? | No |

---

## Gap 7 — No optional advanced doctrine ingestion UI

**What exists today:** The required doctrine docs are ingested via `POST /api/swarmsy/onboarding/ingest-required-docs`. Optional doctrine groups (`spark-library` and `sparky-operator`) are registered in the manifest with `required: false` and do not block first-run readiness.

**What does not exist:** A user-facing UI or route to optionally load the Spark Library or SPARKY Operator Playbooks after completing core setup.

The current required-docs ingestion route only ingests required doctrine groups. Optional groups are visible in the manifest/status layer but are not ingested by the current required-docs ingestion route.

A future PR should add an optional advanced-doctrine ingestion/selection flow if users need Spark Library or SPARKY Operator docs loaded automatically.

| Property | Detail |
|---|---|
| Impact | Power users cannot self-serve optional doctrine expansion today |
| Priority | Low — optional docs are not needed for MVP; blocking readiness check ignores them |
| Recommended future PR | Add optional advanced doctrine ingestion/selection flow |
| Blocks MVP? | No |

---

## Gap 8 — No old SWARMSY salvage or migration path

**What exists today:** The Existing Project intake mode seeds a SPARKY starter that asks the user to describe their existing project notes, links, proof, assets, and lore before rebuilding.

**What does not exist:** An automated migration or import tool for legacy SWARMSY sessions, old workspace snapshots, or prior project exports. There is no import wizard, file upload pipeline, or batch ingestion path for pre-existing project state.

| Property | Detail |
|---|---|
| Impact | Users with prior SWARMSY-style work must manually transcribe their project state |
| Priority | Low — affects power users and legacy users only |
| Recommended future PR | Add a structured project import flow after core continuity primitives are validated |
| Blocks MVP? | No |

---

## Gap 9 — No Space Agent integration

**What exists today:** The SWARMSY HIVE workspace uses the SPARKY system prompt, which is a single-agent workspace setup. The living icon engine, operating layer, and disruption engine docs are ingested into the HIVE workspace.

**What does not exist:** Space Agent integration. SPARKY does not have access to external tool calls, web search, file writing, or multi-agent orchestration in the current MVP. The `SWARMSY_FUTURE_RUNTIME_INTEGRATION_PLAN.md` and `SWARMSY_TOOL_CONTRACTS.md` spec these possibilities but they are not implemented.

| Property | Detail |
|---|---|
| Impact | SPARKY operates as a chat agent only; no agentic loops, no tool use, no external integrations |
| Priority | Low for MVP; high for Phase 2 power features |
| Recommended future PR | Add Space Agent / tool use after core workflow is validated |
| Blocks MVP? | No |

---

## Gap 10 — Admin SWARMSY routes have no unit tests

**What exists today:** Three admin routes exist for SWARMSY:
- `POST /api/admin/swarmsy/workspace-preset/hive`
- `GET /api/admin/swarmsy/required-docs/status`
- `POST /api/admin/swarmsy/workspace-preset/hive/ingest-required-docs`

**What does not exist:** Unit or integration tests for these admin routes. The user-safe routes and utilities have test coverage; the admin routes do not.

| Property | Detail |
|---|---|
| Impact | Regression risk if Workspace or admin middleware changes |
| Priority | Medium |
| Recommended future PR | Add admin route test coverage |
| Blocks MVP? | No — admin routes are not used in the user-facing flow |

---

## Summary Table

| Gap | Blocks MVP? | Priority |
|---|---|---|
| No Proof Tracker database/viewer | No | High |
| Memory Lock advanced controls are not built | No | Medium |
| No dashboard | No | Medium |
| No campaign storage/calendar persistence | No | Medium |
| No local AI setup helper / collector recovery UI | Partially | Medium |
| No automated 76-question intake beyond chat handoff | No | Low-medium |
| No optional advanced doctrine ingestion UI | No | Low |
| No old SWARMSY salvage/migration path | No | Low |
| No Space Agent integration | No | Low |
| Admin SWARMSY routes have no unit tests | No | Medium |
