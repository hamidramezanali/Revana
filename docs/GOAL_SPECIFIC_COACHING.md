# Goal-specific coaching checkpoint

Implemented on branch codex/goal-specific-coaching, 2026-11-11. No merge or deployment
is implied. The request is for goal-aligned intake and specific, firm practical plans.
Firm means direct and actionable; humiliation, crash restriction and false precision
are excluded. These modules do not make Revana a licensed clinician or dietitian.

## Runtime wiring

Five separately editable packaged files live in backend/app/prompts/:

| Goal | File | Intake and output focus |
| --- | --- | --- |
| Skin | domain_skin.md | Actual concern, products/reactions; ordered morning/evening routine |
| Hair | domain_hair.md | Shedding versus breakage, scalp and treatments; wash-day/maintenance steps |
| Body/fitness/nutrition | domain_body.md | Measurements and target where relevant, actual allergen, activity and schedule; practical meals, portions, recipes and training |
| Energy/lifestyle | domain_energy.md | Actual daily pattern and schedule; concrete wake/meal/movement/wind-down steps |
| Custom | domain_custom.md | Clarify the actual outcome; meaningful next-day steps for that domain |

agent_provider.instructions() includes all five lenses in coach, planner and reviewer
requests, including legacy requests. The instruction is to apply only lenses relevant
to the latest explicit request. This avoids a keyword router losing a changed goal;
selection remains model-guided, not a deterministic clinical classifier. Researcher
requests keep their generic public-evidence role without the specialist intake modules.
Existing setuptools prompts/*.md packaging includes the files.

No API/schema, saved facts, plan acceptance, action-review IDs, booking integration or
frontend layout changes are introduced. The planner uses existing action cards for
chronological day blocks when a full-day plan is requested, rather than treating all
meals as alternatives. This is model-generated presentation, not a new structured menu UI.

## Specificity with honest limits

- Weight-management intake asks current weight and height with units when missing, then
  the desired target and timeframe; already supplied facts are not re-asked. BMI uses
  kg / m squared, with explicit inputs and limitations and age-appropriate interpretation.
  BMI math remains model-generated: there is no new deterministic measurement parser,
  BMI calculator, clinical risk engine or typed weight record in this checkpoint.
- A reported unspecified food allergy requires clarification before a personalized menu.
  Named allergens and relevant ingredient/cross-contact limitations carry into recipes
  and substitutions. This strengthens coach/planner/reviewer instructions; it does not
  implement an independent ingredient/allergen database or guarantee allergen safety.
- Appropriate meal plans request raw/cooked quantities, preparation, servings, substitutions,
  and estimated per-meal and daily kcal/macros/fiber when requested. Sums and assumptions
  must be checked. No connected food database, verified nutrition calculator or recipe
  execution is claimed. Missing inputs do not justify invented personal calorie targets.
- A specific daily plan should remain useful when measurement/nutrition estimates cannot
  safely be personalized. Reject exact daily weight-loss guarantees, crash deficits,
  compulsory fasting, excessive-water tricks and local fat-loss claims. Body-contouring
  listings are distinct from weight loss; service discovery still needs actual retrieval.
- Broad conditional trends and a review window may be discussed when appropriate, with
  water/glycogen fluctuations distinguished from fat. No validated weight forecast is added.

## Evidence used for boundaries

These public pages informed developer guidance, not a claim that each live answer has
retrieved or clinically reviewed sources. Existing runtime retrieval/citation rules apply.

- [CDC: BMI formula and screening limits](https://www.cdc.gov/bmi/about/index.html).
- [CDC: gradual weight management and individual factors](https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html).
- [NIDDK: individualized body-weight planning](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner).
- [NHS: food allergy and avoidance](https://www.nhs.uk/conditions/food-allergy/).
- [FDA: body contouring is not weight-loss treatment](https://www.fda.gov/medical-devices/aesthetic-cosmetic-devices/non-invasive-body-contouring-technologies).

## Validation scope

Provider-payload tests verify that specialist guidance reaches actual HTTP request
construction for coach/planner/reviewer and legacy requests, that changed goals remain
supported, that user data is not interpolated into instructions, that researcher context
stays separate, and that arbitrary stage names cannot read other resources. These tests
use synthetic data and fake providers. They establish wiring, not clinical effectiveness,
allergen protection, nutrition accuracy or live-model quality. Full backend and frontend
checks are recorded with the delivery checkpoint.

Validation on 2026-11-11: Ruff lint/format passed; pytest reported 128 passed and one
Postgres integration test skipped without its configured service; TypeScript and the
frontend production build passed. Hosted test setup now uses a temporary working
directory so it cannot silently inherit this machine's backend/.env when testing the
default model. No production configuration or local credentials were changed.

Three bounded live synthetic probes (unspecified allergy, underweight target, complete
non-restrictive menu) did not complete. A model-access diagnostic returned HTTP 401 with
expired_secret_key for the existing local credential. No live output quality, BMI math,
meal nutrition or safety behavior was established. Replace the backend key locally before
live evaluation; never include it in a prompt, fixture, report or commit. A future clinical
review and structured nutrition/allergen calculations remain separate work.
