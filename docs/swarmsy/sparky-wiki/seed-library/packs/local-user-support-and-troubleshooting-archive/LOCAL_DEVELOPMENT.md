---
title: Local Development
category: local user support and troubleshooting archive
status_label: Draft reference
workspace_scope: current workspace only
privacy_level: workspace reference
source: old SWARMSY repo adapted reference
source_repo: HODLKONG64/SWARMSY
source_path: docs/LOCAL_DEVELOPMENT.md
optional_reference_knowledge: true
runtime_override: never
docs_spec_only: true
---


## Seed-library adaptation boundary

This file is optional workspace reference knowledge imported from the old `HODLKONG64/SWARMSY` repository. It is preserved for SPARKY Wiki continuity as **draft reference** and does not override current DIZ-A-REMIX app truth, Sparky identity, provider routing, privacy boundaries, or runtime behavior.

Safety boundary: use only lawful, permission-based, local-first planning. This pack does not create runtime actions, autonomous agents, web/API calls, mobile builds, Electron builds, release claims, or cross-workspace memory.

## Old SWARMSY source material

# Local Development

## Requirements

- Node.js 22+
- npm

## Setup

1. `npm install`
2. `npm run start`

## Common Commands

- Mobile/dev server: `npm run start`
- Web: `npm run web`
- Android: `npm run android`
- iOS: `npm run ios`
- Desktop (dev): `npm run desktop:dev`

## Quality Gates

- `npm run typecheck`
- `npm test -- --watch=false`
- `npm run check:current-truth`
- `npm run check:brand-canon`
