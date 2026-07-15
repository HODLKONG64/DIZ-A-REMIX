# SWARMSY MVP Known Gaps

Audit date: 2026-07-16
Branch basis: `master` after merged PRs through #132 plus the project-backup foundation in this branch

## Purpose

This document lists genuine remaining gaps in the current SWARMSY product.

It must not describe already-shipped foundations as missing. When this document conflicts with the top-level `README.md`, current runtime code, migrations or tests, those newer authorities win and this audit must be corrected.

## Current shipped foundations

The following are implemented and must not be listed as unbuilt:

- beginner-first SPARKY home and one-click setup/recovery;
- Face, Hidden Identity and Existing Project entry routes;
- batch-first 76-question intake;
- durable user-and-workspace-scoped intake sessions;
- automatic answer-batch saving and resume;
- WTF / SAFE creative-intensity selection;
- MESSAGE, DOODAD and PLACEMENT proposal contract;
- structured Identity Idea capture;
- Keep, Delete and Try Another decisions;
- explicit save recognition during SPARKY brainstorming;
- returning-user continuation for unfinished intake and active ideas;
- core returning-user project dashboard with a recommended next action;
- durable Memory Lock core storage, API access and minimal viewer/import;
- durable Proof Review core storage and authenticated API access;
- Proof Review version history, active-state display, reopen-in-SPARKY and Markdown export;
- versioned read-only project export and dry-run backup validation for active intake, Identity Ideas, Memory Locks and Proof Reviews;
- local Ollama detection, model selection and routing;
- explicit configured-provider routing;
- desktop wrapper, artifact, installer, integrity and installed-runtime smoke workflows.

## Gap 1 — Full project backup, restore and migration

**What exists:**

- allowlisted browser and desktop settings backup/import;
- versioned read-only SWARMSY project export;
- strict portable record allowlists;
- authenticated workspace-scoped export;
- dry-run validation that reports record counts and never applies restore writes.

**What remains:**

- actual restore writes;
- conflict handling and user confirmation;
- migration between export versions;
- completed intake history;
- chats and thread history;
- documents and workspace attachments;
- campaign records;
- generated prompts and assets;
- project metadata and user-grown packs;
- uninstall/reinstall recovery acceptance.

| Property | Detail |
|---|---|
| Impact | Local ownership remains incomplete until users can reliably restore or move a complete project. |
| Priority | High |
| Blocks finished beta? | Yes |

## Gap 2 — Windows release acceptance, signing and updates

**What exists:** Electron wrapper, packaged runtime, dependency archive/extraction, NSIS installer, integrity workflow, release workflow and installed-launch smoke.

**What remains:**

- repeatable acceptance on multiple clean Windows machines;
- first install, restart, upgrade, uninstall and reinstall coverage;
- user-data survival acceptance;
- stable downloadable beta release;
- code-signed executable and installer;
- secure automatic updates;
- release channels, rollback and support policy;
- user-facing download page.

| Property | Detail |
|---|---|
| Impact | The application is still an unsigned beta and release confidence depends heavily on CI. |
| Priority | High |
| Blocks finished beta? | Clean-machine acceptance: Yes. Signing/updates: production readiness. |

## Gap 3 — Proof Review history and claim ledger

**What exists:** Durable records, authenticated API access, visible version history, active-state display, reopen-in-SPARKY and Markdown export.

**What remains:**

- structured claim/evidence rows;
- statuses such as evidence needed, partially supported, verified, outdated and rejected;
- side-by-side comparison between reviews;
- archive/delete controls;
- JSON or complete claim-ledger export;
- deliberate restore of an older review version.

| Property | Detail |
|---|---|
| Impact | Users can revisit review history but cannot yet manage a structured evidence ledger. |
| Priority | High |
| Blocks finished beta? | Core history no longer blocks; structured claim management remains strongly recommended. |

## Gap 4 — Advanced Memory Lock lifecycle controls

**What exists:** Durable storage, list/retrieve/import APIs, frontend helpers and saved-lock continuation.

**What remains:**

- archive and delete;
- export/download and import from file;
- compare versions;
- restore older version;
- mark active;
- change notes;
- optional deliberate sharing/delegation if later approved.

| Property | Detail |
|---|---|
| Impact | Core continuity works, but long-lived projects cannot fully manage their decision history. |
| Priority | Medium |
| Blocks finished beta? | No, but strongly recommended |

## Gap 5 — Persistent campaign storage and calendar history

**What exists:** Campaign-day selection and SPARKY handoff.

**What remains:**

- campaign records and persistent calendar;
- goals, audience and channel plan;
- approved copy and assets;
- publication status and proof requirements;
- outcome review;
- reopen or duplicate campaign in SPARKY;
- exportable campaign pack.

