# Vercel Services setup

## Current scope

Temporary public testing was explicitly approved on 2026-11-05, without account sign-in.
OpenAI keys and database credentials remain server-side. Journeys have separate random
bearer capabilities, stored hashed in Postgres; users cannot list journeys. Deployment
privacy and account authentication are deferred at the user’s request. This is testing
scope, not a production-readiness claim.

## Vercel project

Use `hamidramezanali/Revana`, Production Branch `main`, Root Directory `.`, Framework
Preset **Services** in the dashboard. Do not put a top-level `framework` in vercel.json.
The root config declares Vite and FastAPI services. The frontend uses a frozen pnpm
install and builds to `dist`. Node 22.x matches CI. FastAPI’s explicit entrypoint is
`app.main:app`. Source files above the frontend root include `.figma/make/site.json`.

Ordered rewrites route `/v1` and `/v1/...` to the backend with the original path;
everything else goes to the frontend. Browser API calls stay same-origin. Vite’s proxy
is for local development only. No frontend API URL or `VITE_` secret is needed.

## Required environment variables

| Name | Value/source |
| --- | --- |
| `REVANA_OPENAI_API_KEY` | Secret OpenAI API key |
| `REVANA_OPENAI_MODEL` | `gpt-6.1-terra` (current selected model) |
| `DATABASE_URL` | Neon’s pooled Postgres URL, installed by the Vercel integration |

Alternatively, `REVANA_DATABASE_URL` or `POSTGRES_URL` is accepted, in that precedence
before `DATABASE_URL`. Avoid stale duplicate database variables. Keep them Secret/sensitive.
`VERCEL` automatically selects hosted mode, so a development environment value cannot
accidentally force SQLite in the hosted function. Without a Postgres URL the service
starts but returns a clear 503 setup error, rather than writing profiles to `/tmp`.

1. Vercel project `revana-5pgq` → Storage → Neon; choose an EU region where possible.
2. Connect the database to this project and its Production environment. Prefer a
   separate database branch for future Preview deployments so testing is isolated.
3. Verify the project has the three variables above; do not paste secrets in chat.
4. Redeploy the latest `main` commit after saving the environment variables.
5. Check `/v1/health` (process health) and `/v1/agent/status` (database and model setup).
6. Run a synthetic assessment and confirm it resumes after a reload, generates a plan,
   keeps suggestions, and deletes/restarts independently of a second browser session.

## Storage and migration

The packaged `app/migrations/001_journeys.sql` creates `revana_journeys` on the first
connection. The backend role needs table-creation permission for this initial migration.
An advisory transaction lock handles concurrent cold starts. Values stay parameterized;
updates use compare-and-swap revision checks. Failed writes/generation do not replace
saved plans. Remote connections use TLS; prepared statements are disabled for pooled
serverless connections. The connection closes after each transaction.

A missing URL produces an actionable setup error. A connection/permission failure
produces a generic storage-unavailable response without echoing credentials or records.
Local development still supports SQLite when no Postgres URL is set. Existing local
profiles are not automatically uploaded or migrated to Neon. Exports contain personal
information and should stay private. Raw questionnaire photos are not stored; reviewed
notes and existing raw answer events are retained under the current application model.

## OpenAI environment import

The root `.env.example` is a template with no key. From this computer’s repository root:

```powershell
.\backend\.venv\Scripts\python.exe backend/scripts/export_vercel_env.py
```

This prepares ignored `.env.vercel.local` with the existing OpenAI key/model only.
Import it using Vercel Project Settings → Environment Variables. It does not include
or configure the database. Never commit real `.env` files, add `VITE_` to secret names,
or expose credentials using Vite define/envPrefix. The export helper uploads nothing.

## Requests and limits

Hosted mode accepts same-origin requests, explicitly configured CORS origins and the
Vercel deployment/production URLs. Unrelated browser origins are rejected. Requests
without Origin can still access the approved public API. Local mode keeps its loopback
host/client checks. CORS is not account authentication.

Photo source images are capped at 900 KB, with a 4 MB aggregate request cap, below
Vercel Functions’ 4.5 MB payload limit. The browser re-encodes/resizes photos to match.
No external image URLs or original metadata are forwarded. Reviewed notes are confirmed
before subsequent coaching. OpenAI and database limits/errors remain visible to users.

## Validation

The local and hosted synthetic workflows are tested against real isolated PostgreSQL
and local SQLite, using fake OpenAI responses. These do not validate clinical guidance
or a real phone’s camera. Actual Neon access and deployment status must be checked
after Vercel redeploys; a green build alone is not runtime verification.

References: [Services](https://vercel.com/kb/guide/vercel-services),
[routing](https://vercel.com/docs/services/routing),
[FastAPI](https://vercel.com/docs/frameworks/backend/fastapi),
[payload limits](https://vercel.com/docs/functions/limitations#request-body-size),
[deployment protection for later](https://vercel.com/docs/deployment-protection).
