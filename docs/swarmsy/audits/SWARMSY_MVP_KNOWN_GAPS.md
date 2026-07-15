# SWARMSY MVP Known Gaps

Audit date: 2026-07-15
Branch basis: `master` after merged PRs through #129

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
- durable Memory Lock core storage, API access and minimal viewer/import;
- durable Proof Review core storage and authenticated API access;
- local Ollama detection, model selection and routing;
- explicit configured-provider routing;
- desktop wrapper, artifact, installer, integrity and installed-runtime smoke workflows.

## Gap 1 — Proof Review history and claim ledger

**What exists:** Durable user-and-workspace-scoped Proof Review records and authenticated API access.

**What remains:**

- full history surface;
- claim/evidence status view;
- reopen-in-SPARKY flow;
- comparison between reviews;
- archive/delete controls;
- Markdown or JSON export;
- clear statuses such as evidence needed, partially supported, verified, outdated and rejected.

| Property | Detail |
|---|---|
| Impact | Users can store reviews but cannot manage or compare the full proof history easily. |
| Priority | High |
| Blocks finished beta? | Yes |

## Gap 2 — Full returning-user project dashboard

**What exists:** Returning-user continuation card, HIVE snapshot and Action Hub.

**What remains:** A dedicated project-status dashboard showing:

- active identity or project;
- last session summary;
- approved Identity Idea;
- active Memory Lock;
- latest Proof Review;
- unfinished intake;
- campaign state;
- generated assets;
- missing proof and recommended next action.

| Property | Detail |
|---|---|
| Impact | Returning users can continue work but do not yet receive a complete project operating view. |
| Priority | High |
| Blocks finished beta? | Yes |

## Gap 3 — Full project backup, restore and migration

**What exists:** Filesystem-backed settings backup/import with path, schema and secret protections.

**What remains:** One versioned full-project export/import format covering:

- workspace and HIVE state;
- chats;
- Identity Ideas;
- intake sessions;
- Memory Locks;
- Proof Reviews;
- documents;
- campaign records;
- generated prompts and assets;
- project metadata and user-grown packs.

The flow also needs dry-run validation, conflict handling, migration between export versions, secret exclusion and uninstall/reinstall recovery tests.

| Property | Detail |
|---|---|
| Impact | Local ownership is incomplete if the user cannot reliably move or recover the complete project. |
| Priority | High |
| Blocks finished beta? | Yes |

## Gap 4 — Advanced Memory Lock lifecycle controls

**What exists:** Durable storage, list/retrieve/import APIs, frontend helpers and minimal saved-lock continuation.

**What remains:**

- archive;
- delete;
- export/download;
- import from file;
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

- campaign records;
- persistent calendar;
- goals and audience;
- channel plan;
- approved copy and assets;
- publication status;
- proof requirements;
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

**What remains:** A local project-linked asset surface containing:

- preview;
- original prompt;
- provider/model metadata where available;
- linked Identity Idea and workspace;
- creation date;
- tags;
- favourite/archive/delete;
- use-as-reference handoff;
- export and backup integration.

| Property | Detail |
|---|---|
| Impact | Generated visual work is difficult to organise and reuse over time. |
| Priority | Medium |
| Blocks finished beta? | No |

## Gap 7 — Local AI health centre and recovery

**What exists:** One-click SPARKY setup, readiness checks and plain recovery language.

**What remains:** A consolidated health centre for:

- runtime;
- collector;
- Ollama;
- selected model;
- ComfyUI;
- database;
- filesystem permissions;
- disk space;
- local ports;
- configured API providers;
- Wiki ingestion state.

It should provide one safe repair action and a copyable support report with secrets removed.

| Property | Detail |
|---|---|
| Impact | Some local dependency failures still require support outside the guided product. |
| Priority | Medium |
| Blocks finished beta? | Partially |

## Gap 8 — Windows release acceptance, signing and updates

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

## Gap 9 — Admin and security regression coverage

**What exists:** User-safe route and journey tests plus desktop safety coverage.

**What remains:** Dedicated tests for:

- admin HIVE preset creation;
- required-doc status and ingestion;
- unauthorised admin access;
- cross-user/workspace access attempts;
- malicious packs and file names;
- oversized uploads;
- forged workspace IDs;
- provider secret leakage;
- Memory Lock overwrite attempts;
- Proof Review cross-user access;
- backup secret exclusion.

| Property | Detail |
|---|---|
| Impact | Security-sensitive boundaries have uneven direct regression coverage. |
| Priority | Medium-high |
| Blocks finished beta? | Recommended before broad distribution |

## Gap 10 — Legal, privacy and support product layer

**What remains for broad hosted or production use:**

- Privacy Notice;
- Terms of Use;
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

1. Proof Review history and claim ledger.
2. Returning-user dashboard.
3. Full project backup/restore.
4. Repeatable Windows release acceptance.
5. Memory Lock lifecycle controls.
6. Campaign persistence.
7. Local health centre.
8. Generated asset library.
9. Security/admin tests.
10. Legal/privacy/support layer.
11. Signing and automatic updates for production readiness.
12. Future external tools and multi-agent systems.

## Summary table

| Gap | Priority | Blocks finished beta? |
|---|---|---|
| Proof Review history | High | Yes |
| Returning-user dashboard | High | Yes |
| Full project backup/restore | High | Yes |
| Windows clean-machine acceptance | High | Yes |
| Memory Lock lifecycle | Medium | No |
| Campaign persistence | Medium | No |
| Local health centre | Medium | Partially |
| Generated asset library | Medium | No |
| Security/admin coverage | Medium-high | Recommended |
| Legal/privacy/support | High for public release | Broad release only |
| Signing and auto-update | High for production | Production readiness |
| External tools / Space Agent | Future | No |
