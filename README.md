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

## Hosted deployment (planned; currently blocked)

Do not deploy the current local agent to Vercel. It intentionally refuses Vercel startup.
Complete the authorization, durable database, privacy and operational gates in the
[roadmap](docs/agent-roadmap.md) first. The intended future layout is:

| Project  | Root directory | Notes |
|----------|----------------|-------|
| frontend | `frontend`     | Vite is detected automatically |
| backend  | `backend`      | FastAPI is detected from `app/main.py` |

Set `REVANA_CORS_ORIGINS` on the backend project to a JSON list containing the frontend's URL.
Secrets (database, Auth0, OpenAI) are only ever set as backend environment variables.
