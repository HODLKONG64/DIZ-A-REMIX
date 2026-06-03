# SWARMSY Local User Backup Foundation

## Purpose

Define and implement the Local User data ownership layer: a safe,
user-controlled backup/export/import contract for SWARMSY Local User state.

Two backup layers now exist:

1. **Browser backup** (`swarmsy_local_user_backup` v1) — browser-side
   localStorage export/import; current compatibility fallback for all surfaces.
2. **Desktop backup v2** (`swarmsy_desktop_local_user_backup` v1) — filesystem-
   backed export/import for trusted desktop Local User mode; includes desktop
   local settings file state; writes backup files to the `backups/` directory
   in the Local User data root.

The desktop backup v2 is the preferred path when the trusted desktop bridge is
available. Browser backup remains the fallback when the bridge is unavailable.

---

## Desktop Backup v2

### Schema

```json
{
  "schema": "swarmsy_desktop_local_user_backup",
  "version": 1,
  "exportedAt": "<ISO 8601 timestamp>",
  "app": "SWARMSY",
  "mode": "local_user_desktop",
  "state": {
    "settings": {
      "ollamaModel": "llama3.1:8b",
      "provider": "ollama"
    }
  }
}
```

### Security rules

- No auth/session/API key fields are ever included.
- No server DB paths or hosted/admin data are included.
- Renderer cannot pass file paths; the main process controls backup path.
- Bridge methods are disabled for untrusted origins.
- Backup directory symlinks are rejected.
- No partial writes — validation happens before any filesystem writes.

### IPC bridge

Exposed via trusted desktop IPC only:

- `window.swarmsyDesktop.foundation.exportLocalUserBackup()` — builds backup
  from current desktop local settings, writes to `backups/`, returns backup
  object to renderer for download.
- `window.swarmsyDesktop.foundation.importLocalUserBackup(payload)` — renderer
  passes parsed JSON; main validates schema/version/allowlist and writes
  allowed settings via `localSettingsStore`.

### Source files

| File | Purpose |
|---|---|
| `desktop/foundation/localBackupStore.cjs` | Desktop backup schema, export, validate, import |
| `desktop/electron/main.cjs` | IPC handler registration for backup channels |
| `desktop/electron/preload.cjs` | Bridge exposure to trusted renderer |
| `server/__tests__/desktop/localBackupStore.test.js` | Full desktop backup test suite |

---

## Browser Backup (browser-side compatibility fallback)

### Schema

```json
{
  "schema": "swarmsy_local_user_backup",
  "version": 1,
  "exportedAt": "<ISO 8601 timestamp>",
  "state": {
    "ollamaModel": "llama3.1:8b",
    "appearanceSettings": "{\"theme\":\"dark\"}",
    ...
  }
}
```

This is a broader browser-state backup. It remains active when the desktop
bridge is unavailable and is the compatibility layer for browser-only sessions.

---

## Storage Key Audit

The following table maps every SWARMSY browser-storage key found in the
codebase as of PRs #33–#36 to its storage type and backup eligibility.

| Logical name | Storage key | Storage type | Backup? |
|---|---|---|---|
| ollamaModel | `anythingllm_swarmsy_local_user_ollama_model` | localStorage | ✅ |
| appearanceSettings | `anythingllm_appearance_settings` | localStorage | ✅ |
| promptDrafts | `anythingllm_user_prompt_input_map` | localStorage | ✅ |
| lastVisitedWorkspace | `anythingllm_last_visited_workspace` | localStorage | ✅ |
| completedQuestionnaire | `anythingllm_completed_questionnaire` | localStorage | ✅ |
| seenDocPinAlert | `anythingllm_pinned_document_alert` | localStorage | ✅ |
| seenWatchAlert | `anythingllm_watched_document_alert` | localStorage | ✅ |
| sidebarToggle | `anythingllm_sidebar_toggle` | localStorage | ✅ |
| showChatMetrics | `anythingllm_show_chat_metrics` | localStorage | ✅ |
| — | `anythingllm_user` | localStorage | ❌ credentials |
| — | `anythingllm_authToken` | localStorage | ❌ credentials |
| — | `anythingllm_authTimestamp` | localStorage | ❌ credentials |
| — | `anythingllm_pending_home_message` | **sessionStorage** | ❌ ephemeral |
| — | `anythingllm_swarmsy_local_user_active_runtime` | **sessionStorage** | ❌ ephemeral |

### Never-backup boundary

