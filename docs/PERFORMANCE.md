# Workspace performance

Updated 2026-11-12. These are application changes and exploratory synthetic measurements,
not a guaranteed latency SLA or clinical-quality evaluation. The configured model is
unchanged. No automatic billable retries, background jobs or external tracing were added.

## What was measured

A local TestClient run with the real configured OpenAI adapter reproduced a 142.65s
full weekly-plan operation: 141.54s was model requests, 91.6ms storage (20 measured
operations) and 0.1ms in the measured context builder. The remaining time includes
orchestration, serialization and SSE scheduling. This identifies model work, especially
repeated complete generation, as the primary bottleneck in that sample. It does not
measure hosted cold starts, browser networking or production Postgres latency.

| Synthetic operation | Before targeted repair | With targeted repair |
|---|---:|---:|
| Complete weekly plan, including one correction and both reviews | 142.65s | 102.79s |
| Correction model call | 54.66s | 8.32s |
| Correction output tokens | 4,779 | 598 |

Both plan runs completed. Inputs requested seven vegetarian lunches and two beginner
strength sessions, using temporary SQLite and synthetic measurements/preferences. They
are individual stochastic calls, not repeated trials or a p95 benchmark. The first
planner calls were 62.85s and 58.26s; reviews still consumed 12–23s each.

A separate single-idea refinement completed in 51.83s including a targeted correction
and both reviews. Review correctly caught missing cooking-time/portion coverage during
exploration; unsuccessful fixtures were not accepted or presented as successful plans.
The original selected-idea payload was 46,045 characters; compact variants were about
9,400–14,800 depending on retained fixed meal constraints. Smaller input alone did not
consistently reduce live call time. The main measured improvement came from generating
only changes rather than a second complete plan.

## Implemented optimizations

- `planning_wire.py`: single-idea calls return `IdeaRefinement` (one Action), with a
  dedicated short prompt. Application code merges it into the original plan, enforces
  immutable neighbours/keeps and performs independent whole-plan review.
- Full-plan repairs return `PlanRepair`: changed actions/meals, explicit removals and
  optional metadata. Empty item lists/null metadata preserve existing data. Unknown
  removal references, duplicate slots/IDs and contradictory changes are rejected.
  Kept actions, deterministic constraints and the second full review remain required.
- First full plans use a provider-only recipe/schedule schema: distinct recipe details
  appear once, with day-slot assignments. The application expands this into the same
  saved/API `WorkspaceDraft`/`Plan` shape and recomputes nutrition. Unknown recipe keys,
  duplicate recipes or invalid schedules fail safely. Different recipes remain distinct;
  this is not a recommendation-count or detail limit.
- Provider context removes redundant plan copies and historical bookkeeping. Reports
  and exact quote provenance, question/source mapping, confirmed photo observations,
  health constraints, body preferences, progress, feedback, completion records and
  excluded choices remain. Review sees the whole merged plan, used food metadata,
  application-calculated nutrition and extra old actions requiring checks. Focused
  food edits retain the fixed meal schedule and recipe quantities, not only time totals.
- Context creation serializes the latest accepted plan/recent outcomes directly instead
  of serializing all versions and the whole workspace before discarding them.
- Stage completion is streamed without its own database write. It is saved at the next
  draft checkpoint, stage start or final write; each event still reads and validates the
  current revision/run lease. Cancellation, stale-result rejection and CAS remain.
- Conflicts in frozen neighbours or plan-level issues with a compatible selected action
  do not trigger a futile single-action correction. The plan remains withheld; the user
  must request a broader plan review. This does not turn rejection into approval.
- Removed the obsolete three-habit instruction conflicting with full weekly planning.

## Diagnostics and reproduction

`GoalRun.performance` holds numeric server-run diagnostics: elapsed time, context-builder
and store-operation duration/count, and per-structured-request duration, input/output
characters, returned token counts and completion status. No key, prompt, answer, image,
provider text, private reasoning or trace is recorded. The normal goal bearer protects
these fields. They persist with completion/failure, not via extra telemetry writes.
The collapsed **Last run** display exposes this breakdown in the agent panel.

Timing starts inside work execution; request setup and the final save are outside the
snapshot. Provider timing includes HTTP, response handling and validation. Research's
separate search requests are not instrumented as structured model calls. The context
metric measures `coaching_context`, not every dictionary allocation. Cancelled runs may
have no final diagnostic snapshot. Interpret totals accordingly.

Automated regressions cover lossless recipe expansion, checked references, preserved
clinical/answer/visual context, patch immutability, independent review after repair,
no futile frozen-neighbour repair, provider wire formats and numeric-only telemetry.
Run the ordinary backend tests, Ruff, generated contracts, TypeScript and build checks.

For a deliberate billable synthetic live run, from `backend/` with local backend
credentials configured:

```powershell
./.venv/Scripts/python.exe scripts/benchmark_workspace.py --live --case create
./.venv/Scripts/python.exe scripts/benchmark_workspace.py --live --case refine
```

The harness forces a temporary local SQLite database even if `.env` contains a database
URL, never reads existing journeys, prints aggregate timings and destroys its database.
Without `--live`, it refuses to run. A seeded refinement fixture is not clinical evidence;
check its final `result` rather than timing an unsuccessful run as a completed update.

Next: collect repeated synthetic and owned hosted timings, including cold/warm Postgres
and p50/p95, before setting a latency SLA or changing model/reasoning settings. Existing
fail-safe timeouts remain; lowering a timeout would not make a successful operation faster.