| Property | Detail |
|---|---|
| Impact | Campaign work remains buried in ordinary chat history. |
| Priority | Medium |
| Blocks finished beta? | No |

## Gap 6 — Generated asset library

**What exists:** Identity image prompts and local ComfyUI generation MVP.

**What remains:** A local project-linked asset surface containing preview, original prompt, provider/model metadata where available, linked Identity Idea and workspace, creation date, tags, favourite/archive/delete, use-as-reference handoff, export and backup integration.

| Property | Detail |
|---|---|
| Impact | Generated visual work is difficult to organise and reuse over time. |
| Priority | Medium |
| Blocks finished beta? | No |

## Gap 7 — Full returning-user project dashboard enrichment

**What exists:** A joined-up dashboard for active intake, current Identity Idea, Memory Locks, Proof Reviews and one recommended next action.

**What remains:**

- last chat/session summary;
- campaign state once campaign persistence exists;
- generated assets once an asset library exists;
- broader risk and missing-proof summaries;
- backup readiness and recovery status.

| Property | Detail |
|---|---|
| Impact | The core project view works, but future persisted systems are not yet represented. |
| Priority | Medium |
| Blocks finished beta? | No for the current core data set |

## Gap 8 — Local AI health centre and recovery

**What exists:** One-click SPARKY setup, readiness checks and plain recovery language.

**What remains:** A consolidated health centre for runtime, collector, Ollama, selected model, ComfyUI, database, filesystem permissions, disk space, local ports, configured API providers and Wiki ingestion state. It should provide one safe repair action and a copyable support report with private values removed.

| Property | Detail |
|---|---|
| Impact | Some local dependency failures still require support outside the guided product. |
| Priority | Medium |
| Blocks finished beta? | Partially |

## Gap 9 — Admin and security regression coverage

**What exists:** User-safe route and journey tests plus desktop safety coverage.

**What remains:** Dedicated tests for admin HIVE preset creation, required-doc status and ingestion, unauthorised admin access, cross-user/workspace access attempts, malicious packs and file names, oversized uploads, forged workspace IDs, provider-value leakage, Memory Lock overwrite attempts, Proof Review cross-user access and project-backup allowlist enforcement.

| Property | Detail |
|---|---|
| Impact | Security-sensitive boundaries have uneven direct regression coverage. |
| Priority | Medium-high |
| Blocks finished beta? | Recommended before broad distribution |

## Gap 10 — Legal, privacy and support product layer

**What remains for broad hosted or production use:**

- Privacy Notice and Terms of Use;
- local versus API data-flow explanation;
- uploaded-document handling;
- retention and deletion rules;
- copyright/takedown process;
- acceptable use;
- user-created pack responsibility;
- support and release policy;
- safeguarding boundaries if minors can use hosted services.

| Property | Detail |
|---|---|
| Impact | Technical capability can outpace the public trust and governance layer. |
| Priority | High for production/hosted use |
| Blocks finished beta? | Local closed beta: No. Broad public/hosted release: Yes. |

## Future power features — not core beta blockers

The following are valuable later expansions and must not be represented as current runtime:

- optional advanced doctrine-selection UI;
- legacy project import wizard;
- Space Agent integration;
- live web research tools;
- email drafting and approved sending;
- calendar and scheduled workflows;
- file-writing tools;
- multi-agent orchestration;
- optional encrypted cloud sync;
- collaborative shared workspaces.

## Priority order

1. Full project backup/restore and migration.
2. Repeatable Windows release acceptance.
3. Structured Proof Review claim ledger and comparison.
4. Advanced Memory Lock lifecycle controls.
5. Persistent campaign storage and calendar history.
6. Local AI health centre and recovery.
7. Generated asset library.
8. Returning-user dashboard enrichment.
9. Admin and security regression coverage.
10. Legal, privacy and support product layer.
11. Signing and automatic updates for production readiness.
12. Future external tools and multi-agent systems.

## Summary table

| Gap | Priority | Blocks finished beta? |
|---|---|---|
| Full project backup/restore | High | Yes |
| Windows clean-machine acceptance | High | Yes |
| Proof Review claim ledger | High | Core history shipped; structured ledger recommended |
| Memory Lock lifecycle | Medium | No |
| Campaign persistence | Medium | No |
| Local health centre | Medium | Partially |
| Generated asset library | Medium | No |
| Dashboard enrichment | Medium | No |
| Security/admin coverage | Medium-high | Recommended |
| Legal/privacy/support | High for public release | Broad release only |
| Signing and auto-update | High for production | Production readiness |
| External tools / Space Agent | Future | No |
