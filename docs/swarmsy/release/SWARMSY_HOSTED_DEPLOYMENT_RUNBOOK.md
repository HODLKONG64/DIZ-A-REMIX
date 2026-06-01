# SWARMSY Hosted Deployment Runbook

## Purpose

Deploy SWARMSY once as a hosted web app so normal users only open a URL, log in, complete SWARMSY HIVE onboarding, and use SPARKY.

Developer commands are for operators/contributors only.
Normal users only use the hosted URL.

## Recommended hosted deployment path (safest existing repo path)

Use the existing containerized production path in this repository:

- `docker/Dockerfile`
- `docker/docker-compose.yml`
- `docker/.env.example`

This path keeps frontend + server + collector managed together in one hosted service and is the most direct supported production route in-repo.

## Operator deployment steps

1. Provision a Linux host and DNS name (example: `swarmsy.your-domain.com`).
2. Put TLS in front of the app using your reverse proxy/load balancer so users get HTTPS.
3. In `/docker`, copy `.env.example` to `.env` and set production values.
4. Start/update the hosted app from the repo root with Docker Compose:
   - `docker compose -f docker/docker-compose.yml up -d --build`
5. Keep `server/storage` and collector folders persistent (already mapped by compose).
6. After start, complete initial admin setup in browser and create operator/admin access.

## URL shared with normal users

Share only the hosted HTTPS URL, for example:

- `https://swarmsy.your-domain.com`

Do not send users local URLs, repo links, or terminal instructions.

## Required environment variables

Set these in `docker/.env` (or equivalent host environment):

- `STORAGE_DIR` (persistent absolute path)
- `JWT_SECRET`
- `SIG_KEY`
- `SIG_SALT`
- `LLM_PROVIDER` + provider credentials/model settings
- `EMBEDDING_ENGINE` + required embedding credentials/model settings
- `AUTH_TOKEN` (required if exposing the app remotely without SSO)

SWARMSY-specific requirement:

- `SWARMSY_DOCTRINE_DOCS_ROOT` when doctrine docs are not accessible from the default repo-root path on the host.

Common production hardening settings (recommended):

- `DISABLE_SWAGGER_DOCS="true"`
- `ENABLE_HTTPS="true"` (if terminating TLS in-app instead of reverse proxy)

## Service verification (operator)

1. **Container/process health**
   - `docker compose -f docker/docker-compose.yml ps`
   - Confirm service is `Up` and healthy.
2. **Server API health**
   - `curl -i https://swarmsy.your-domain.com/api/ping`
   - Expect `200`.
3. **Frontend availability**
   - Open hosted URL and confirm login page renders.
4. **Collector availability**
   - Review container logs for collector startup and no crash loop.
   - Confirm doctrine ingest succeeds during onboarding (see onboarding verification below).

## Verify login works

1. Open hosted URL in browser.
2. Sign in with a normal user account (not operator account).
3. Confirm app lands on SWARMSY home/onboarding surface.
4. Sign out and sign back in to confirm session reliability.

## Verify SWARMSY onboarding works

Use a normal user account and confirm this sequence:

1. Create SWARMSY HIVE.
2. Load Required Doctrine Docs.
3. Check HIVE readiness reports ready state.
4. Start Intake opens chat handoff to SPARKY.
5. Load Memory Lock / Continue from Memory Lock sends continuation handoff.
6. Campaign Calendar action creates campaign-day handoff.
7. Review Proof sends proof-review handoff.

If doctrine loading fails with collector-offline behavior, treat as deployment issue and restore collector availability before user launch.

## Normal-user test path

Run browser-only acceptance using:

- `docs/swarmsy/release/SWARMSY_PUBLIC_USER_TEST_CHECKLIST.md`

Normal users must never be asked to run Git, CMD, Yarn, Docker, or any developer command.
