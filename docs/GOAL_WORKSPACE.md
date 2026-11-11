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
marked failed by state recovery after 180 seconds. Retry is explicit and does not
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
temporary public test; authentication, billing, broad evidence coverage, professional
service discovery/booking and voice remain separate roadmap items.
