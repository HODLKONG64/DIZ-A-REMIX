# SWARMSY Doctor and Sandbox Rehearsal Notes

## Scope

This salvages old SWARMSY repair/safety doctrine into DIZ-A-REMIX docs as future-facing behavior unless explicitly runtime-wired.

## Doctor repair agent

Doctor is the safe repair lane that should:

1. inspect
2. diagnose
3. propose fix
4. create backup/snapshot
5. rehearse in sandbox
6. compare result
7. explain risk
8. apply only after confirmation

Status in DIZ-A-REMIX: **Docs/spec only** unless explicitly implemented in runtime.

## Sandbox rehearsal lane

Before destructive action:

1. create sandbox
2. rehearse fix
3. compare outputs
4. report risk
5. apply only after confirmation

Status in DIZ-A-REMIX: **Future-facing** unless explicitly implemented in runtime.

## Guardrails

Guardrails should prevent accidental damage without making the system boring.

- no destructive commands without backup
- no secret leakage
- no cross-workspace mutation
- no fake provider output
- no deleting hosted/admin setup unless explicitly requested
- no overwriting live config without snapshot
- no old runtime migration unless explicitly scoped

## Boundary

- No automatic migration of old SWARMSY runtime/app code.
- No hidden destructive behavior.
- Keep hosted/admin continuity protected.
