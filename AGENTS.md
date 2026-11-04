# Revana agent guidance

Start with `docs/architecture.md` and `docs/agent-roadmap.md`.

## Product goal

Revana is an interactive beauty and lifestyle agent. Keep the current visual direction
and direction -> goals -> understanding -> fit/safety -> analysis -> plan workflow.
Questions must adapt to every previous answer; the backend allows at most six initial
adaptive questions and three follow-up questions per check-in. Users may skip or finish
early. Separate explicit user reports, hypotheses and unknowns. Plan revisions require
user acceptance and preserve accepted history.

## Repository

- `frontend/`: React 19, TypeScript, Vite, Tailwind v4. Entry: `src/App.tsx`.
- `frontend/src/Agent.tsx`: agent API client, adaptive questions, analysis/dashboard.
- `backend/`: Python 3.12+, FastAPI. Entry: `app/main.py`.
- `contracts/openapi.json`: generated API contract.
- `frontend/src/api.generated.ts`: generated serialized response model types.
- `.figma/`: design tooling. Do not assume a dev server is already running.

## Privacy and scope

Single-user local implementation first. Keep API keys server-side. Journey answers can
be health-adjacent: never log their contents, raw request bodies or provider responses.
Local SQLite is not production storage; do not deploy it to ephemeral Vercel disks.
Do not bypass the hosted authorization/storage gate to make deployment appear ready.
No diagnoses, prescriptions or unsupported efficacy claims. Prompt rules do not prove
clinical safety. Tests must use synthetic data and fake providers, never real user data.
Live OpenAI calls require configured credentials and deliberate validation; never send
repository contents or existing private records as an unsolicited smoke test.

## Development and validation

Run the API from `backend/`: `.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1`.
Run the frontend from `frontend/`: `pnpm dev` (8443), proxied to the API on port 8000.
Use `REVANA_OPENAI_API_KEY` and `REVANA_OPENAI_MODEL` only in backend environment config.

Backend: `ruff check .`, `ruff format --check .`, `pytest`.
Frontend: `pnpm exec tsc --noEmit`, `pnpm build`.
After API changes, from `backend/` with `PYTHONPATH=.`:
`python scripts/export_openapi.py` and `python scripts/export_client_types.py`.

Keep changes reviewable, update documentation when behavior changes, and report
unverified live-provider/browser behavior honestly. Preserve unrelated user changes.
