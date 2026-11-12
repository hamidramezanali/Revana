> Updated 2026-11-12: the assessment and weekly-programme sections below supersede
> the earlier draft-first and limited-habit behaviour.

# Goal workspace — current product and implementation

This supersedes the staged focus → assessment → safety → plan UI described in older
roadmaps. Revana now opens a Codex/VS Code-inspired workspace: saved goals, a live
plan artifact, and an agent panel. Mobile uses Agent / Goal / Plan / Progress views
and a goals drawer. Skin, hair and weight/body habits remain the supported scope.

## Interaction

- Describe an outcome and consent to AI processing. Creating a goal persists it
  immediately without any model request. An authorized previous profile can seed it.
- Weight-management goals receive one immediate, optional height/weight card only
  for missing baseline values. Existing measurements are reused. Skipping proceeds
  with non-restrictive habits, without repeatedly requesting the same baseline.
- A run uses the existing LangGraph profile, safety, progress and domain nodes, then
  planner and independent reviewer. A single targeted repair is allowed. No separate
  intake or web-research request blocks the first draft.
- Planner output streams as an unchecked draft. Review completes before acceptance
  becomes possible. Updates produce proposals; accepted plan history is preserved.
- Known and skipped clarification categories are remembered. At most one optional
  clarification accompanies a useful plan, with a six-category bound and no repeated
  supplied measurement fields. Relevant photos require consent and review of notes.
- Accepted plans support action preferences and structured progress. Kept habits are
  inserted verbatim before the whole-plan safety and resource review. Preferences
  do not certify safety after profile changes.

## API and execution

`/v1/workspace/goals` creates; `/run` streams SSE; `/state` restores durable status;
`/cancel` stops application of a run; `/accept` approves a checked plan and profile;
`/photo-review` confirms/discards temporary photo observations. Existing agent APIs
remain compatible for saved journeys, profile editing, export, deletion and progress.

SSE reports actual provider stage start/end, a provisional draft and the final saved
Journey. Heartbeats keep the connection active. Run IDs and optimistic revisions prevent
cancelled or superseded work from applying. Cancel cannot undo an already dispatched
provider request or its cost. Disconnection cancels application of later output; it
does not create background jobs. A run left running after process termination is
marked failed by state recovery after the configured workflow budget plus 30 seconds
(300 seconds with current defaults). Retry is explicit and does not
append the same user update again. There are no automatic billable retries.

Durability is the existing SQLite/Postgres Journey JSON; no separate transcript
checkpoint or tracing service is introduced. Goal capabilities remain browser-local,
with separate owned Journey records; there is no public goal listing. Browser goal
references contain titles and capabilities. Losing browser storage loses access in
this account-free test version. Export remains available per goal.

## Model context and retention

The role lives in `backend/app/prompts/workspace.md`, combined with the existing
common, planner, domain and reviewer instructions. The model receives the objective,
latest request, up to six working messages, sourced profile reports, body constraints,
latest accepted plan, recent progress and action preferences. Local reviewed guidance
is supplied; live web retrieval is outside the first-plan critical path. Never claim
that these limited references establish clinical validation.

Only reviewed profile/plan approval consolidates memory and removes working messages
and raw answer events from the current Journey. The objective, sourced relevant facts,
measurements, accepted plan versions and structured progress remain. This does not
purge backups or change provider retention. Original photo pixels are not persisted.
The selected server-side model is unchanged; keys never enter frontend code.

## Validation and next work

Automated tests cover immediate weight clarification, skip/no repeat, measurements,
streamed stage ordering, proposal acceptance, cancellation, safe failure and abandoned
run recovery. Existing backend regressions remain required. Test the live model with
synthetic goals and inspect mobile layouts before release. The app remains an approved
temporary public test; authentication, billing, broad evidence coverage, service booking and voice remain separate roadmap items. Public service discovery is
implemented below; listings do not establish medical suitability.

## Per-idea controls (2026-11-12)

Every draft and accepted suggestion has compact Keep as is, More detail, Improve in
chat and Remove controls. A short next-step preview makes instructions visible without
opening the full card. Detailed procedures render as numbered steps.

Keep records an explicit immutable preference immediately, including on the first
unaccepted draft. More detail explicitly unlocks that one idea and requests concrete
instructions for its existing approach. Improve in chat attaches its identity to the
composer; nothing is sent until the user writes and submits a requested change.
The server resolves the idea from the revision-checked current plan, not client-supplied
suggestion text. Initial and correction outputs are merged into that plan in application
code before review: other actions, meals and milestones remain unchanged. All resulting
plan refinements remain proposals requiring acceptance.

Remove persists an exclusion without a model call, hides the idea from the active
workspace and supplies the removed snapshot to later planning. Exact repeated titles
are filtered in application code; semantic paraphrases still depend on model adherence
and require future quality evaluation. Removed items are recoverable in a collapsed
section while present in the current plan. Accepted history and historical progress are
preserved. Acceptance excludes removed draft actions and rejects an empty selection.
The historical accepted-plan API still stores the original plan; removal is a workspace
exclusion, not erasure of historical records. No preference implies completion.

