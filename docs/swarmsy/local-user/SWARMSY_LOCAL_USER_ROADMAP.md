# SWARMSY Local User Roadmap

Last updated: 2026-07-16

## Purpose

Track what is actually shipped, partially shipped, not built, or deliberately future work for the downloadable SWARMSY Local User product while preserving Hosted/Admin Mode.

This roadmap is subordinate to the top-level `README.md`, current runtime code, migrations and tests. It must be updated whenever merged runtime work changes a status below.

## Status language

- **Shipped** — implemented in runtime and covered by repository tests or build checks.
- **Partial / beta** — a working foundation exists but still needs product hardening, external setup, signing, wider acceptance or lifecycle controls.
- **Not built** — no complete end-to-end runtime system exists.
- **Future power feature** — useful expansion that is not required for the guided identity-creation beta.

## Current truth

| Area | Status | Current reality |
|---|---|---|
| Hosted/Admin separation | Shipped | Hosted/Admin behaviour remains separate from trusted desktop Local User flows. |
| Beginner SPARKY home | Shipped | Three plain starting choices, one-click setup/recovery and returning-user continuation are implemented. |
| Identity intake persistence | Shipped | Full or partial answer batches are stored by user and workspace and restored when the user returns. |
| Identity Idea capture | Shipped | Finished SPARKY proposals are captured as structured Identity Ideas with Keep, Delete, Try Another and explicit save behaviour. |
| Memory Lock core storage | Shipped | User-and-workspace-scoped storage, API access, frontend helpers and a minimal viewer/import flow are implemented. |
| Memory Lock lifecycle controls | Partial / beta | Archive, delete, export, compare, restore and advanced version controls remain. |
| Proof Review core storage | Shipped | Durable user-and-workspace-scoped Proof Review storage and authenticated API access are implemented. |
| Proof Review history surface | Partial / beta | Version history, active-state display, reopen-in-SPARKY and Markdown export exist; comparison, claim statuses and lifecycle controls remain. |
| Returning-user dashboard | Partial / beta | Core intake, Identity Idea, Memory Lock and Proof Review state plus a recommended next action are visible; campaign and generated-asset state await dedicated persistence. |
| Campaign planning handoff | Shipped | Campaign-day prompts can be handed to SPARKY. |
| Campaign storage and calendar history | Not built | Campaign output still needs dedicated persistence and a retrievable calendar view. |
| Local Ollama detection | Shipped | The app checks Ollama readiness and lists installed models. |
| Local model selection and routing | Shipped | Users select an installed model and Local User chat routes through it without silently switching providers. |
| Local ComfyUI readiness | Shipped | The app reports configuration and reachability. |
| Local ComfyUI generation | Partial / beta | Submission and polling work, but ComfyUI, models and workflow JSON are user supplied. |
| Generated asset library | Not built | Generated prompts and images need a persistent project-linked asset surface. |
| Per-message `Use API` | Shipped | API routing occurs only with explicit user intent and a configured provider. |
| Local settings backup | Shipped | Allowlisted settings export/import is filesystem-backed with path and credential protections. |
| Project backup and restore | Partial / beta | A versioned read-only export and dry-run validator cover active intake, Identity Ideas, Memory Locks and Proof Reviews. Restore, chats, documents, campaigns, assets and migrations remain. |
| Desktop wrapper and runtime | Partial / beta | Electron wrapper, trusted bridge, runtime launcher, packaged runtime and installed-launch smoke exist. |
| Windows artifact and installer | Partial / beta | Build, installer, dependency archive, integrity, installed-runtime smoke and release workflows exist; signing, auto-update and broader clean-machine acceptance remain. |
| Desktop diagnostics | Shipped | Safe runtime, model, bridge, settings and backup failure reasons are surfaced. |
| Optional cloud sync | Not built | Local-first remains the default; no complete opt-in encrypted project sync exists. |
| External tools / Space Agent | Future power feature | Live web, email, file writing, scheduling and multi-agent tools must not be claimed until deliberately implemented. |

## Phase 1 — Product split and consent guardrails

**Status: Shipped**

- Hosted/Admin Mode is preserved.
- Local User Mode is the privacy-first downloadable path.
- No silent Ollama installation, model pull, image-engine installation, paid API call or cloud sync.
- Provider selection changes SPARKY's supporting engine; it does not replace SPARKY.

## Phase 2 — Beginner identity journey

**Status: Shipped**

