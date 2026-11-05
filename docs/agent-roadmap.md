# Revana implementation roadmap

Updated 2026-11-05. Product definition: [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md).
Base implementation: `main`, including the merged mobile UI and local adaptive agent.
This update changes the delivery plan; it does not implement the new behavior below.

## Current baseline

- React/TypeScript mobile-responsive UI and FastAPI `/v1/agent` API in one repository.
- One generated question per turn; caps of six assessment and three check-in questions.
- Server-side structured provider adapter, bounded inputs and revision conflict checks.
- Durable local SQLite journeys, accepted plan history, proposals and action completion.
- Fit/safety preferences and limitations reach the provider; accepted plan summary and
  expandable details are integrated with check-ins. Suggested actions are not completions.
- Export/delete and browser resume exist. API/client contracts are generated and checked.
- The current code still saves raw answer events, sends journey context to the provider,
  has no hosted user accounts and no payment gates. Coaching instructions now live in
  `backend/app/prompts/coach.md` and are packaged with the backend.
  Historical answers can be displayed/exported. Removing those paths is upcoming work.
- Live clinical recommendation quality is not established by synthetic integration tests.
  Public hosting remains blocked pending authorization, storage and operational gates.

## Selectable-question backend checkpoint (2026-11-05)

The question contract now supports 3-6 generated options, appropriate single/multiple
selection, exclusive answers, optional additional text and explicit skips. The backend
validates choices against the active question and passes chosen labels plus text to
subsequent questions and the single overall plan. Unselected suggestions are excluded
from model context. Legacy saved text-only questions remain readable and answerable.
The six-question cap is a ceiling; the agent can finish early. The mobile UI now
shows native single/multiple-choice controls before an optional short text box. Each
new question clears the previous draft; failed requests preserve it for retry.
Question rationale is expandable to keep the primary screen concise. Existing active
text-only questions offer “Show suggested answers” to add choices without restarting
the assessment, changing its question or consuming the question budget. This does not implement profile consolidation, payment or
reviewed evidence retrieval.

## Action-preference backend checkpoint (2026-11-05)

Action choices are saved per accepted plan version and are separate from completion.
Keep, Not for me and clear choices do not trigger LLM requests. A refresh includes the
original problem, all answers, preferences and an optional message. The model returns
replacements with editable source IDs; the server inserts kept actions unchanged and
rejects invalid sources or exact repeats of rejected actions. This also applies to
check-in plan updates when action preferences exist. Semantic equivalence of differently
worded unwanted suggestions still requires model-quality evaluation.

Refresh creates a proposal, leaving the accepted plan unchanged until acceptance.
Kept choices carry into the accepted version. Changing preferences invalidates older
proposals; proposals can also be explicitly discarded. Revision checks protect races.
The mobile cards now show a prominent title, compact badges, Keep it/Not for me
controls and collapsed details. Today and My plan share these cards. An optional
message and Refresh my plan button create a reviewable proposal; keeping an action
is distinct from marking it completed. The accepted plan stays active until acceptance.

## Target release

Mobile-first text discovery builds an editable care profile and a complete free plan.
Persistent memory consists of confirmed facts, concise validated notes, accepted plans
and eligible structured outcomes. Older chat is not a product destination and raw text
does not become permanent memory. Paid access enables progress, follow-up and updates.
Sweden/Scandinavia first, with global language and regional foundations.

## Checkpoints and acceptance gates

| Slice | Deliverable and acceptance | Commit/push boundary |
|---|---|---|
| 0. Plan | Align product, implementation, architecture and agent guidance; distinguish runtime from target | Documentation-only checkpoint |
| 1. Coaching instructions | Add versioned `backend/app/prompts/coach.md`, task templates and instruction-loading tests; initially preserve working provider contract | Prompt foundation |
| 2. Profile and context | Define typed facts, concerns, provenance, confirmation, hypotheses, notes and outcomes; add explicit context builder and token budget; regenerate contracts | Profile/context foundation |
| 3. Temporary conversations | Implement bounded temporary turns, candidate extraction, confirmation, revision-safe consolidation, expiry and legacy conversion; remove durable transcript UI/export paths | Memory lifecycle, split migration if needed |
| 4. Recommendation quality | Add reviewed evidence registry, retrieval, citation/applicability validation and evaluation cases; choose a high-capability model using measured results | Evidence foundation, then separate model/evaluation checkpoint |
| 5. Mobile free-plan journey | Adapt existing UI to text-first discovery, six-question ceiling, compact profile review, full plan, expandable evidence and explicit free/paid affordances | Discovery/profile UI, then separate plan UI checkpoint |
| 6. Hosted identity/storage | Add durable Postgres/migrations, secure guest sessions, email verification/recovery, guest linking and per-resource ownership; keep public hosting blocked until tested | Database foundation, then identity/authorization checkpoint |
| 7. Paid follow-up domain | Add dated structured outcomes, check-in context and accepted plan updates; define server-enforced capability rules and test with synthetic entitlement states | Follow-up/progress checkpoint |
| 8. Billing | Select provider, price and limits; add checkout, verified/idempotent webhooks, entitlements, cancellation and recovery flows; default-deny paid writes | Billing backend, then subscription UI checkpoint |
| 9. Beta readiness | Validate recommendation quality, phone usability, isolation, retention/deletion, recovery, billing lifecycle, cost limits and privacy-safe monitoring | Release-readiness checkpoint |

