# SWARMSY — DIZ-A-REMIX

**A beginner-first identity creator and brainstorming partner, led by SPARKY.**

SWARMSY helps ordinary people create a distinctive identity, character, project, or creative direction without needing to understand AI tools. The user answers clear questions, SPARKY proposes an original idea, and the user can keep it, delete it, try another direction, or discuss changes until it feels right.

SWARMSY is built on AnythingLLM and supports hosted, local, and API-backed AI providers. Those providers supply capability; SPARKY remains the visible brain, guide, and memory manager throughout every SWARMSY workspace.

## Product mission

SWARMSY is not intended to feel like developer software, an AI control panel, or a generic chat wrapper. It is intended for people who may know nothing about models, prompts, providers, vector databases, agents, or workspace configuration.

The default experience must be conversational and forgiving:

1. The user starts creating an identity.
2. SPARKY asks one simple question at a time.
3. The app saves progress automatically.
4. Before the idea is created, the user chooses **WTF** or **SAFE**. If they skip it, SPARKY defaults to WTF.
5. SPARKY creates a unique identity idea from the answers.
6. The user can **Keep**, **Delete**, or **Try Another**.
7. A kept idea becomes a simple SPARKY brainstorming conversation.
8. The user can ask “why?”, request changes, reject details, or explore alternatives.
9. Nothing becomes an approved project idea until the user explicitly asks to save it.
10. When the user says something like “Great, save that idea,” the approved idea is stored in the owning workspace and can be continued later.

Every Identity Idea must have three simple hooks:

- **MESSAGE** — the key line or thought people remember.
- **DOODAD** — a recognisable visual thing, such as a rat, smiley, animal silhouette, symbol, or strange object.
- **PLACEMENT** — a fictional, legal concept-mockup setting that makes the message hit harder.

**WTF** means maximum raw, strange, provocative shock-marketing energy while remaining legal, non-hateful, and non-harmful. **SAFE** means bold and memorable but easier to share; it must never collapse into generic corporate branding.

Advanced systems may exist internally, but normal users should not need to understand or operate them.

## The SPARKY contract

SPARKY is the permanent product agent inside every SWARMSY workspace.

A user may select Ollama, another local model, or a configured API provider. That selection changes the supporting inference engine; it must not replace SPARKY, bypass SPARKY's instructions, or turn a SWARMSY workspace into generic model chat.

Every reply in a SPARKY chat must pass through:

- the SPARKY system prompt and behaviour contract;
- the current SWARMSY workspace and owning-user boundary;
- the user's saved identity decisions and approved project state;
- relevant workspace memory, Memory Locks, and stored continuity records;
- the selected provider only as a supporting reasoning and generation engine.

In plain user-facing language:

> You are working with SPARKY. Your selected AI helps SPARKY think, but SPARKY manages your questions, ideas, and saved project memory.

Changing providers must never silently change the agent identity. Provider names and technical configuration should remain secondary to the SPARKY experience.

## Workspace identity and boundaries

Workspaces created by the SWARMSY flow are **SWARMSY/SPARKY workspaces**, not generic AnythingLLM workspaces. The interface must make this unmistakable through naming, branding, navigation, and explanatory copy.

A SWARMSY/SPARKY workspace must:

- be visibly identified as a SPARKY-led SWARMSY workspace;
- preserve the SPARKY prompt and product behaviour regardless of provider;
- keep user and workspace data correctly isolated;
- store approved ideas and continuity in durable application storage;
- resume the user's project without requiring them to reconstruct prior chat context;
- avoid exposing internal implementation language unless recovery genuinely requires it.

AnythingLLM remains an important part of the product. Users should be encouraged to switch to the general AnythingLLM experience when they want deeper document work, advanced configuration, or open-ended AI assistance outside the guided SWARMSY journey.

The product distinction should be clear:

- **Continue with SPARKY** — guided identity creation, decisions, brainstorming, and saved project continuity.
- **Open AnythingLLM** — advanced and general-purpose AI workspace features.

AnythingLLM is the foundation and advanced environment. SWARMSY is the opinionated beginner product built on top of it.

## Memory and approval rules

The selected AI model is not the source of truth for user memory. Durable application storage is.

SPARKY acts as the user-facing memory manager, while the application owns persistence and access control. Saved records must be scoped to both the owning user and the owning workspace unless a separately specified single-user fallback applies.

The system must distinguish between:

- a suggestion SPARKY has generated;
- an idea the user has kept for further discussion;
- changes discussed in chat;
- an idea the user has explicitly approved and saved.

SPARKY must not silently overwrite an approved identity, Memory Lock, or project state. Material changes require clear user intent. Delete actions must be understandable and deliberate. A new chat thread must not automatically mean a new project.

## Beginner-first interface rules

New user-facing work should follow these rules:

