# Revana

An interactive beauty and lifestyle agent. Revana asks up to six adaptive questions,
creates an overall personal plan, and proposes revisions based on later check-ins.
The existing React assessment, analysis and dashboard workflow is preserved.

The next release is planned as a mobile-first coach with an editable care profile,
a complete free starting plan, and paid progress tracking and plan updates. See the
[current product plan](docs/PRODUCT_ROADMAP.md) and its small implementation checkpoints.

**Current release: local development and temporary hosted testing.** The live agent requires backend
OpenAI configuration. See [the agent roadmap](docs/agent-roadmap.md) for implementation
status, setup, privacy behavior and the gates before a hosted beta.

```
frontend/    Vite + React web app
backend/     FastAPI service (Python), currently local-only
contracts/   openapi.json, generated from the backend; the source of truth for the API
docs/        Architecture and decisions
.figma/      Figma Make tooling (runs the frontend from the repo root)
```

## Run locally

Frontend (http://localhost:8443):

```bash
cd frontend
pnpm install
pnpm dev
```

Backend (http://localhost:8000, docs at /docs):

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# Set REVANA_OPENAI_API_KEY and REVANA_OPENAI_MODEL in .env.
uvicorn app.main:app --host 127.0.0.1 --reload
```

## Tests and checks

```bash
cd backend
ruff check . && ruff format --check .
pytest
```

## API contract

The backend owns the API contract in [contracts/openapi.json](contracts/openapi.json). After changing any
endpoint or model, regenerate it and commit the result:

```bash
cd backend
PYTHONPATH=. python scripts/export_openapi.py
PYTHONPATH=. python scripts/export_client_types.py     # PowerShell: $env:PYTHONPATH="."
```

CI and `pytest` fail if the committed file is out of date.

## Vercel deployment

The root `vercel.json` defines one Services project with a Vite frontend and FastAPI
backend. Import the repository root, select Services, and use `main` for Production.
Set server-side `REVANA_OPENAI_API_KEY`, `REVANA_OPENAI_MODEL` and Neon’s `DATABASE_URL`,
then redeploy. The backend automatically uses durable Postgres on Vercel; no SQLite
fallback is allowed there. Local development can still use SQLite.

Temporary public testing without account sign-in is approved. Keep each journey’s
browser token private; account authentication and deployment privacy are deferred.
See [the setup guide](docs/VERCEL_DEPLOYMENT.md) for Neon, migration and runtime checks.
Never upload this computer’s `.env`, local database or real profiles to GitHub.