- One-click SPARKY setup and plain-language recovery.
- Face, hidden identity and existing-project entry routes.
- Batch-first 76-question intake with durable resume state.
- WTF / SAFE creative-intensity choice.
- MESSAGE, DOODAD and PLACEMENT proposal contract.
- Structured Identity Idea capture.
- Keep, Delete and Try Another decisions.
- SPARKY brainstorming and explicit save recognition.
- Returning-user continuation.
- Deterministic complete beginner-journey regression coverage.

## Phase 3 — Persistent creator operating systems

**Status: Partial / beta**

### Shipped

- Memory Lock core storage, retrieval and minimal viewer/import.
- Proof Review core storage and authenticated API access.
- Proof Review version history, reopen flow and Markdown export.
- Durable intake sessions and Identity Ideas.
- Core returning-user project dashboard and recommended next action.
- Campaign-day SPARKY handoff.

### Remaining

- Structured Proof Review claim/evidence statuses and comparison.
- Advanced Memory Lock lifecycle controls.
- Persistent campaign records and calendar history.
- Generated asset library.
- Dashboard enrichment once campaign and generated-asset persistence exists.

## Phase 4 — Local data ownership

**Status: Partial / beta**

### Shipped

- Deterministic Local User data-directory contract.
- Filesystem-backed desktop settings.
- Allowlisted settings backup/export/import.
- Symlink, path-containment, schema and credential-exclusion protections.
- Versioned read-only SWARMSY project export for active intake, Identity Ideas, Memory Locks and Proof Reviews.
- Dry-run project backup validation that never applies restore writes.

### Remaining

- Versioned full-project restore.
- Conflict handling and migration support for older project exports.
- Recovery of chats, completed intake history, documents, campaigns, generated assets and user-grown packs.
- Clean uninstall/reinstall acceptance proving user project data survives.

## Phase 5 — Local AI and image generation

**Status: Partial / beta**

### Shipped

- Ollama readiness and installed-model discovery.
- Explicit local model selection and routing.
- ComfyUI readiness guidance.
- Local/private ComfyUI generation MVP.
- Explicit per-message API routing.

### Remaining

- Friendlier ComfyUI workflow/model selection.
- Persistent generated-asset library with project attachment.
- Broader Windows and GPU compatibility testing.
- A fuller health centre for collector, model, image engine, database, disk and port failures.

## Phase 6 — Downloadable Windows product

**Status: Partial / beta**

### Shipped

- Electron desktop wrapper and trusted preload bridge.
- Runtime health checks and launcher.
- Production runtime staging.
- Dependency archive and short-path extraction strategy.
- Artifact and NSIS installer packaging.
- Integrity checks and release workflow.
- Portable and installed-runtime smoke coverage.

### Remaining

- Repeatable clean-machine acceptance beyond CI.
- Signed Windows builds.
- Secure automatic updates and release channels.
- User-facing download page.
- Version, support and rollback policy.
- Installer/uninstaller acceptance proving Local User data survives uninstall.

## Phase 7 — Optional sync and provider expansion

**Status: Partial / beta**

- Configured online provider routing exists behind explicit per-message intent.
- Provider keys remain removable and excluded from normal backups.
- Optional encrypted cloud/project sync is not built.
- External action tools and multi-agent execution are future power features, not beta blockers.

## Acceptance guardrails

- Hosted/Admin Mode must not regress.
- Local User Mode must remain usable without paid API keys.
- No API usage without explicit intent.
- No silent model, runtime, image-engine or cloud installation.
- No claim that settings backup or the read-only project export is a complete restore system.
- No claim that unsigned beta artifacts are production-ready releases.
- No claim that campaign persistence, complete project restore, auto-update or external action tools are complete until runtime proves it.
- Memory Lock core storage, intake persistence, Identity Ideas, Proof Review core storage, Proof Review history and the core returning-user dashboard must not be described as unbuilt.

## Definition of finished beta

SWARMSY may be called a finished beta when:

- a normal user can install and start it without developer tools;
- SPARKY setup and recovery are understandable;
- identity intake, proposal, approval and continuation work end to end;
- Memory Locks and Proof Review are visible and usable across sessions;
- a returning user has a clear project dashboard;
- full project backup and restore work;
- the installer passes repeatable clean-machine acceptance;
- failures produce safe, useful diagnostics;
- all public status claims match runtime truth.

## Definition of production-ready

Production readiness additionally requires:

- signed binaries and installer;
- secure automatic updates;
- versioned backup migrations;
- published privacy, terms and support policies;
- safe observability and security regression coverage;
- repeatable clean-machine installation, upgrade and recovery acceptance.
