# Revana agent guidance

Start with `docs/AGENTIC_COACH.md`, `docs/PRODUCT_ROADMAP.md`, `docs/architecture.md` and `docs/agent-roadmap.md`.

## Current workspace (supersedes earlier layout guidance)

Read `docs/GOAL_WORKSPACE.md` first. The user explicitly requested a goal-oriented
Codex/VS Code-style workspace in place of staged intake. `frontend/src/GoalWorkspace.tsx`
is the primary UI; `backend/app/goal_workspace.py` owns streamed work execution.
Keep accepted plans visible during revisions. Persist a goal immediately, avoid repeated
intake questions, expose real execution status and preserve cancellation/CAS guarantees.
The earlier warm-layout and staged-flow descriptions below are historical context.

## Product goal

Revana is an interactive beauty and lifestyle agent. Keep the warm visual direction and focus -> understanding -> profile review -> plan workflow.
The active workspace is Today, My plan, Coach and Profile. New goals are skin, hair
and weight/body habits; other lifestyle factors are supporting context.
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
packaged by the backend; this AGENTS.md remains developer guidance. Coaching
requests use `workflow.py` and separate common/coach/planner/reviewer/researcher prompts.
Stages must remain wired to actual context and provider requests; prompt files alone
are not an implementation. Preserve sourced profile corrections and action-review ID
links. Missing checks mean needs-review, not compatible. See docs/STAGED_COACH_WORKFLOW.md.
Questions offer as many relevant choices as needed, with suitable single/multiple selection
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

## Agentic workflow update (2026-11-11)

`app/coaching_graph.py` now runs bounded LangGraph graphs using the existing journey
store at turn boundaries; external tracing is explicitly disabled. Keep six assessment
questions and three follow-up questions, optional typed inputs, application-controlled
budgets, proposals and revision checks. Do not restore unlimited-question behavior.
`app/data/foods.json` is a limited attributed public snapshot; never invent missing
nutrients or treat it as a complete allergen database. Milestones are review points,
not validated personal predictions. See AGENTIC_COACH.md for current privacy limits.
