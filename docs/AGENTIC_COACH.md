> Current release: see [Goal workspace](GOAL_WORKSPACE.md). It supersedes the staged intake UI and first-plan orchestration below.

# Agentic coach implementation

Updated 2026-11-11. Supersedes historical unlimited-question and duplicate-view notes.

## Workflow

LangGraph now orchestrates assessment (profile -> safety context -> progress context ->
question coach) and planning (profile -> safety -> progress -> relevant domain modules ->
planner -> reviewer -> optional single correction -> final review). FastAPI and the
existing SQLite/Postgres store remain. Questions and proposals are persisted at turn
boundaries with existing bearer ownership and compare-and-swap revisions. A failed
planning request leaves the accepted plan unchanged. Mid-node recovery replays that
request; this is not an independently checkpointed background worker.

No LangSmith tracing or additional transcript/checkpoint store is enabled. Graph calls
explicitly disable external tracing. Six initial questions across all domains and
three follow-up questions are ceilings, with early finish and skips. Existing saved
questions remain readable; newly generated choices are limited to six. Numeric/date
inputs are validated; numeric profile keys update typed measurements from actual answers.

## Scope and memory

New goals are skin, hair and weight/body habits. Legacy goal enums still deserialize.
Sourced facts now include concerns, routine, observations, measurements and relevant
health context. Reports, hypotheses and unknowns remain distinct. Edits invalidate
proposals and quarantine actions until rechecked. Body context is optional and validated.

The new UI explicitly reviews the profile before initial planning. At that confirmation
boundary, and when a revised plan/profile is explicitly accepted, relevant sourced
profile notes and reviewed visual observations are kept while temporary answer events
and conversation turns are cleared from active storage. User opening goals, accepted
plans, profile source excerpts and structured observations remain. Old clients do not
silently consolidate without this flag. Backups, provider retention and abandoned raw
sessions are separate; there is no claim of timed purging of abandoned sessions yet.
A failed generation does not clear working answers. Full profile deletion still deletes
the whole journey. The UI has no older-chat view.

## Planning, evidence and calculations

One plan coordinates at most three initial new habits. Each habit can specify weekdays,
time of day, estimated minutes/cost and structured exercises. Known shared time/budget
constraints are checked in code; unknown estimates require clarification. The reviewer
also checks context, safety, usefulness and evidence. This is not clinical validation.

A small development-reviewed 1177 reference library supplies bounded general guidance
before planning; optional live retrieval remains separate. Source reputation alone is
not proof of individual suitability. Milestones describe observations/review points,
not validated individual forecasts or numerical success probabilities.

The packaged food snapshot contains 14 explicitly named preparations from the Swedish
Food Composition Database, retrieved 2026-11-11, with source URLs, dataset versions and
CC BY 4.0 attribution. It is deliberately limited, not a full grocery catalog. Meal
calories/protein are recomputed from edible grams and verified per-100g entries;
unknown values remain unavailable, never zero. Saved/client totals are not trusted.
Known catalog allergen flags add a limited guard, not a complete allergy guarantee.
The model must use suitable catalog foods or leave meals unavailable and explain why.
Weekly meal slots, preparation instructions, shopping consolidation and reviewed swaps
are supported. Swaps create proposals and preserve all other meals/actions.

Optional adult maintenance estimates use Mifflin–St Jeor with broad activity-factor
scenarios, not measured needs or a confidence interval. Missing context, a low target,
pregnancy/breastfeeding or rapid-loss deadlines prevent that estimate. Calorie-deficit
prescriptions are disabled. This release does not claim clinical nutritional suitability.

## Progress and services

Dated observations explicitly distinguish not attempted, inconsistent, followed,
improved, unchanged and worse. Completion does not imply benefit; missing logs do not
imply failure. Worsening quarantines actions and invalidates a pending proposal.
Profile corrections, goal/deadline edits and observation changes require a recheck.
Meal adherence is linked to the actual weekday/slot and observation date. Keeping an
idea is a preference; it does not replace the accepted daily schedule. All-kept plans
can still be reviewed while habit actions are inserted unchanged by application code.
Reconstructed plans are checked against combined time/cost limits after preserves. Review prompts appear
when the app is opened; no notification scheduler or background AI spending is enabled.

Bokadirekt discovery is currently external category navigation only, with explicit
capability flags. No provider rankings, live prices, credentials or availability are
invented. No scraping, booking transaction or health-profile transmission occurs in
this adapter. Marketplace search/direct booking needs a permitted partner integration.
Body-contouring recommendations are excluded from the initial release.

## Interface

Today shows scheduled habits, optional meals and dated observations. Plan contains the
weekly schedule, detailed instructions, milestones, alternatives and optional service
links. Coach starts a bounded review and presents proposed changes for approval.
Profile contains editable facts, optional measurements/preferences and data controls.
The separate timeline, analysis and Insights screens are removed from the active flow;
old hash routes map to the current workspace. Onboarding is focus -> understanding ->
profile review. The existing warm-coach design and mobile navigation remain.

## Validation and limits

Synthetic tests cover graph routing, question ceilings, typed input validation, profile
revisions, unsafe target constraints, dated observations, missing nutrients, exact
ingredient arithmetic, meal swap approvals, shared budgets, source provenance and
confirmation-driven consolidation. Existing staged-coach regressions remain.
No test result establishes real-world clinical recommendation quality. Account sign-in,
billing, notification delivery, broad food coverage, partner marketplace access and a
validated forecasting model are not claimed by this release. Temporary public testing
still follows the user's earlier explicit authorization.


Final validation checkpoint (2026-11-11): 137 backend tests pass; one optional real
Postgres test is skipped without a configured test database. Frontend TypeScript and
production build pass. Synthetic browser checks covered focus selection, photo-enabled
and numeric/no-photo questions, profile confirmation, daily completion, observations,
shopping totals, a meal-swap proposal, rejection/acceptance, profile/body-context correction,
review after a reduced time budget and 360/390/1280px layouts. A real configured-model
smoke test completed assessment, a three-action plan, reviewer approval and confirmation
consolidation; its isolated synthetic journey was deleted. This is one connectivity
and schema smoke test, not evidence of clinical quality across the acceptance suite.
