# SWARMSY Current Truth and Status Labels

## Current Truth Principle

The app must tell the user what is actually true **now**.

- No pretending runtime features exist when they do not.
- No presenting docs/spec plans as shipped behavior.
- No hiding hosted-vs-local reality.

## Status Labels

| Label | Definition |
|---|---|
| Live | Implemented and currently available in runtime now. |
| Working | Feature path currently functions in runtime checks/usage. |
| Connected | External provider/tool endpoint is reachable now. |
| Configured | Required settings/keys are present and validly configured. |
| Local-only | Runs only in local user environment, not hosted/admin path. |
| Hosted/admin | Runs in the hosted/admin deployment path. |
| Docs/spec only | Documented concept with no runtime implementation yet. |
| Planned | Intended future implementation; not wired yet. |
| Blocked | Cannot proceed due to dependency/permission/missing prerequisite. |
| Unavailable | Not present or not reachable in current environment. |
| Unknown | State cannot be determined from current evidence/checks. |
| Not wired yet | Components exist in part, but runtime wiring is incomplete. |
| Needs user action | User must provide setup/action before progress can continue. |

## Provider Truth Rules

- Never fake provider output.
- Never pretend a model/API/tool is connected.
- Never claim image generation is available unless an image engine is connected.
- Never claim local storage if data is on hosted server storage.
- Always distinguish hosted/admin mode from Local User Mode.
- Always distinguish docs/spec from runtime.

## UI/Status Examples

| Scenario | Correct status expression |
|---|---|
| Ollama connected | `Connected` + `Live` (if active runtime path uses it). |
| Ollama unreachable | `Unavailable` or `Blocked` + `Needs user action` (fix endpoint/runtime). |
| ComfyUI connected | `Connected` (image path can be offered if routed). |
| ComfyUI missing | `Unavailable` + `Not wired yet` or `Needs user action` depending on mode/setup. |
| API key missing | `Needs user action` + `Not configured`. |
| Hosted server storage in use | `Hosted/admin` (do not label as local-only storage). |
| Local User Mode planned work | `Docs/spec only` or `Planned` until runtime is shipped. |

## Product Integrity Notes

- If confidence is low, say `Unknown` rather than inventing certainty.
- If a feature is future-facing, label it explicitly.
- “Current Truth” applies to providers, storage, capabilities, and mode boundaries.
