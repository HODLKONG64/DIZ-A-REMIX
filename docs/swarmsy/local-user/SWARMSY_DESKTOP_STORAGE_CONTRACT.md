# SWARMSY Desktop Storage Contract

## Scope

This document defines the first version of the downloadable-app local storage manifest and validation boundary for SWARMSY Local User mode.

This is a spec + helper foundation only. It does not package desktop runtime yet.
Desktop wrapper foundation now consumes this contract via `desktop/foundation/storageContractBridge.cjs` and keeps browser `localStorage` as the active state until migration work.

## Manifest schema (v1)

```json
{
  "schema": "swarmsy_local_user_storage_manifest",
  "version": 1,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "app": "SWARMSY",
  "mode": "local_user",
  "paths": {
    "profile": "...",
    "settings": "...",
    "hives": "...",
    "chats": "...",
    "uploads": "...",
    "memoryLocks": "...",
    "backups": "...",
    "logs": "...",
    "runtime": "...",
    "temp": "..."
  }
}
```

## Validation rules

- `schema` must equal `swarmsy_local_user_storage_manifest`.
- `version` must equal `1`.
- `app` must equal `SWARMSY`.
- `mode` must equal `local_user`.
- `createdAt` and `updatedAt` must be valid ISO date strings.
- `paths` must include all required contract keys.
- Every path must remain inside the resolved Local User data root.
- Hosted/server paths are rejected by root-boundary validation.
- Only the v1 schema keys are allowed at the top level (`schema`, `version`, `createdAt`, `updatedAt`, `app`, `mode`, `paths`); any other top-level key is rejected.
- Only the required contract path keys are allowed inside `paths`; any unknown path key is rejected.

## Security boundary

The manifest is metadata only. It must not contain:

- auth/session tokens
- hosted credentials
- API keys
- hosted/server database locations

`runtime/` and `temp/` are explicitly non-portable and rebuildable.

## Hosted/Admin boundary

Hosted/Admin mode stays unchanged:

- hosted app data remains server-side
- Docker/VPS deployment is unchanged
- existing AnythingLLM DB paths are unchanged

This local storage contract must not be applied to hosted/admin runtime flows.

## Stress-test coverage in this PR

Tests cover:

- platform root resolution (Windows/macOS/Linux + fallback)
- required folder layout shape
- manifest schema/version/path validation
- missing required paths rejection
- path traversal/hosted-path rejection
- unknown top-level field rejection (allowlist enforcement)
- unknown paths key rejection (allowlist enforcement)
- secret/auth/session/API-key field rejection

## Non-goals (this PR)

- no signed production Electron/Tauri installer packaging
- no auto-update pipeline
- no real production data migration
- no hosted data migration
- no Docker/VPS path changes
- no server DB export
- no auto-install/pull for Ollama

## Desktop local backup/export/import v2 (current)

- Desktop trusted Local User mode now has a backup/export/import v2 layer via `desktop/foundation/localBackupStore.cjs`.
- Backup schema is `swarmsy_desktop_local_user_backup` v1 and stores only allowlisted desktop Local User state (`state.settings` with `ollamaModel` and `provider`).
- Backup files are written to `layout.paths.backups/` (the `backups/` directory in the Local User data root).
- The renderer never passes file paths — the main process controls backup path resolution entirely.
- Export and import are exposed as trusted desktop IPC bridge methods:
  - `window.swarmsyDesktop.foundation.exportLocalUserBackup()` → returns backup object; renderer downloads as JSON file.
  - `window.swarmsyDesktop.foundation.importLocalUserBackup(payload)` → renderer passes parsed JSON; main validates and writes.
- Bridge methods are disabled for untrusted origins (same rules as the settings bridge).
- Import validates schema, version, top-level field allowlist, state field allowlist, and forbidden field denylist before writing any settings.
- Browser backup (`swarmsy_local_user_backup`) remains the fallback/compatibility layer when the desktop bridge is unavailable.
- No auth tokens, API keys, session keys, pending home messages, or server DB paths are included.
- No full data migration yet; no installer, auto-update, bundled Ollama, or bundled models.
- Hosted/Admin behavior remains separate and unchanged.
