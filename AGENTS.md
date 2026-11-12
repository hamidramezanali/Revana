# Revana agent guidance

Start with `docs/AGENTIC_COACH.md`, `docs/PRODUCT_ROADMAP.md`, `docs/architecture.md` and `docs/agent-roadmap.md`.

## Current workspace (supersedes earlier layout guidance)

Read `docs/GOAL_WORKSPACE.md` first. The user explicitly requested a goal-oriented
Codex/VS Code-style workspace in place of staged intake. `frontend/src/GoalWorkspace.tsx`
is the primary UI; `backend/app/goal_workspace.py` owns streamed work execution.
Keep accepted plans visible during revisions. Persist a goal immediately, avoid repeated
intake questions, expose real execution status and preserve cancellation/CAS guarantees.
The earlier warm-layout and staged-flow descriptions below are historical context.
Initial planning now uses `assessment.py` and prompts/assessment.md, with explicit goal/
timeline capture, adaptive focused questions (at most six answered cards) and an early
build option. There is NO three-habit limit. Weekly programmes must include actual
scheduled sessions and criteria-based progression when training is relevant. Keep
collapsed cards compact while preserving complete detail behind Show more. Boundaries
on time, budget, unsupported clinical claims and unsafe weight targets still apply.


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


## Nutrition and methods discovery (2026-11-12)

Food-first preferences must drive assessment and planning. Keep recipes, meal prep,
portion guidance, substitutions and storage first-class alongside appropriate activity.
Numeric calorie prescriptions remain disabled; ingredient estimates are not daily
intake targets. Preserve BMI/unsafe-target safeguards and daily prep/activity budgets.
See GOAL_WORKSPACE.md for exact eligibility and validation limits.

`method_discovery.py` uses controlled generic topic/city queries, primary-domain evidence
and separately labeled public Bokadirekt listings. Never include answers/photos/metrics
in web queries, infer practitioner qualifications from listings, pretend searches ran,
or silently apply researched procedures. Preserve previous review state, accepted plans,
unique evidence IDs and run cancellation/revision checks. No scraping or booking.


## Visual body goals (2026-11-12)

Journey.body_goals stores explicit regional preferences, never measurements or clinical
inferences. Saving uses bearer ownership/revision checks, no model call, preserves
accepted history/assessment answers and invalidates older proposals/retry artifacts.
Keep the optional map keyboard-accessible with text alternatives and mobile controls.
All model stages receive these preferences through workflow.context_for. Do not infer
fat percentage, metabolism, physiology or calorie needs from a silhouette, promise
regional fat loss or silently replace an accepted plan. Measurements/progress trends
and silhouette variants are later scope. See GOAL_WORKSPACE.md.


## Performance boundaries (2026-11-12)

Read docs/PERFORMANCE.md for current measurements and caveats. Keep provider-only compact
formats separate from persisted/API plans: unique recipes expand losslessly; selected
edits and corrections merge in application code before full independent review. Never
trim clinical reports, fixed meal quantities/schedules or photo/answer provenance merely
to shrink prompts. Numeric diagnostics must not contain prompts, keys, answers, provider
text or private reasoning. Do not trade validation or cancellation/CAS for latency.
Use scripts/benchmark_workspace.py --live deliberately with synthetic data only; compare
successful operations and record provider variability instead of claiming an SLA from
one run. The model and fail-safe timeouts remain unchanged.