API: POST `/v1/workspace/idea-choice` records keep/remove/clear; `/run` accepts
`action_id` with `idea_intent=details|improve`. Those fields cannot be combined with
another question answer or photo payload. Retry retains the selected edit context.
Regression tests cover immediate decisions, persistence, revision conflicts, one-idea
isolation, exclusion/acceptance, rejection of empty plans, and combined effort checks.


## Adaptive assessment and full weekly programmes (2026-11-12)

The initial plan is now preceded by a bounded assessment. Known measurements are reused;
missing weight baselines and outcome/timeframe cards appear immediately without a model
roundtrip. A concrete date, 4/8/12-week horizon, no fixed deadline, or an explicit skip is
saved in the goal. Outcome refinements take priority over the opening request. Dates
are validated and the target date reaches deterministic rapid-loss checks and the model.
The date is a desired review horizon, never a guaranteed weight/skin/hair outcome.

A separate short coach request asks one decision-changing question at a time. It can
ask about training/equipment, actual schedule, limitations or relevant food/routine
patterns; skin/hair questions should distinguish triggers, timing and product use.
Choices, numeric fields, optional text and relevant visual questions remain supported.
Known, answered or skipped categories are not repeated. Stop when enough is known, at
six answered question cards, or when the user chooses Build weekly plan now. The planner
runs only once assessment finishes, followed by the independent reviewer and at most one
repair. Existing accepted plans remain accessible; Plan my week starts a fresh assessment
using their saved context. Targeted idea refinements continue to bypass full intake.

The three-habit cap is removed from both prompts and deterministic validation. The model
chooses the useful scope; this does not mandate an arbitrary number of cards. One session
can contain several exercises and recur on multiple days. WeeklyProgramme records the
programme block, goal, timeline assessment, schedule/recovery notes, observable progress
signals and review rules. Action weekdays and meal days drive the seven-day schedule.
Exercise prescriptions include sets/repetitions or duration, rest, detailed technique,
form cues and easier alternatives. Exercise or action progression is criteria-based;
weekly steps include an instruction, advancement criterion and fallback. Training plans
missing prescriptions, rest or progression are rejected for correction; the combined
daily time and financial constraints remain enforced. Existing plans migrate with null
programme, empty progression and empty cue defaults; no stored history is overwritten.

Collapsed items show compact titles, time/cost/effort badges and the existing idea
controls. Show more reveals all saved instructions, exercise details and progression.
The instruction allowance is raised from 1,000 to 8,000 characters per idea, with larger
technique and progression fields. More detail requests an extensive, isolated refinement
using these fields; it still preserves other items and requires proposal approval. Large
plans can take longer to generate; real stage events, cancellation and retry remain in use.
A richer output schema alone is not evidence of clinically validated recommendations.

Regression coverage includes adaptive assessment transitions, date persistence and bad
inputs, finish/skip behaviour, the six-question bound, programmes beyond three actions,
exercise quality checks, larger details and all earlier idea-choice/cancellation flows.
Use synthetic goals for live validation; do not load real saved profiles into smoke tests.


## Food-first planning and researched alternatives (2026-11-12)

Assessment preserves the goal/timeline and six-card ceiling, but body goals no longer
implicitly mean workouts. The coach asks about the preferred route, food preferences,
allergies, cooking/storage access and time when those answers change the plan. Skin
and hair questions also consider relevant routines, health context and preferences;
professional procedures are optional approaches, not automatic recommendations.

`Plan.nutrition` describes the meal pattern, portion approach, substitutions and
batch-preparation sessions with meal links and storage guidance. Meals include actual
catalog ingredient weights, instructions and optional storage/reheating notes. The UI
shows seven meal days, ingredient totals in their named preparation state and
application-calculated approximate ingredient kcal/protein. These totals are incomplete
meal estimates, never a personal daily calorie target. Batch-prep minutes plus additional
meal assembly and activities must fit the daily budget; the planner must count prep
work once. Existing plans can use **Add meal-prep planning** or **Update food preferences**
to ask the missing questions and propose a revision without losing the accepted plan.

Automatic numerical calorie targets/deficits remain disabled. Qualitative modest-deficit
discussion is eligible only with known adult measurements, BMI at least 25, pregnancy
explicitly inapplicable and no existing body-guidance contraindication. This is a
conservative application eligibility rule, not a medical assessment. Lower/normal BMI,
unknown measurements and unsafe targets use balanced meals or individual clinical
review. Existing restrictive-target and exercise safety review still applies. The
limited food snapshot/allergen markers do not establish allergy safety or complete
nutrient coverage. Storage guidance references Livsmedelsverket; it does not guarantee
shelf life for a generated recipe.