`NEVER_BACKUP_STORAGE_KEYS` (a `Set`) is enforced at both export time (fields
are simply not collected) and import time (any field whose storage key is in
the set is skipped even if somehow present in the backup object).

---

## Export flow

### Desktop v2 export

`exportLocalUserDesktopBackup(options)` in `desktop/foundation/localBackupStore.cjs`:

1. Resolves `layout.paths.backups` and asserts it is within the Local User root.
2. Ensures the backups directory exists and is not a symlink.
3. Reads current settings from `getLocalUserSettings()`.
4. Builds a backup object with `schema`, `version`, `exportedAt`, `app`, `mode`,
   and `state.settings` (only allowlisted keys).
5. Writes backup JSON to a uniquely-named file in `backups/`.
6. Returns `{ ok: true, backup, path }`.

### Browser export

`exportLocalUserBackup({ storage? })` in `frontend/src/utils/localUserBackup.js`:

1. Iterates over every entry in `BACKUP_STATE_FIELDS`.
2. Calls `storage.getItem(storageKey)` for each entry.
3. Returns a versioned backup object with `schema`, `version`, `exportedAt`,
   and `state`.

---

## Import flow

### Desktop v2 import

`importLocalUserDesktopBackup(payload, options)` in `desktop/foundation/localBackupStore.cjs`:

1. Calls `validateLocalUserDesktopBackup(payload)`. Returns error on failure.
2. Iterates over allowed settings keys from `BACKUP_ALLOWED_SETTINGS_KEYS`.
3. Skips keys absent from `payload.state.settings`.
4. Writes allowed settings via `setLocalUserSettings()`.
5. Returns `{ ok: true, restored: [...], skipped: [...], errors: [] }`.

### Browser import

`importLocalUserBackup(data, { storage? })` returns
`{ success, restored, skipped, errors }`.

1. Calls `validateLocalUserBackup(data)`. Returns `success: false` on failure.
2. Iterates over every entry in `BACKUP_STATE_FIELDS`.
3. Skips/removes/writes as appropriate.
4. Returns `{ success: true, restored: [...], skipped: [...], errors: [] }`.

---

## Settings Hub integration

`useLocalUserSettingsHub` in `frontend/src/components/SwarmsyLocalUserSettingsHub/useLocalUserSettingsHub.js`:

- `exportBackupToFile`: prefers desktop backup v2 (`exportLocalUserBackup` bridge) when available; falls back to browser export.
- `importBackupFromText`: detects schema from parsed JSON:
  - `swarmsy_desktop_local_user_backup` + bridge available → desktop v2 import path.
  - Any other schema or no bridge → browser import path (fallback/compatibility).
- After any import, live UI updates immediately: `selectedLocalOllamaModel`, `savedLocalOllamaModel`, stale/missing model warning if applicable.
- No refresh/check-again required for a valid installed model.

---

## Hosted/Admin boundary

- Hosted/Admin mode does not call the desktop backup bridge.
- Hosted/Admin server data is never exported.
- Hosted/Admin provider/chat behavior is unchanged.

---

## Hard boundaries

- No signed installer.
- No auto-update.
- No bundled Ollama.
- No bundled models.
- No auto-pull of models.
- No full browser data migration yet.
- No server DB export.
- No auth/session/API key storage in backup.
- No renderer-provided file paths.
- No hosted/admin data export.
- No VPS/Docker/nginx changes.

---

## Source files

| File | Purpose |
|---|---|
| `desktop/foundation/localBackupStore.cjs` | Desktop backup v2 schema, export, validate, import |
| `desktop/electron/main.cjs` | IPC handler registration for backup channels |
| `desktop/electron/preload.cjs` | Bridge exposure to trusted renderer |
| `frontend/src/utils/localUserBackup.js` | Browser backup schema constants, export, validate, import |
| `frontend/src/components/SwarmsyLocalUserSettingsHub/useLocalUserSettingsHub.js` | Shared Local User Settings Hub state + sync + backup routing |
| `frontend/src/components/SwarmsyLocalUserSettingsHub/index.jsx` | Local User Settings Hub UI |
| `frontend/src/components/SwarmsyFirstRunOnboarding/localUserOllamaSelection.js` | Bridge detection helpers |
| `server/__tests__/desktop/localBackupStore.test.js` | Desktop backup v2 test suite |
| `server/__tests__/frontend/localUserBackup.test.js` | Browser backup test suite |