Dependencies: profile/context precedes memory consolidation; evidence validation precedes
claiming evidence-backed plans. Hosted identity and durable storage precede live billing.
Paid capabilities may be developed with synthetic entitlements locally but are not
released before verified billing and ownership controls exist. No public beta before
all relevant quality, authorization, privacy and operations gates pass.

## Validation for each slice

- Run relevant backend lint/format/tests and frontend type/build checks when changed.
  Regenerate and verify API/client contracts after model or endpoint changes.
- Profile/memory: preserve uncertainty and user corrections, separate generated content
  from reports, reject stale writes, test expiry, extraction failure and legacy conversion.
- Provider: test task/context selection, sensitive-field exclusion, question budgets,
  refusal/malformed outputs, incomplete streams, retries and privacy-safe failures.
- Evidence: validate sources exist and support the claim/context; evaluate irrelevant
  generic advice, contraindications, conflicting answers and unsupported novelty.
- Phone UI: assess 360px and 390px widths, keyboard-open composer, long text, streaming,
  interrupted sessions, reload, loading/error states, accessibility and reduced motion.
- Identity/billing: verify guest linking and recovery, cross-user isolation, spoofed and
  replayed webhooks, duplicate events, cancellation, failed payment and access expiry.
- Keep raw sensitive content out of logs, analytics and permanent exports. Verify actual
  storage cleanup, not just disappearance from the UI. Document separate provider and
  backup retention. Synthetic tests do not prove live recommendation quality.

## Decisions to finalize within their implementation slices

- Temporary conversation expiry and recovery policy; legacy/backups conversion behavior.
- Evidence review ownership, allowed sources and measurable quality thresholds.
- Actual model/project availability, latency and cost; no live-user data in model trials.
- Hosted identity/guest-linking provider fit and durable database deployment.
- Subscription price, billing provider, usage limits and expired-subscription behavior.

These are implementation decisions, not reasons to invent defaults or block unrelated
foundation work. Record decisions explicitly before implementing dependent behavior.

## Later scope

Voice input/output can use the same text/context/memory pipeline. Optional photos,
native apps, notifications, professional-service discovery and advanced scheduling
follow the validated text-coaching release. Do not add them to the initial scope.

## Working and GitHub conventions

- Start from the latest `main`; preserve its merged mobile changes and unrelated files.
- This documentation checkpoint comes first. Application implementation follows review
  of this plan, in the slices above.
- Use `codex/` feature branches and small, coherent commits. Push each completed, checked
  checkpoint; report what landed, what was tested and any remaining limits.
- Prefer separate PRs for coherent slices. Do not auto-merge or deploy merely because
  a checkpoint was pushed. Keep runtime docs synchronized with completed work.

## Current local setup and data behavior

The following instructions describe the existing local runtime. They are not claims
that the planned hosted, billing or transcript-removal changes are already implemented.

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


## Separate kept list and suggestion batches (2026-11-05)

Today and My plan now split chosen actions into Your kept list and unchosen ideas into
Suggestions. Compact badge-sized choices save or dismiss immediately, without implying
completion. Get new suggestions calls `/v1/agent/suggestions` for 1-4 fresh actions;
`/v1/agent/suggestion-choice` moves an action into/out of the kept list or dismisses it.
Each batch replaces only the suggestion pool, never the kept list or accepted plan.
Existing journey choices migrate lazily on the first mutation without deleting plans.
Check-in proposals still require acceptance and are separate from exploration.

The request includes original answers, constraints, kept actions, explicit rejections,
previously shown ideas and optional feedback. The server rejects exact title/detail
repeats, assigns IDs, preserves kept objects, and saves only after successful generation
with revision checks. Semantic novelty still needs model evaluation. Current local
bounds are 24 kept actions and 50 batches per journey. Previously shown suggestions
are retained locally for repeat avoidance; this is not the planned retention redesign.
Synthetic integration tests cover persistence, migration, repeat/failure/concurrent
protection, requests without votes and requests when all existing actions are kept.
No live model-quality evaluation was performed for this checkpoint.
