# Architecture decisions

Updated 2026-11-05. The table and runtime sections describe the implemented local
application. Planned product behavior is specified in [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md).

| Area | Current implementation | Hosted direction |
|---|---|---|
| Repo | `frontend/`, `backend/`, `contracts/` | Same |
| Backend | Python/FastAPI, versioned `/v1` API | Same |
| Frontend | React/TypeScript/Vite; merged mobile-responsive workflow | Mobile-first web; native/voice later |
| Hosting | Single-user local, loopback only | Two Vercel projects after hosted readiness |
| Access | Random per-journey bearer capability, hashed in database | Auth0 + ownership enforcement |
| Database | Local durable SQLite | Managed pooled EU Postgres + migrations |
| LLM | Server-side structured OpenAI Responses adapter | Reviewed guidance + evaluations |
| Data | Saved raw answers, accepted plan versions, pending proposal; export/delete | Care profile + structured outcomes; temporary raw turns; explicit retention |

## Adaptive agent

Direction and goal selection lead to a consent step, then one question per answer,
with a hard cap of six adaptive assessment questions. Fit/safety controls precede
plan generation. The analysis separates reported facts, hypotheses and uncertainties.
The dashboard supports follow-up check-ins with at most three questions and a proposed
plan revision that must be accepted before replacing the current plan.

The backend owns question budgets, active-question IDs, input bounds and revision
checks. LLM generation completes before database writes; failure leaves saved state
unchanged. Atomic compare-and-swap writes reject stale/replayed mutations. Accepted
plans remain versioned. The provider is replaceable in tests; demo responses are not
used as a live fallback.

## Contract and errors

`contracts/openapi.json` is generated from the backend. Serialized frontend response
types in `frontend/src/api.generated.ts` are generated from the same schemas. Regenerate
both after changing models/endpoints; tests verify freshness.

Non-2xx responses use `{"error": {"code": "...", "message": "..."}}`. Validation errors
include field locations only. Never log answers, chats, tokens, keys or upstream bodies.
Agent responses use `Cache-Control: no-store`.

## Deployment boundary

The local agent requires development mode and refuses Vercel startup. Bind the API to
`127.0.0.1`; the agent also checks the request host, local peer and browser origin.
These checks are a local boundary, not hosted account authentication. Never expose
this SQLite/capability implementation as a public multi-user service. Hosted readiness
requires Auth0, per-resource authorization, durable Postgres, rate/spend controls,
privacy/retention operations and deployment validation.

See [the agent roadmap](agent-roadmap.md) for milestones, launch instructions,
data behavior, operating limits and outstanding validation gates.

## Action feedback and plan refresh

Action preferences are versioned separately from completions. Saving Keep it or Not
for me does not call the provider and does not claim the user performed the action.
The refresh request combines the original problem, answer history, constraints,
accepted plan, current preferences and an optional message.

The provider returns replacement actions with editable source IDs. Application code
validates those IDs, inserts kept actions verbatim, rejects exact repeats of unwanted
actions and preserves the accepted version until the proposal is accepted. Kept
preferences carry into the accepted version. Check-in plan updates use the same
preservation path when preferences exist. Semantic similarity of reworded suggestions
remains an evaluation concern; exact text checks do not prove semantic novelty.

Changing preferences invalidates an earlier proposal. Discarding a proposal keeps the
accepted plan intact. Revision checks prevent concurrent feedback from being lost.
The Today and My plan views share title-first cards, compact badges, preference
controls and collapsed details. Progress completion remains a separate explicit control.

## Next architecture changes (planned)

The current local runtime remains available during development. The target is a
mobile-first coach with a complete free starting plan and paid progress/plan updates.
The existing prompt-in-code and whole-journey context will be replaced by versioned
product/task instructions and a bounded context builder.

Persist typed profile facts, provenance, confirmation, clearly labeled hypotheses,
validated concise notes and accepted plans. Paid outcomes are separate dated records.
Conversation turns become temporary with explicit expiry and validated consolidation;
remove raw-event history displays and verbatim transcript exports. Existing raw journey
data needs deliberate conversion and documented backup handling. Hiding chat UI alone
does not implement this retention model.

Hosted development adds Postgres/migrations and secure guest/account authorization,
followed by verified billing and backend entitlements. Initial plan access, profile
correction, export and deletion remain available without a subscription. Auth0 is the
existing identity direction; validate guest-linking/email flows before implementation
or record an explicit replacement decision. Payment and LLM providers do not replace
application authorization. The local hosting restriction stays until release gates pass.

See the [implementation roadmap](agent-roadmap.md) for dependencies and small
commit/push checkpoints. This documentation update does not change application behavior.


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
