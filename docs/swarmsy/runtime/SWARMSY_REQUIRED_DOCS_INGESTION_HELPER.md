# SWARMSY Required Docs Ingestion Helper

This document explains the runtime helper that verifies and ingests the SWARMSY doctrine documents required by the `SWARMSY HIVE` workspace.

---

## Purpose

`SWARMSY HIVE` needs a truthful way to know which doctrine docs exist, which are readable, and which still need to be attached to the workspace brain.

This helper does **not** rewrite AnythingLLM ingestion. It only uses existing document mechanisms to:

- load a required-docs manifest
- verify required files on disk
- report grouped status
- optionally ingest the required docs into an existing `SWARMSY HIVE` workspace on demand

It does **not** auto-run on boot and does **not** auto-ingest for every workspace.

---

## Manifest Location

```text
server/config/swarmsy/SWARMSY_REQUIRED_DOCS_MANIFEST.json
```

The manifest currently tracks:

- Living Icon Engine prompt tree
- SPARKY persona
- Operating layer docs
- Disruption engine docs
- App-mode docs

All current groups are marked required.

---

## Helper Functions

Implemented in:

```text
server/utils/swarmsy/requiredDocs.js
```

Exports:

- `loadSwarmsyRequiredDocsManifest()`
- `getSwarmsyRequiredDocsStatus()`
- `getSwarmsyRequiredDocPaths()`
- `ingestSwarmsyRequiredDocsForWorkspace(workspace, options?)`

### Status Behavior

The helper verifies each manifest file and reports:

- `present`
- `missing`
- `required`
- `optional`
- `loadable`

Doctrine docs root resolution:

- Default local/dev docs root is the repository root.
- Set `SWARMSY_DOCTRINE_DOCS_ROOT` to override runtime resolution (example: `/app` or repo root path).
- Manifest paths resolve relative to that docs root.
- `SWARMSY_DOCTRINE_DOCS_ROOT` must point to the parent directory that contains `docs/`, because manifest entries already include the `docs/` prefix.
- Manifest paths cannot escape the configured docs root (and cannot escape repo root when the configured root is inside the repo).
- If the configured docs root is unavailable, status truthfully reports docs as unavailable/missing and `documentsToIngest` is empty.

Important:

- A file being present on disk is **not** treated as already loaded into a workspace.
- The status helper returns a `documentsToIngest` list so callers know which files still represent required doctrine inputs.

---

## Routes

### Status Route

- **Method:** `GET`
- **Path:** `/api/admin/swarmsy/required-docs/status`

Auth:

- `validatedRequest`
- `flexUserRoleValid([ROLES.admin, ROLES.manager])`

Response includes:

- manifest name/version
- grouped file status
- required/optional summary counts
- `documentsToIngest`

### Ingestion Route

- **Method:** `POST`
- **Path:** `/api/admin/swarmsy/workspace-preset/hive/ingest-required-docs`

Auth:

- `validatedRequest`
- `flexUserRoleValid([ROLES.admin, ROLES.manager])`

Accepted body:

```json
{
  "workspaceId": 123
}
```

or:

```json
{
  "workspaceSlug": "swarmsy-hive"
}
```

If no target is provided, the route falls back to the current creator's existing `SWARMSY HIVE` workspace lookup.

---

## What Is Wired Now

The ingestion helper uses existing AnythingLLM document mechanisms only:

1. Reads the repo markdown file from disk.
2. Sends the text through the existing collector raw-text endpoint via `CollectorApi.processRawText(...)`.
3. Attaches/embeds the resulting document with the existing `Document.addDocuments(...)` workflow.

Duplicate protection is intentionally limited to the straightforward case:

- docs already attached by this helper are marked with `file://docs/...` metadata
- the helper checks existing workspace documents for those tracked metadata sources before ingesting again

This avoids pretending docs are loaded just because they exist in the repo.

---

## What Remains Manual / Docs-Only

Still not wired:

- boot-time automatic SWARMSY doctrine ingestion
- first-run onboarding auto-trigger for doctrine ingestion
- Spark Library integration
- old SWARMSY repo salvage
- Space Agent integration

If future work adds onboarding automation, it should call the existing helper explicitly rather than replacing the ingestion path.

---

## Manual Verification

### Verify Required Docs on Disk

1. Open `server/config/swarmsy/SWARMSY_REQUIRED_DOCS_MANIFEST.json`.
2. Confirm each listed path still exists in the repo.
3. Call:

```bash
AUTH_HEADER="******"
curl http://localhost:3001/api/admin/swarmsy/required-docs/status \
  -H "Authorization: ${AUTH_HEADER}"
```

Replace `<YOUR_ADMIN_JWT>` with your admin JWT.

4. Verify:
   - `success: true`
   - grouped counts are correct
   - `requiredMissing === 0`
   - `documentsToIngest` lists the doctrine docs that can be attached

### Verify Ingestion into SWARMSY HIVE

1. Ensure the collector/document processor is online.
2. Ensure a `SWARMSY HIVE` workspace already exists.
3. Call:

```bash
AUTH_HEADER="******"
curl -X POST \
  http://localhost:3001/api/admin/swarmsy/workspace-preset/hive/ingest-required-docs \
  -H "Authorization: ${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{"workspaceSlug":"swarmsy-hive"}'
```

Replace `<YOUR_ADMIN_JWT>` with your admin JWT.

4. Verify the response clearly reports:
   - `success`
   - `partial`
   - `errorCode` (`COLLECTOR_OFFLINE` when the collector is offline)
   - `ingested`
   - `skipped`
   - `failed`

---

## How This Connects to SWARMSY HIVE

`SWARMSY HIVE` is the workspace preset and command centre.

This helper is the runtime/config bridge that tells the preset which doctrine docs are actually available for ingestion, and then attaches them with existing AnythingLLM document APIs when an admin explicitly requests it.

Runtime caveat:

- If doctrine docs are not copied into a runtime image, status/ingestion will truthfully report missing/unavailable docs.
- In Docker/runtime, either copy doctrine docs into the image or set `SWARMSY_DOCTRINE_DOCS_ROOT` to a mounted/copied docs path.
- A future Docker/image PR should implement one of those runtime options.

---

## Rollback Notes

To roll back this helper:

1. Remove `server/config/swarmsy/SWARMSY_REQUIRED_DOCS_MANIFEST.json`
2. Remove `server/utils/swarmsy/requiredDocs.js`
3. Remove:
   - `GET /api/admin/swarmsy/required-docs/status`
   - `POST /api/admin/swarmsy/workspace-preset/hive/ingest-required-docs`
4. Remove this document

No database rollback is required.

---

## Future Onboarding Integration

If a future onboarding flow offers a `Load SWARMSY doctrine` step, it should:

1. create or find the `SWARMSY HIVE` workspace
2. call the status route first
3. call the ingestion route only as an explicit user/admin action
4. surface real ingestion results instead of assuming the docs are loaded
