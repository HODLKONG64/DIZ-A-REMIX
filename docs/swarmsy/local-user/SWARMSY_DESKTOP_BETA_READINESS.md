# SWARMSY Desktop Beta Readiness

This note captures the final core desktop Local User readiness state for manual Windows beta testing.

## What works

The hardened desktop Local User path is ready for manual beta validation:

1. Download the Windows desktop artifact or installer from the configured GitHub Actions workflow run.
2. Launch SWARMSY Desktop.
3. The desktop wrapper checks the trusted local runtime URL before loading the app.
4. If the runtime is missing or unhealthy, the wrapper renders a local-runtime failure page with manual start guidance instead of loading an unsafe or misleading page.
5. In trusted desktop Local User context, the first-run wizard can guide the user through runtime readiness, Ollama status, installed model review, model selection, and completion persistence.
6. The trusted desktop bridge exposes only the storage contract, runtime status, Local User settings, and Local User backup operations to trusted localhost desktop origins.
7. Local User model selection is stored in browser Local User fallback storage and mirrored into desktop Local User settings when the bridge is available.
8. Chat/intake readiness remains tied to an installed, selected Local User Ollama model and does not silently switch to Hosted/Admin providers.
9. Diagnostics surface safe user-facing reasons for runtime, Ollama, model, bridge, settings, and backup failures.
10. Desktop backup/export/import covers allowed Local User settings only and keeps server DB, auth/session data, API keys, and Hosted/Admin state out of backup files.
11. The Windows artifact workflow launches the packaged EXE with empty user data, waits for its managed local server, confirms Electron loaded the SWARMSY page, and verifies the first-run database and local secrets were created.
12. Artifact, installer, signing-readiness, and release integrity scripts have focused smoke coverage for beta packaging validation.
13. The installer uninstall guard is intended to remove only installed application files and not Local User data, settings, or backups.

## Automated Windows launch gate

Every packaging-impacting pull request must pass **Launch packaged desktop and verify fresh first run**. This check uses the built Windows EXE rather than source-code mocks. It must prove all of the following before the workflow passes:

- the packaged EXE starts and stays running;
- the managed local server becomes reachable on a clean temporary port;
- the server returns the built SWARMSY frontend shell;
- Electron opens a page served by that same local server;
- a fresh SQLite database is created outside the installed application files;
- fresh JWT and signature secrets are generated locally;
- the managed-runtime manifest is created;
- the complete desktop and server process tree can be stopped after the check.

This catches missing packaged dependencies, migration failures, runtime startup failures, broken frontend packaging, and Electron-to-server loading failures that file-presence checks cannot catch.

## What is intentionally not included

The beta desktop path deliberately does not include:

- Auto-update.
- Bundled Ollama.
- Bundled Ollama models.
- Automatic model pulls.
- Automatic third-party runtime installation.
- Real code-signing certificates, private keys, or committed signing secrets.
- Hosted/Admin behavior changes.
- Server database export or Hosted/Admin backup export.

## How to download the desktop artifact

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Run or open the **Windows Desktop Artifact Build** workflow.
4. Download the `swarmsy-desktop-win32-x64` workflow artifact.
5. Extract the zip on Windows and run the packaged desktop executable from the extracted folder.

The artifact workflow uploads both the packaged folder and zip so manual testers can inspect the self-contained app bundle before launch.

## How to download the installer

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Run or open the **Windows Desktop Installer Build** workflow.
4. Download the `SWARMSY-Desktop-Setup` workflow artifact.
5. Run `SWARMSY-Desktop-Setup.exe` on Windows.

The installer workflow also uploads the release manifest files and desktop zip needed for integrity validation.

## How to validate release integrity

For a local validation pass after downloading workflow artifacts:

1. Keep `SWARMSY-Desktop-Setup.exe`, `swarmsy-desktop-win32-x64.zip`, and `SWARMSY-Desktop-Release.json` together under `desktop/artifacts/` or an equivalent copied artifacts directory.
2. Run:

   ```bash
   npm run desktop:release:validate
   ```

3. Confirm validation succeeds for untouched files.
4. For tamper testing, modify either the installer or zip and run the validation command again; validation should fail.

The manifest uses relative artifact filenames so download-style copies can be validated without preserving a machine-specific absolute path.

## Known limitations

- Builds are unsigned unless certificate secrets are configured in a future signing workflow.
- There is no auto-update mechanism.
- Ollama is not bundled.
- Ollama models are not bundled.
- SWARMSY does not automatically pull models.
- The desktop wrapper expects the local SWARMSY runtime to be reachable or explicitly auto-started in the supported development path.
- Local User data stays local to the user's machine.
- Manual Windows testing is still required for beta acceptance across artifact launch, installer launch, release integrity validation, and uninstall behavior.

## Final human acceptance check

CI proves that the packaged application can boot. Before publishing a beta release, one ordinary Windows user should still complete this short real-model check without Node, yarn, a terminal, or developer help:

1. Install and open SWARMSY Desktop on a clean Windows account.
2. Use **Set up SPARKY** and confirm the screen explains any missing AI connection in plain language.
3. Connect an installed Ollama model, choose **Build around me** or **Build a hidden identity**, and answer the questions in one or more batches.
4. Confirm SPARKY creates an Identity Idea containing MESSAGE, DOODAD, and PLACEMENT, then use Keep, Delete, or Try another.
5. Keep one idea, talk it through, refresh the chat, and say **save this idea**. Confirm the same idea is saved to the SWARMSY workspace.
6. With no image AI configured, confirm the exact reusable image prompt is visible and copyable.
7. If an image engine is available, confirm SPARKY attempts the image and still shows the reusable prompt.
8. Configure one API-backed chat provider, repeat a short SPARKY conversation, and confirm the provider helps SPARKY without replacing SPARKY's name, behaviour, or saved workspace memory.
9. Close and reopen the app. Confirm the saved Identity Idea and unfinished work remain available.

Record the Windows version, artifact commit, Ollama model, API provider, and pass/fail result. A failure in any step blocks that beta release; it does not become another feature request.

## Hosted/Admin safety statement

Hosted/Admin mode is intentionally unchanged by the desktop Local User beta hardening pass. The desktop first-run wizard, desktop bridge, Local User backup/export/import, Local User model persistence, and Local User diagnostics are scoped to trusted desktop Local User contexts. Hosted/Admin auth/session data, API keys, server database files, and Hosted/Admin settings are not exported by the Local User backup path.

## Beta readiness verdict

The core desktop Local User flow is ready for manual Windows beta testing when CI and the focused desktop/frontend suites pass. The expected manual path is:

```text
download artifact/installer
→ launch desktop
→ pass or explain runtime readiness
→ complete first-run setup
→ select an installed Ollama model
→ use the Local User chat path
→ backup and restore Local User settings
→ review safe diagnostics
→ verify release integrity
→ uninstall without deleting Local User data
→ confirm Hosted/Admin remains unaffected
```