**Explore other approaches** embeds an explicit research action in the plan. Topics
cover nutrition/body composition, skin care, pigmentation, laser/light, hair loss,
scalp care and hair removal. The user optionally selects a supported Swedish city and
public Bokadirekt listings. Research is deliberately outside the first-plan path.
Application-owned generic topic queries plus the selected city go to web search;
answers, measurements, photos and free text never enter those queries. Normal
server-side OpenAI interpretation receives profile context to discuss fit and limits.

Evidence retrieval is restricted to 1177, Livsmedelsverket, AAD, NHS, FDA, PubMed and
NICE. Service retrieval is restricted to Bokadirekt, with individual `/places/` pages
shown separately from primary evidence. Each search requires an actual completed
OpenAI web-search call and domain-checked URL citations. Citation presence is not
independent verification of the source's findings or the listing's qualifications.
No direct marketplace scraping, login, availability checking, payment or booking is
implemented. Category links are manual fallbacks when individual listings are absent.

`method_discovery.py` interprets actual evidence into cited alternatives, with risk,
evidence limitations, suitability and practical next steps. No usable evidence means
no generated treatment recommendation; failed interpretation preserves the sources
and labels the report partial. Professional options require assessment. Body contouring
is never a substitute for weight loss. The last eight reports are saved in Journey
JSON, dated and separated from profile facts. The last two relevant reports can inform
later reviewed plan proposals, using their actual evidence IDs. **Discuss with my agent**
prepares a message; it never silently adds a procedure or changes an accepted plan.

The existing `/run` SSE protocol accepts `action=research`, a typed topic, optional city
and services flag. It rejects questionnaire fields on research requests, preserves the
previous workflow review/accepted plan and applies results only with the existing
revision/run/cancellation checks. Explicit retry remembers an interrupted research
request. Stop prevents later application, but cannot reverse dispatched provider costs.

Validation: 170 backend tests passed, one optional Postgres test skipped; TypeScript,
Ruff and production build passed. Synthetic tests cover food/prep budgets, ingredient
estimates, restricted energy advice, source IDs/domain filtering, query minimization,
report persistence, cancellation and unchanged accepted plans. A deliberate live
synthetic research run returned four primary citations, five public listings and two
interpreted alternatives in about 22 seconds; this is an exploratory integration check,
not a clinical quality evaluation or guarantee of marketplace coverage. A live synthetic
food-first assessment asked about meal-preparation obstacles before workouts. Synthetic
browser checks at 360/390px and 1280px covered recipe details, research persistence and
the editable research-to-agent handoff, with no page horizontal overflow in checked views.

Implementation references:
- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [Bokadirekt](https://www.bokadirekt.se/)
- [Livsmedelsverket chilled food storage](https://www.livsmedelsverket.se/livsmedel-och-innehall/tillagning-forvaring-hallbarhet/forvaring-av-kyld-mat/)
- [AAD laser guidance](https://www.aad.org/public/diseases/a-z/skin-conditions-lasers-treat)

Next: broader de-identified recommendation evaluations, food/allergen catalog coverage,
more locations/locales and practitioner qualification verification. Account sign-in,
billing, voice and service booking remain deferred.


## Planning timeout recovery (2026-11-12)

Detailed planning now has a 120-second provider budget; independent review has 60
seconds and short coaching questions retain 45 seconds. Every call is clipped to the
remaining whole-run budget (default 270 seconds). Vercel's backend service explicitly
allows 300 seconds, leaving time to save failure state. Operators may lower the workflow
budget with REVANA_WORKFLOW_TIMEOUT_SECONDS, but cannot exceed 270 seconds. These are
ceilings, not expected response times; no automatic billable retries were added.

The completed assessment handoff is persisted before the planner starts. Each complete,
unreviewed WorkspaceDraft is saved as workspace.review_draft, separately from proposals
and accepted history. Explicit Retry reuses this artifact and runs the independent
review and deterministic constraints again; an incomplete/timed-out planner request has
no artifact and is explicitly regenerated. A failed correction retains the last complete
draft. A new message/assessment/idea request clears the retry artifact. Unchecked drafts
cannot be accepted, and successful review clears the artifact when saving the proposal.
Existing revision/cancellation checks govern all checkpoint writes. Recovery is at stage
boundaries, not token-level continuation or a background job.

Stage-specific timeout messages distinguish building a plan from checking it. Saved
answers are retained in both cases. No change to the selected model or health safeguards.
See [Vercel service duration configuration](https://vercel.com/kb/guide/vercel-services-fluid-compute).


A single continuous timed activity (one set) does not require an inter-set rest value.
Repeated sets and repetition-based resistance exercises still require explicit rest.
Validation messages identify the exercise/action and missing field for targeted repair.
The planner output allowance is 12,000 tokens for a full weekly artifact, while short
assessment cards keep their smaller allowance. This is output headroom, not a required
plan length or a change to the selected model.
