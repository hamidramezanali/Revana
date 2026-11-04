# Revana: adaptive beauty agent

Updated 2026-11-04. Product direction: retain the existing cream/forest visual design
and direction -> goals -> understanding -> fit/safety -> analysis -> plan workflow.
Revana is an interactive agent, not a static questionnaire or a one-off plan generator.

## Product rules

- Keep all five goal areas: face/skin, hair, body/fitness, energy/lifestyle, custom.
- Ask **one LLM-generated question per turn**, conditioned on all recorded answers.
- Ask **at most six adaptive assessment questions**, with early completion and skip.
  Direction, goal selection and fit/safety controls are separate explicit setup steps.
- Generate a whole plan from the actual answers and preferences; never infer facts
  from prefilled example routines. Clearly separate reports, hypotheses and unknowns.
- Check-ins use the current plan and history, ask at most three follow-up questions,
  and propose a new version. Users accept changes before the current plan changes.
- Single-user local version first. Cloud accounts and multi-user hosting are later.
- No diagnoses, prescriptions, supplement regimens or invasive procedure instructions.
  Prompt rules are an initial boundary, not a clinically validated safety system.

## Milestone 1: working local agent loop (implemented)

- Versioned `/v1/agent` API, structured server-side OpenAI Responses adapter.
- Explicit adult/cloud-processing consent before the first LLM request.
- Server-enforced question budgets, answer IDs, optimistic concurrency and input bounds.
- Durable SQLite journeys; token hashes in storage, bearer token in this browser.
- Saved answers, accepted plan history, action completion by plan version, proposed
  changes, resume, export, deletion.
- Existing visual workflow connected to live question/plan generation and check-ins.
- Provider failure leaves saved data unchanged and surfaces a retryable error;
  no preset responses presented as AI. No configured key/model means unavailable.
- Automated fake-provider coverage of orchestration and privacy boundaries.

Acceptance: the complete flow passes automated checks locally. Live-model quality and
browser visual validation are separate checks; do not describe fake-provider tests as
proof of real recommendations or clinical safety.

## Milestone 2: guidance quality and interaction validation

1. Build synthetic evaluation profiles across all five areas, including skipped answers,
   ambiguous goals, budget constraints, reactions, conflicting instructions and updates.
2. Assess question relevance, redundancy, early stopping, plan grounding and consistency.
3. Add a reviewed guidance library and verifiable source attribution. Do not let the
   model fabricate citations, confidence scores or efficacy promises.
4. Establish reviewed escalation rules and adversarial tests for safety-sensitive cases.
5. Validate live provider refusals, model availability, latency, cost and malformed outputs.
6. Browser-test onboarding, resume, provider failure, check-in and plan acceptance on
   desktop/mobile; improve accessibility based on those results.

Acceptance: documented quality thresholds pass on representative profiles and a human
review confirms useful plans and appropriate boundaries. No public beta before this gate.

## Milestone 3: dependable ongoing use

- Expand action completion into dated outcome observations and adherence history.
- Editable profile and preferences through explicit new versions.
- Richer coach conversation and check-ins without always requiring a plan revision.
- User-controlled reminders and review scheduling; no notifications without opt-in.
- Discard proposals explicitly, compare complete versions and recover interrupted drafts.
- Database schema migrations, retention settings, encrypted storage strategy, backup and
  restore tests; evaluate deletion in backups and OS snapshots.
- Longer-journey context management with provenance, before removing current size limits.

Acceptance: several review cycles preserve history and adapt the plan to actual outcomes.

## Milestone 4: hosted private beta

- Managed EU Postgres and migrations; do not use local SQLite on ephemeral Vercel disks.
- Auth0 login, validated bearer tokens, user provisioning, per-resource ownership tests.
- Replace local capability access with account authorization and recovery/revocation.
- Consent versioning, privacy notice, export/deletion across hosted storage and vendors.
- Server-side rate limiting, spending budgets, privacy-safe monitoring, recovery runbooks.
- Restore the intended two-project Vercel deployment only after these gates pass.

Acceptance: cross-account isolation, deployment, deletion, recovery and load checks pass.

## Milestone 5: expansion driven by usage

Optional photo assessment requires separate consent, secure file handling and its own
evaluation. Native mobile, professional-service discovery, integrations and monetization
follow demonstrated repeat use. None is required to validate the adaptive agent loop.

## Running the local implementation

Backend, from `backend/` (Python 3.12+):

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"
Copy-Item .env.example .env
# Set REVANA_OPENAI_API_KEY and REVANA_OPENAI_MODEL in .env, never in frontend variables.
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Choose a model available to your OpenAI project supporting strict JSON-schema Responses
outputs. The model name is deliberately configured rather than silently substituted.
The adapter uses `store: false`; this is not a promise of zero provider retention.
See [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Frontend, from `frontend/`: `pnpm install`, then `pnpm dev`. Open
`http://127.0.0.1:8443` (or `http://localhost:8443`). Vite proxies `/v1` to the backend.
The Figma host override remains available for design tooling; production deployment
is intentionally blocked until hosted authorization and storage are implemented.

Set `REVANA_CORS_ORIGINS` to include the exact browser origin if changed. Keep the
backend bound to loopback. Agent responses are not cached. Never enable body logging
or ship real assessment data in fixtures.

### Data behavior and limits

`backend/data/revana.sqlite3` stores answers and plans locally, unencrypted. Protect this
computer/account and backups accordingly. This is single-user development storage,
not a production health-data platform. The browser stores only its journey capability;
anyone with that token can access that journey on this backend. Do not share it. Losing
the browser token loses UI access; it does not delete the database row. Clearing browser
storage is not deletion. Use Delete journey before clearing browser storage.

Delete removes the active row with SQLite secure-delete enabled. Exports, backups,
filesystem snapshots and provider-side retention are separate and cannot be erased by
this action. Journeys currently allow up to 25 accepted plans and about 100 events to
bound model context and local storage. Export and begin a new journey when full.

Question/plan generation sends the selected goals, answers, preferences and saved plan
context to OpenAI. API keys never enter browser responses. All non-2xx API responses use
the repository error envelope without submitted values or upstream response bodies.
