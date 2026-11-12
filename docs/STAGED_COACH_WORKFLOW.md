> Timeout/recovery update: current role budgets and durable workspace draft retry supersede
> the historical operations limits below. See [Goal workspace](GOAL_WORKSPACE.md#planning-timeout-recovery-2026-11-12).

# Staged conversational coach

Implemented locally on 2026-11-09. No merge or deployment is implied.

## Implemented versus deferred

| Area | Implemented | Limits / deferred work |
|---|---|---|
| Conversation | One CoachConversation component from initial assessment to dashboard; one answer composer, choices, skip, change direction, original question in transcript | Existing raw-turn storage remains; consolidation/expiry is future work |
| Starting point | Natural checkpoint after useful answers or when ready; build/add context/continue; explicit fit/safety/preferences review before plan | Readiness/relevance are model decisions, not clinical validation |
| Shared profile | Editable goals, allergies, limitations and preferences; reported/hypothesis/unknown/needs-review labels; exact quoted source and durable source IDs | Extraction is model-guided; exact-quote checks establish provenance, not semantic truth |
| Corrections | Old facts from edited or removed question turns become inactive; corrected events have new source IDs; goal changes cannot automatically erase allergies | Consequential contradictory reports still need clarification; historical records are retained |
| Current suggestions | Reviewer checks new and already-visible suggestions, kept actions and current accepted actions; incompatible/uncertain suggestions withheld | During each incoming message all suggestions are temporarily withheld until response; no claim of perfect clinical compatibility |
| Kept/history | Kept and accepted actions preserved; review notices and disabled completion when unchecked/incompatible; proposals invalidated by profile changes | A user must explicitly change a kept choice; no silent replacement of history |
| Research | Actual Responses API web_search; completed-call/citation verification, URL validation, source links/date/kind/applicability/uncertainty | Unsupported model/tool, disabled retrieval, timeout or missing citations produce unavailable/limited state; no direct Bokadirekt partner API or booking |
| Planner | Separate loaded prompt and request; coherent priorities, specific alternatives, requested breadth, effort/cost/timing/outcome | Requested counts do not force unsafe or irrelevant options to be shown; sources do not prove personal suitability |
| Reviewer | Separate request checks relevance, deadline coverage, usefulness, constraints, support; one targeted repair then another review | Second disapproval is surfaced and draft actions withheld; initial unsafe drafts cannot become accepted plans |
| Explanations | Public reviewer summary preserves safe rationale when some options are withheld; counts reflect compatible subset; safe start IDs highlighted | No private chain-of-thought exposed |
| Operations | 90-second default workflow budget, max 45 seconds per structured call, 30 seconds retrieval; retry state saves incoming /coach report and quarantines actions | Blocking synchronous requests; no streaming/job queue; hosting timeout must accommodate configured budget |

## Actual request routing

Python orchestration is in `backend/app/workflow.py`; no graph framework is needed.
`agent_provider.instructions()` loads `common.md` plus the named stage prompt for
every `[stage:...]` request. Coach/planner/reviewer are separate real provider requests,
not just unused prompt files.

| API path | Stages and context |
|---|---|
| `/sessions` | Coach decision with opening description and sourced reports; populate profile, create conversation/question |
| `/coach` before a plan | Same coach question/answer path; direct text, choices, skip or change direction; retained conversation |
| `/answers` | Validate active or edited question, invalidate derived facts for removed events, coach next step; review visible actions during a check-in |
| `/fit-options` | Coach generates optional choices from actual goal, profile and answers; no already-known constraint quota |
| `/plan` | Explicit fit report; optional researcher from coach intent; planner; reviewer; at most one repair and recheck; require usable actions |
| `/coach` after a plan | Coach extracts sourced reports; optional researcher; planner only when ready for actions; reviewer also checks existing actions during clarification |
| `/suggestions` | Compatibility endpoint using the same staged generation; retains legacy atomic failure semantics |
| `/checkins` | Coach with latest report and full relevant profile; reviewer rechecks visible actions; same conversation receives the turn |
| `/reshuffle` | Validate eligibility first; coach intake and profile updates; optional research; planner replacement draft; reviewer/repair; application inserts keeps verbatim |
| `/photo-notes` | Explicit review/discard remains required; coach continues and reviews visible actions when applicable |
| `/profile` | User correction with explicit provenance; immediately quarantine actions and invalidate a pending proposal without calling the model |

The shared context contains the latest request, active profile with source/status,
explicit source text, selected answer labels, relevant conversation, constraints,
kept/rejected actions, accepted history and retrieval results. Unselected question
options and question snapshots are removed from model facts. Conversation event-count
ordering prevents a preference-form submission or old message overriding a newer goal.

Action IDs are assigned before reviewing new suggestions. Revision replacement IDs
are remapped after application assembly so review warnings and start highlights still
refer to actual persisted cards. Missing checks default to needs-review; invented
source IDs cannot count as verified support.

## Retrieval boundary

Research receives only a generic topic/category/location query from the coach, never
the journey or profile. The application rejects empty queries and number/email-like
strings. Minimization beyond these checks remains model-guided; this is not a complete
data-loss-prevention classifier. Search queries must exclude private names, measurements
and questionnaire details. Treat retrieved pages as untrusted material.

The adapter requires a completed `web_search_call` and actual URL-citation annotations;
it does not accept model-invented source lists. Sources are classified as evidence,
product or service. A service listing is not efficacy evidence, a qualification check,
an available appointment or a booking. Plan versions retain research and review snapshots.
Configuration: `REVANA_RESEARCH_ENABLED` (default true), optional
`REVANA_RESEARCH_MODEL` (otherwise selected coach model). Tool/model failure falls back
to a truthful unavailable state, not fictional research. This uses the documented
[Responses web-search integration](https://developers.openai.com/api/docs/guides/tools-web-search).

## Failure and validation boundary

`/coach` preserves an incoming report if a model stage fails, returns retry state,
and withholds existing suggestions. Kept/accepted actions remain stored and flagged.
Legacy `/suggestions` and initial plan generation keep their atomic-save behavior;
the current UI uses `/coach`. Optimistic revision checks still reject concurrent writes.
No existing private journey or repository content is used in provider smoke tests.

The suite uses synthetic reports and typed fake stage outputs, plus HTTP-adapter tests
for actual provider payloads and retrieval parsing. It covers role/context propagation,
explicit allergies, latest intent, stale suggestions, kept/history preservation,
source invalidation after edits, revision IDs, one-repair enforcement and time-budget
gating. These establish orchestration and application safeguards, not live advice quality.

Final local checks: 122 backend tests passed, one Postgres integration test skipped
without its configured service; Ruff lint/format, generated OpenAPI/client-type checks,
TypeScript and production build passed. Stage output schemas require every property,
including the reviewer public summary. The coordinating chat also validated the live
required-public-summary reviewer response against the selected model in a synthetic probe.

Independent live local checks by the coordinating chat used `gpt-6.1-terra`, synthetic
hair/body requests and the real web-search tool. Observed relevant hair questions,
checkpoint -> fit review -> five habit alternatives with two starts, ten requested
alternatives with incompatible options withheld, and immediate quarantine after a
new allergy. One direct evidence-retrieval probe returned four cited government sources.
The coordinating chat will check the final committed provider schema separately.
Phone DOM checks at 390px showed no horizontal overflow. This is limited exploratory
testing, not a clinical, accessibility, real-device or production readiness assessment.

## Local checkout

Use `C:/Users/YULLIZ/OneDrive - Devyser/Documents/ChatGPT/Rev/revana-goal-aware`
on branch `codex/staged-coach-workflow`. Its existing backend `.venv` and frontend
dependencies support the documented commands. Start API from `backend/` with the key
loaded server-side from ignored configuration, then `pnpm dev` from `frontend/`.
The original repository's tracked `.env.example` was restored to a blank placeholder;
the supplied key is in its ignored `backend/.env` and must not be committed or printed.
Existing review servers/test database are owned by the coordinating chat.
