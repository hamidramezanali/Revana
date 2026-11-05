# Revana agent guidance

Start with `docs/PRODUCT_ROADMAP.md`, `docs/architecture.md` and `docs/agent-roadmap.md`.

## Product goal

Revana is an interactive beauty and lifestyle agent. Keep the current visual direction
and direction -> goals -> understanding -> fit/safety -> analysis -> plan workflow.
Questions must adapt to every previous answer; the backend allows at most six initial
adaptive questions and three follow-up questions per check-in. Users may skip or finish
early. Separate explicit user reports, hypotheses and unknowns. Plan revisions require
user acceptance and preserve accepted history.

## Agreed next release (planned)

The current code is the local baseline, not the finished hosted product. Build a
mobile-first text coach around an editable care profile and a complete free initial
plan. Paid access enables structured progress, follow-up and plan revisions. Preserve
the mobile UI merged into main; do not replace a useful plan with teaser ideas.

Future durable memory holds confirmed facts, labeled hypotheses, concise validated
notes, accepted plans and eligible structured outcomes. Conversation text is temporary;
removing history UI alone is insufficient. Do not claim raw data is removed before
conversion, cleanup and retention tests pass. Evidence-backed claims require traceable
reviewed sources. A capable model or stronger prompt alone does not establish quality.

The separate product-role instruction file is planned at
`backend/app/prompts/coach.md`; this AGENTS.md remains developer guidance.
Sweden/Scandinavia first; keep locale/country/timezone/currency/units separate. English
is acceptable initially. Voice and photos are later scope.

## Repository

- `frontend/`: React 19, TypeScript, Vite, Tailwind v4. Entry: `src/App.tsx`.
- `frontend/src/Agent.tsx`: agent API client, adaptive questions, analysis/dashboard.
- `backend/`: Python 3.12+, FastAPI. Entry: `app/main.py`.
- `contracts/openapi.json`: generated API contract.
- `frontend/src/api.generated.ts`: generated serialized response model types.
- `.figma/`: design tooling. Do not assume a dev server is already running.

## Privacy and scope

The current runtime is single-user local. Hosted identity/storage and billing are
planned before public launch; retain the local deployment boundary until tested.
Keep API keys server-side. Journey answers can
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

Frontend: preserve responsive and reduced-motion behavior, visible keyboard focus, and
accessible labels. Suggested actions never count as user-reported completion.

## Delivery checkpoints

Implement the slices in `docs/agent-roadmap.md`. Keep commits focused and push each
completed, validated checkpoint to GitHub instead of batching unrelated work. Start
feature branches from updated main. A push does not authorize merging or deploying.
Update current-state documentation as each slice lands, and distinguish synthetic
validation from live-provider recommendation quality.
