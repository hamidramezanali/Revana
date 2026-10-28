# Revana

A personalized beauty and lifestyle planning product.

```
frontend/    Vite + React web app
backend/     FastAPI service (Python), deployed to Vercel
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
uvicorn app.main:app --reload
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
PYTHONPATH=. python scripts/export_openapi.py     # PowerShell: $env:PYTHONPATH="."
```

CI and `pytest` fail if the committed file is out of date.

## Deployment (Vercel)

Create two Vercel projects from this repository:

| Project  | Root directory | Notes |
|----------|----------------|-------|
| frontend | `frontend`     | Vite is detected automatically |
| backend  | `backend`      | FastAPI is detected from `app/main.py` |

Set `REVANA_CORS_ORIGINS` on the backend project to a JSON list containing the frontend's URL.
Secrets (database, Auth0, OpenAI) are only ever set as backend environment variables.
