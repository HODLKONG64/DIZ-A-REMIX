# SWARMSY Desktop Diagnostics

The frontend desktop diagnostics catalog is the canonical source for Local User desktop recovery copy.

| Code                         | Canonical wording                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `selected_model_stale`       | The saved Local User Ollama model is missing from the current Ollama model list. Select an installed model to continue. |
| `local_provider_unavailable` | SWARMSY could not reach the local Ollama provider required for Local User mode.                                         |
| `selected_model_not_ready`   | The selected Local User Ollama model is saved, but SWARMSY has not confirmed it is ready for chat.                      |
| `model_restore_failed`       | SWARMSY imported the backup, but the saved Local User Ollama model could not be restored safely.                        |
