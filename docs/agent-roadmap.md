> Current deployment update (2026-11-05): temporary public Vercel testing has been
> explicitly approved. Hosted mode now requires Postgres, supports same-origin API
> requests and preserves per-journey bearer access. Account sign-in and deployment
> privacy are deferred. This supersedes historical local-only/guard checkpoints below.
> See [the current deployment guide](VERCEL_DEPLOYMENT.md).

# Revana implementation roadmap

Updated 2026-11-05. Product definition: [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md).
Base implementation: `main`, including the merged mobile UI and local adaptive agent.
This update changes the delivery plan; it does not implement the new behavior below.

## Warm personal coach design checkpoint (2026-11-05)

Applied the selected C. Warm personal coach direction across onboarding, adaptive
questions, photo answers/review, analysis, Today, My plan, Coach, Insights and settings.
Figtree is bundled locally; cream surfaces, terracotta controls, rounded cards and
larger labels replace the earlier mixed typography. Optional notes and suggestion
messages expand on demand. Cost badges wrap instead of truncating. Kept actions have
a visible completion control, separate from preference, with readable completed titles.
The API, question limits, photo consent/review and plan acceptance behavior are unchanged.

Validation: TypeScript check and production build pass. An isolated fake-provider
journey covered multiple choices plus a note, analysis, keeping and completing an
action, action details, all dashboard tabs and settings. Checked 360/390px phones and
1280px desktop, with no horizontal overflow in those checked views or browser errors.
This is synthetic UI validation, not a live-provider quality or real-device assessment.

## Current baseline

- 2026-11-09 conversation checkpoint: latest messages and selected answers lead coach
  replies; a visible composer supports adaptive selectable follow-ups, explanations
  and practical action alternatives. No fixed question/choice/action-count quota.
  Clarifications preserve kept actions and current suggestions. Chat context informs
  proposed plan revisions, which still require acceptance. Raw turns remain in the
  existing journey lifecycle; retention consolidation is not implemented here.
  Validation: 104 backend tests passed, one skipped; Ruff, generated-contract checks,
  TypeScript and production build passed. Synthetic browser checks at 390px and
  1280px covered visible chat, failed-request draft preservation, nine choices with
  exclusive selection, eight selected answers, six alternative actions, preserved
  kept actions, direction changes, reload and no page errors or horizontal overflow.
  Live recommendation quality and provider behavior remain unverified.

- 2026-11-09: goal-specific fit/safety options replace the fixed allergy list.
  During assessment or an unfinished check-in, earlier answers can be edited;
  dependent later questions are regenerated without changing accepted plan history.
  Bokadirekt discovery is researched and documented in architecture.md, not connected.
  Validation: 93 backend tests passed, one skipped; Ruff, generated-contract checks,
  TypeScript and production build passed. Synthetic browser checks at 390px/1280px
  covered editing/cancel, regenerated questions, fit-choice retry, exclusive choices,
  back navigation, retained draft text and no horizontal overflow or page errors.
  Live model relevance and real marketplace results have not been validated.

- React/TypeScript mobile-responsive UI and FastAPI `/v1/agent` API in one repository.
- One adaptive question per turn without fixed cycle or option counts; users can skip or finish.
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


## Mobile shell and Back navigation (2026-11-05)

The dashboard now uses a single-column app shell with a sticky Back/brand header and
fixed Today, My plan, Coach and Insights bottom navigation. Coach input and data
controls have their own destination instead of a desktop sidebar. Plan summaries are
expandable, cards remain title-first, and safe-area spacing protects the bottom bar.
The app remains a browser application; this does not add native installation or offline support.

Hash routes preserve the selected screen/tab on reload and support browser Back and
Forward. From Today, Back opens the analysis; Back to start opens a welcome screen
with Return to my plan. Navigation never deletes the saved journey or restarts its
assessment. Old assessment routes cannot reopen generation for an existing plan;
they resolve to analysis instead. Back from another tab returns to Today; Back from
an active check-in returns to the plan while saved answers remain available.

Validation: TypeScript and Vite production build; browser navigation, restoration and
phone-width layout checks. No provider requests or saved-plan mutations are required
for navigation. The requested in-app preview is left at 390 by 844 pixels; this is
viewport emulation, not a physical iOS/Android browser test.


## Questionnaire photos and profile restart (2026-11-05)

Questions now expose photo_mode (none/products/skin/hair); generated questions must
choose it explicitly. Legacy questions default to none. Optional photos can accompany
choices/text or answer a visual question alone. Up to three photos are accepted, each
at most 1.5 MB after resizing; the browser accepts original JPG/PNG/WebP under 10 MB
and resizes to a 1536-pixel longest edge. The backend validates base64, actual format,
still-image/pixel bounds, strips metadata by re-encoding, and limits aggregate request
bodies to 6.1 MB. No URLs, SVG, animated or undecodable images are accepted.

The Responses adapter sends temporary input_image content with store:false. It does
not upload Files or persist original images. A structured PhotoReading is saved as
unconfirmed photo_notes alongside a photo count, separately from the user's answer.
The next decision and plan are gated until `/v1/agent/photo-notes` confirms edited
observations or discards them. Confirmation does not consume another question. A
failed extraction, confirmation generation or revision conflict leaves saved state
unchanged. On photo-only discard the event becomes an explicit skip. User-reviewed
notes remain uncertain visual observations, not diagnoses or assumed product use.
Existing raw chat retention, provider retention and backups are separate concerns.

Profile settings and My plan expose Delete profile & start over. A native confirmation
dialog explains local deletion and exports/backups/provider limits. Only successful
DELETE clears the browser capability and profile state and returns to the first step.
Cancel keeps the journey. A failed delete retains the profile for retry. Stale old
plan routes are guarded after restart. Local key/model configuration is unchanged.

Validation uses generated images, temporary SQLite and mocked provider responses.
Live skin/hair interpretation and physical phone camera behavior are not clinically
or device validated. The selected gpt-6.1-terra supports image input according to
[official model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-terra).
Image payload format follows the [Responses image guide](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses).


### Update: selective photo answers (2026-11-08)

The generated question's photo_mode now controls whether the browser offers a photo
answer. The LLM defaults to none and chooses products, skin or hair only when an
image can materially help answer that particular question. Duration, sensations,
history, diet, budget and preferences do not show an upload option. Existing/legacy
questions with none also hide it. Visual questions retain optional photos, explicit
consent, temporary processing and review of observations. No extra LLM call is needed:
this decision is part of generating each adaptive question. The backend still accepts
previously prepared photo answers from older clients, preserving consent and review.

## Single-project Vercel Services configuration

Added root service/build/routing configuration and an explicit FastAPI entrypoint.
Use one Services project rooted at the repository, not two separate imports. The
frontend already calls `/v1`; `/api` from the suggested template is not its contract.
This checkpoint configures the deployment layout only. Hosted runtime, storage,
authorization and photo-size gates remain outstanding and the startup guard remains.
Setup and validation limits: [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md).
