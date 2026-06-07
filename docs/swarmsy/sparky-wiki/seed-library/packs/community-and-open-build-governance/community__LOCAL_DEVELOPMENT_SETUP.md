---
title: Local Development Setup
category: community and open build governance
status_label: Reference knowledge
workspace_scope: current workspace only
privacy_level: workspace reference
source: old SWARMSY repo adapted reference
source_repo: HODLKONG64/SWARMSY
source_path: docs/community/LOCAL_DEVELOPMENT_SETUP.md
optional_reference_knowledge: true
runtime_override: never
docs_spec_only: true
---


## Seed-library adaptation boundary

This file is optional workspace reference knowledge imported from the old `HODLKONG64/SWARMSY` repository. It is preserved for SPARKY Wiki continuity as **reference knowledge** and does not override current DIZ-A-REMIX app truth, Sparky identity, provider routing, privacy boundaries, or runtime behavior.

Safety boundary: use only lawful, permission-based, local-first planning. This pack does not create runtime actions, autonomous agents, web/API calls, mobile builds, Electron builds, release claims, or cross-workspace memory.

## Old SWARMSY source material

# Local Development Setup

## 1) Install dependencies
```bash
npm install
```

## 2) Typecheck
```bash
npm run typecheck
```

## 3) Run tests
```bash
npm test -- --watch=false
```

## 4) Run stress sandbox
```bash
node scripts/system-sync-stress-sandbox.mjs
```

## 5) Build desktop/web when needed
```bash
npm run desktop:build:web
npm run desktop:build:win
npm run web
```

## Common failure notes
- If `jest` or `tsc` is missing, run `npm install` first.
- If validation output is large, inspect failing file paths and rerun focused checks.
- Keep planned vs live feature wording accurate in docs and tests.

## Windows CRLF note
Use consistent line endings and avoid accidental CRLF-only churn in docs/tests.

## Security note
Never commit secrets, tokens, private keys, or private incident details.
