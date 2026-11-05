# Revana

An interactive beauty and lifestyle agent. Revana asks up to six adaptive questions,
creates an overall personal plan, and proposes revisions based on later check-ins.
The existing React assessment, analysis and dashboard workflow is preserved.

The next release is planned as a mobile-first coach with an editable care profile,
a complete free starting plan, and paid progress tracking and plan updates. See the
[current product plan](docs/PRODUCT_ROADMAP.md) and its small implementation checkpoints.

**Current release: single-user local development.** The live agent requires backend
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

## Vercel deployment configuration (runtime still gated)

The root `vercel.json` defines **one Services project** containing the Vite frontend
and FastAPI backend. `/v1` API requests route to the backend; other paths route to
the frontend. Import the repository root, with the **Services** framework preset.
See [the Vercel setup guide](docs/VERCEL_DEPLOYMENT.md) for GitHub connection settings,
entrypoints, private access and validation.

The current local agent intentionally refuses Vercel startup. Routing configuration
does not remove that restriction: durable hosted storage, private access/authorization,
hosted request handling and upload limits must be completed before a live deployment.
Keep OpenAI credentials server-side. Never upload the local database or `.env`.