- Prefer ordinary language such as “Start,” “Continue,” “Keep,” “Delete,” “Try another,” and “Save this idea.”
- Ask one clear question at a time.
- Explain why a question matters only when useful.
- Save progress without requiring a technical action.
- Offer a safe way to skip, go back, change an answer, or try again.
- Hide model, prompt, doctrine, collector, embedding, database, and routing terminology from the normal journey.
- Automatically perform safe workspace setup where possible.
- Translate setup problems into plain recovery instructions.
- Keep advanced controls separate from the beginner path.
- Never require users to paste internal prompts, operate developer tools, or understand AnythingLLM architecture.

The success test is not whether the underlying feature exists. The success test is whether a first-time, non-technical user can complete the journey without outside help.

## Anti-drift rules for contributors

Future changes must preserve these invariants:

1. SPARKY remains the agent identity in every SWARMSY chat, independent of the selected model or provider.
2. SWARMSY-created workspaces remain visibly distinct from generic AnythingLLM workspaces.
3. Provider selection configures SPARKY's supporting engine; it does not create a direct provider chat path.
4. Identity creation remains beginner-first and conversational.
5. Generated ideas require a clear keep/delete/try-another decision.
6. Approved project state is saved only after explicit user intent.
7. Durable memory belongs to the application and is scoped safely by user and workspace.
8. Advanced AnythingLLM capabilities remain available without taking over the default SWARMSY journey.
9. Technical implementation details must not leak into ordinary user copy without a genuine recovery need.
10. Infrastructure work should support the end-to-end user journey, not become a substitute for completing it.

A pull request that conflicts with these rules should explain why and update this contract deliberately. The product should never drift through incidental implementation decisions.

## Current product state

Shipped foundations include:

- SPARKY workspace prompting, HIVE creation, doctrine loading, intake chat handoffs, and local Wiki retrieval;
- local Ollama detection, installed-model selection, and local chat routing;
- local ComfyUI readiness and generation MVP, with ComfyUI and workflows supplied by the user;
- explicit per-message API routing for configured providers;
- durable, user-and-workspace-scoped Memory Lock storage, API access, frontend helpers, and a minimal viewer/import surface;
- durable, user-and-workspace-scoped Proof Review storage and authenticated API access;
- Windows artifact, installer, integrity, and GitHub Release workflows.

Important remaining product work includes:

- a saved and resumable beginner question flow;
- structured Identity Idea records;
- Keep, Delete, and Try Another decisions;
- an explicit chat-to-saved-idea approval flow;
- a simple returning-user home screen;
- automatic setup and plain-language recovery;
- a Proof Review history surface;
- complete end-to-end beginner journey testing;
- signed desktop releases and automatic updates.

The Windows desktop build remains a beta. Builds are currently unsigned and do not auto-update.

See the [Local User Roadmap](docs/swarmsy/local-user/SWARMSY_LOCAL_USER_ROADMAP.md) and [MVP Known Gaps](docs/swarmsy/audits/SWARMSY_MVP_KNOWN_GAPS.md) for implementation detail. These planning documents may lag behind merged runtime work; this README defines the product mission and behavioural contract.

## Foundation and licence

SWARMSY is based on [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) by Mintplex Labs and retains the upstream MIT licence and attribution.

## Developer quick start

Requirements:

- Node.js 18 or newer
- Corepack/Yarn
- Ollama for the Local User chat path

```bash
git clone https://github.com/HODLKONG64/DIZ-A-REMIX.git
cd DIZ-A-REMIX
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn setup
yarn dev
```

`yarn dev` starts the server, frontend, and collector together. Use the individual `dev:server`, `dev:frontend`, and `dev:collector` scripts when debugging one service.

## Windows desktop beta

Validate the desktop foundation without installing Electron:

```bash
yarn desktop:smoke
```

`desktop:dev` is a contributor-only shell launcher. It requires a local Electron shim, which is intentionally not installed by the normal setup path. To test the shell with the Electron version used by the artifact workflow:

```bash
npm install --no-save --package-lock=false electron@33.4.11
yarn desktop:dev
```

Normal Windows testers should use the packaged artifact or installer instead of the contributor launcher.

Packaging and release guidance:

- [Desktop Beta Readiness](docs/swarmsy/local-user/SWARMSY_DESKTOP_BETA_READINESS.md)
- [Desktop Artifact Build](docs/swarmsy/local-user/SWARMSY_DESKTOP_ARTIFACT_BUILD.md)
- [Desktop Installer](docs/swarmsy/local-user/SWARMSY_DESKTOP_INSTALLER.md)

## Hosted deployment

Operators should use the existing Docker production path described in the [Hosted Deployment Runbook](docs/swarmsy/release/SWARMSY_HOSTED_DEPLOYMENT_RUNBOOK.md). Normal users should receive a hosted URL, not repository or terminal instructions.

## Repository

- Issues: https://github.com/HODLKONG64/DIZ-A-REMIX/issues
- Upstream foundation: https://github.com/Mintplex-Labs/anything-llm
