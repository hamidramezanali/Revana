# Revana agent guidance

Start with `docs/PRODUCT_ROADMAP.md`, `docs/architecture.md` and `docs/agent-roadmap.md`.

## Product goal

Revana is an interactive beauty and lifestyle agent. Keep the current visual direction
and direction -> goals -> understanding -> fit/safety -> analysis -> plan workflow.
The latest message drives the next response, with earlier context and safety constraints
preserved. Questions adapt to every answer without a fixed cycle or option count. Users
may skip or finish whenever ready. Separate explicit user reports, hypotheses and
unknowns. Plan revisions require user acceptance and preserve accepted history.

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

The product-role instructions now live in `backend/app/prompts/coach.md`, loaded and
packaged by the backend; this AGENTS.md remains developer guidance. New adaptive
questions offer as many relevant choices as needed, with suitable single/multiple selection
and optional text. Coach responses may explain, ask a question, or offer action alternatives.
Provide concise public rationale, never private chain-of-thought.
Only selected choices and typed answers are reports; suggestions are not profile facts.
Sweden/Scandinavia first; keep locale/country/timezone/currency/units separate. English
is acceptable initially. Voice is later scope. Relevant questionnaire photos are now
optional: process temporarily, strip metadata, and require review of visual notes before
continuing. Never persist raw images or confuse photo observations with user reports.

## Repository

- `frontend/`: React 19, TypeScript, Vite, Tailwind v4. Entry: `src/App.tsx`.
- `frontend/src/Agent.tsx`: agent API client, adaptive questions, analysis/dashboard.
- `backend/`: Python 3.12+, FastAPI. Entry: `app/main.py`.
- `contracts/openapi.json`: generated API contract.
- `frontend/src/api.generated.ts`: generated serialized response model types.
- `.figma/`: design tooling. Do not assume a dev server is already running.

## Privacy and scope

The user explicitly approved temporary public Vercel testing without account sign-in
on 2026-11-05, after acknowledging public API usage and OpenAI budget exposure.
Hosted journeys require durable Postgres and retain separate bearer capabilities.
Account authentication, deployment privacy and billing remain future work. Preserve
the loopback boundary for local development and keep all credentials server-side.
Keep API keys server-side. Journey answers can
be health-adjacent: never log their contents, raw request bodies or provider responses.
Local SQLite is not production storage; do not deploy it to ephemeral Vercel disks.
Do not silently replace durable hosted storage with ephemeral SQLite. Do not claim
account authentication or production readiness for the approved temporary public test.
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

Action preferences are distinct from completion. Keep actions unchanged in application
code during revisions, not merely through a model instruction. Reject invalid
replacement sources and protect proposed updates with revision checks. Today and My
plan share the readable action-card components.

## Delivery checkpoints

Implement the slices in `docs/agent-roadmap.md`. Keep commits focused and push each
completed, validated checkpoint to GitHub instead of batching unrelated work. Start
feature branches from updated main. A push does not authorize merging or deploying.
Update current-state documentation as each slice lands, and distinguish synthetic
validation from live-provider recommendation quality.
