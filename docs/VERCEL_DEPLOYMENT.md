# Vercel Services deployment configuration

Revana declares one Vercel project with two services in the root `vercel.json`.
This replaces the earlier plan to create separate frontend/backend projects.
It configures routing and builds; it does not enable the hosted coaching runtime.

## Repository and Vercel settings

- Import `hamidramezanali/Revana` through the GitHub integration.
- Use the branch containing this configuration and the latest application changes.
  Do not assume `main` contains unmerged feature branches.
- Set the project Root Directory to the repository root (`.`), not `frontend` or
  `backend`. Enable including files outside service roots if Vercel exposes that
  setting: Vite imports the tracked `.figma/make/site.json` from the repository root.
- Set Framework Preset to **Services**. The root configuration also declares it.
- Leave project-wide build/install/output overrides unset; the frontend service
  declares its frozen pnpm install, build script and `dist` output directory.
- Keep Node.js aligned with CI (22.x). Vercel detects pnpm from the committed lockfile.
- The backend uses its `pyproject.toml` dependencies, including the image decoder.
  `[tool.vercel].entrypoint = "app.main:app"` explicitly selects the FastAPI app.
- Configure deployment protection for every URL you intend to share. Verify that
  a signed-out request cannot access either the frontend or backend. `robots.txt`
  is not access control. Only grant the intended collaborators access.

## Routing

| Request | Service | Path seen by the application |
| --- | --- | --- |
| `/v1` | backend | `/v1` (backend decides its response) |
| `/v1/health` | backend | `/v1/health` |
| `/v1/agent/status` | backend | `/v1/agent/status` |
| `/v1/agent/answers` | backend | `/v1/agent/answers` |
| `/`, `/assets/...`, `/#/dashboard/today` | frontend | Original path; hash stays in browser |

API rewrites precede the frontend catch-all. Service routing preserves the request
path: the application uses `/v1`, not `/api`, so no prefix transformation is needed.
Frontend requests stay same-origin; no public backend URL or browser API key is needed.
The existing Vite proxy remains the separate local-development path.

## Current runtime gate — resolve before attempting live deployment

`backend/app/main.py` intentionally refuses Vercel startup and non-development mode.
That guard remains unchanged. **A live multi-service deployment is still blocked**:
this configuration must not be presented as a working hosted agent.

Do not remove the guard or point SQLite at `/tmp` to get a green deployment. Complete
these runtime changes before enabling hosted execution:

1. Durable hosted storage and migrations instead of local SQLite.
2. Tested private access and per-resource authorization, including direct API requests;
   two collaborators must not accidentally share or overwrite a profile.
3. Explicit hosted host/origin handling that replaces the loopback-only boundary.
4. Request/spending limits and privacy/retention operations appropriate to test data.
5. Vercel-compatible photo limits: Functions accept at most 4.5 MB per request, while
   three maximum-size base64 photos can exceed this. Lower the aggregate image budget
   or implement another authenticated, temporary transport before hosted photo testing.

Keep `REVANA_OPENAI_API_KEY` and `REVANA_OPENAI_MODEL` server-side. Do not copy the
local `.env`, SQLite database, real profiles or photos into GitHub or deployment files.
A key alone does not satisfy the hosted readiness gate.

## Validation and remaining external checks

Validate the JSON against the current published Vercel schema, build the frontend,
and run backend checks. These establish configuration/build compatibility locally;
they do not prove a successful Vercel build, deployment protection or durable storage.
A linked Vercel deployment and signed-out access tests remain external release checks.

Official references:

- [Services setup](https://vercel.com/kb/guide/vercel-services)
- [Service routing and path preservation](https://vercel.com/docs/services/routing)
- [FastAPI entrypoint](https://vercel.com/docs/frameworks/backend/fastapi)
- [Function payload limits](https://vercel.com/docs/functions/limitations#request-body-size)
- [Deployment protection](https://vercel.com/docs/deployment-protection)
