# SWARMSY Doctor and Sandbox Rehearsal Notes

## Scope

This document captures the Doctor/sandbox safety concept as a future-facing operating spec unless already implemented.

## Doctor Repair Agent

Doctor is a future agent lane that can:

- inspect system/project state safely,
- explain detected issues clearly,
- propose repair options with risk notes,
- avoid silent/destructive auto-changes.

Status: **Docs/spec only** unless explicitly implemented in runtime.

## Sandbox Rehearsal Lane

Before any destructive action:

1. Create sandbox.
2. Rehearse fix.
3. Compare outputs (before vs rehearsal).
4. Report risk and rollback path.
5. Apply only after explicit confirmation.

Status: **Future-facing** unless explicitly implemented.

## Guardrails

- No destructive commands without backup.
- No secret leakage.
- No cross-workspace mutation.
- No fake provider output.
- No deleting hosted/admin setup unless explicitly requested.
- No overwriting live config without snapshot.
- No old runtime migration unless scoped.

These guardrails should prevent accidental damage without making the system boring.

## Future Implementation Notes

- Doctor tooling, sandbox orchestration, and repair workflows remain future-facing specs by default.
- Any runtime claim must be labeled `Live` only after real wiring, validation, and mode-safe boundaries exist.
- Hosted/admin continuity remains protected while local-user capabilities evolve separately.
