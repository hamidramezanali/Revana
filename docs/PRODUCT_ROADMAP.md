> Current deployment update (2026-11-05): temporary public Vercel testing has been
> explicitly approved. Hosted mode now requires Postgres, supports same-origin API
> requests and preserves per-journey bearer access. Account sign-in and deployment
> privacy are deferred. This supersedes historical local-only/guard checkpoints below.
> See [the current deployment guide](VERCEL_DEPLOYMENT.md).

# Revana product plan

Updated 2026-11-05. This is the current product specification. It supersedes the earlier
prototype proposal, including its separate-repository layout and deferred monetization.
See [architecture.md](architecture.md) for current runtime facts and
[agent-roadmap.md](agent-roadmap.md) for implementation checkpoints and launch instructions.

## Product promise

Revana is a mobile-first personal beauty and wellbeing coach focused on skin, hair and
supporting lifestyle habits. It learns a person's situation through a short text
conversation, builds an editable care profile, and creates a useful overall plan.
Paid coaching records progress and adapts that plan to the person's reported outcomes.

The advantage is relevant, evidence-backed personalization and continuity. Novelty,
long answers and a confident tone are not measures of recommendation quality.
Familiar advice is appropriate when justified by the profile; generic lists are not.
Do not promise recommendations unavailable elsewhere or superiority to medical care.

## Agreed scope

- Preserve the visual direction and mobile improvements merged into `main`.
- Text conversation first; a guided-question presentation uses the same engine.
- Conversation leads: the latest message drives the response while preserving relevant
  reported context and safety constraints. Ask a focused question when needed, using
  as many relevant choices as useful, with optional text. No fixed assessment/follow-up
  question or option quota. Users may skip or finish early. Fit/safety remains explicit.
- Coach replies can explain, clarify or offer concrete action alternatives, including
  more than three when useful. Show a concise rationale, never private chain-of-thought.
- A complete starting plan is free. Do not replace it with three teaser ideas or hide
  its useful content behind checkout. Action count follows need and manageable effort.
- Paid access covers ongoing coaching, dated progress and observations, follow-up
  assessments and revised plans. The original plan remains readable without payment.
- Persist a care profile, accepted plans and eligible structured outcomes. Do not offer
  an older-chat screen or keep verbatim conversations as permanent coaching memory.
- Sweden and Scandinavia first; globally usable data and language foundations.
- Retain existing goal support, while positioning skin/hair and relevant lifestyle as
  the primary experience. This is not positioned as a dedicated fitness coach.
- Adults first. Voice, native apps and professional-service discovery
  are later additions, not prerequisites for this release.

## Mobile journey

1. Open the app and start a secure guest profile with a short explanation of processing.
2. Describe a concern in text or choose a starting topic. No email wall before value.
3. Answer targeted questions; subsequent questions use the evolving facts and unknowns.
4. Review a compact profile: reported concerns, current routine, constraints and goals.
   Correct misunderstandings and confirm the facts used for the plan.
5. Receive a complete personal plan, including priorities, practical actions and review
   timing. Present evidence and reasoning through expandable detail.
6. Offer a clear subscription for tracking how the plan works and adapting it over time.
7. Verify an email to recover the profile, continue across devices and manage payment.
   Link the existing guest records; do not create an empty replacement account.
8. On return, show the profile and plan; paid users can start a fresh check-in using
   saved structured memory. Do not reopen a historical transcript.

The main destinations are Coach, My plan and Profile; paid progress is visible within
the plan or a dedicated progress view after mobile usability testing. Use one-column
layouts, readable type, large controls and keyboard-safe composers. Show the next
useful action before long explanation. Support desktop without compromising phones.

## The persistent care profile

| Record | Required meaning |
|---|---|
| Concern | Specific user-reported problem; area, onset/duration when supplied, relevant observations, current status |
| Goal | Desired outcome and the user's own description of what improvement means |
| Current routine | Reported products, habits and relevant environment; unknowns remain unknown |
| Constraints | Reported sensitivities, limitations, budget, effort and preferences |
| Working understanding | Hypotheses, their supporting facts and unresolved questions; never saved as confirmed diagnoses |
| Plan | Accepted version, selected actions, rationale, evidence references, timing, review criteria and limitations |
| Outcome | Dated user-reported completion, observation, reaction or difficulty, linked to an action/version where possible |

Facts need a stable ID, source kind, confirmation status, observed/reported date and
revision history. Preserve conflicts for clarification rather than silently overwriting
them. A recommendation, hypothesis or generated summary is not a user-reported fact.
Users can inspect, correct and remove what Revana remembers. Collect only information
needed for the stated goal; do not turn the profile into an unsolicited medical record.

## Conversation lifecycle and model context

Conversation text is temporary working context. Extract structured candidate facts and
short coaching notes, validate them, and request confirmation of consequential changes.
The confirmed profile and notes support the next session. Notes must summarize relevant
decisions and unknowns, not reproduce a hidden transcript or invent new information.

After a successful consolidation, delete superseded raw turns from active application
storage. Apply bounded expiry to abandoned sessions and failed extractions as well.
Choose and document the exact expiry before implementing this lifecycle. Do not delete
the raw turn on a failed write and claim its facts were saved. Never retain raw text in
analytics, logs, exports, traces or routine backups of temporary conversation storage.
Account for browser state, streaming buffers, retries and temporary stores too.
Provider retention and historical backups are separate from application deletion.

Migration of existing journeys must be explicit: review extracted facts, preserve
accepted plans and actual outcomes, then remove raw answer events after successful
conversion. Do not silently treat all legacy text as confirmed profile facts. Configure
backup handling and document any residual retention before making deletion claims.

Build an explicit, bounded context package for each LLM request:

1. Versioned Revana role instructions and the current task.
2. Relevant confirmed profile facts and essential constraints.
3. Clearly separated hypotheses, unknowns and concise validated coaching notes.
4. Current accepted plan and relevant structured outcomes, when applicable.
5. A small temporary recent-turn window and the user's current message.
6. Output language and allowed capabilities for this stage.

Do not send a whole database record, unrelated history, email, payment details, access
tokens or API secrets to the model. Store privacy-safe prompt/model/schema version
metadata for reproducibility. Billing and authorization are enforced by application code.

## Coaching instructions, evidence and quality

Create `backend/app/prompts/coach.md` during implementation as the versioned source for
product role, concise tone, question selection, memory rules, plan structure, evidence
standards and professional-assessment boundaries. Keep it separate from developer
instructions in `AGENTS.md`. Use small task templates for discovery, extraction, planning
and review. Treat user input and retrieved material as untrusted data.

Each planned action must explain its connection to profile facts, what to do, feasible
timing/effort/cost, what outcome to observe, review timing, limitations and relevant
stop/escalation conditions. Start small enough to determine what helped.

Build a reviewed evidence registry with real source identifiers, claims, applicable
contexts, limitations and review dates. Retrieve relevant entries and validate output
citations against that registry. Do not generate citations, efficacy percentages or
confidence labels without a defensible basis. Define what is permitted when evidence
is insufficient; ask for clarification or explicitly limit guidance rather than invent it.

Evaluate a high-capability model for discovery and planning using synthetic cases before
selecting the production default. Compare grounding, usefulness, questioning, memory
accuracy, safety, readability, latency and cost. Keep the model server-configurable and
versioned. A flagship model alone does not establish domain expertise. Verify project
access securely at implementation time; never request API keys in chat.

## Free plan and paid continuing coaching

| Capability | Free initial experience | Paid continuing coaching |
|---|---|---|
| Initial assessment, profile confirmation and full starting plan | Included | Included |
| Read existing profile/plan, correct/remove facts, export/delete data | Included | Included |
| Dated progress and observation tracking | No ongoing tracking | Included |
| Follow-up coaching and personalized plan revisions | No ongoing coaching | Included within disclosed usage limits |
| Basic response to a reported adverse reaction or urgent concern | Never blocked by checkout | Never blocked by checkout |

Persisting an initial profile is distinct from recording longitudinal progress. Correcting
a profile does not automatically generate a new free plan. Do not interpret unpaid user
input as a paid progress record or secretly discard a paid mutation while showing success.
Explain subscription status and available actions clearly.

Use one subscription initially, with clear price, billing cadence and usage allowance.
Implement hosted checkout, verified/idempotent webhooks, server-side entitlements,
cancellation, failed-payment handling and a billing portal. Checkout redirects alone
never grant access. Cancellation must not hide existing plans or prevent export/deletion.
Select price, provider and treatment of expired subscriptions before the billing slice;
do not hardcode assumed commercial or tax terms into the model.

## Hosted, regional and language foundations

Keep the React/FastAPI monorepo and generated OpenAPI/client contracts. Replace local
capability-only access and SQLite with secure guest/account sessions, per-resource
ownership, durable hosted Postgres and migrations before public use. The current local
deployment restriction stays until those controls pass their release gates.

Implement recovery through verified email, guest-to-account linking and revocation;
internal user IDs are identifiers, not credentials. Protect sensitive profile data and
define consent, retention, deletion, backups and vendor handling before real-user beta.
Existing Auth0 direction is the starting point; verify guest-linking and email flows
before committing to a provider-specific implementation. Any change needs an explicit
architecture decision, not an incidental frontend dependency.

Store locale, country, timezone, currency and units separately. Externalize UI strings;
English is acceptable initially, Swedish and further translations can follow. Country
can inform climate, practical availability and examples but is not evidence of a user's
personal habits. Voice can later feed text into the same profile and context pipeline;
raw audio retention is not required by this design.

## Success and delivery discipline

Measure assessment completion, perceived plan usefulness, profile correction frequency,
evidence validity, paid conversion, successful follow-up, and cost per useful plan.
Use privacy-safe events without recording concerns or message content in analytics.

Implement in the small checkpoints listed in [agent-roadmap.md](agent-roadmap.md).
Each checkpoint gets relevant validation, a focused commit and a GitHub push. Prefer
reviewable pull requests per coherent slice; do not collect unrelated work in one large
commit. A push is not authorization to merge or deploy. Update current-state docs as
each slice lands; never present a planned feature as shipped.


## Optional questionnaire photos and restarting (2026-11-05)

Relevant product, skin and hair/scalp questions may offer up to three optional JPG,
PNG or WebP photos. Choices, text, photos or combinations are accepted; nonvisual
questions still need text/choices or an explicit skip. Images are context, not a
clinical assessment. Questions adapt to the user’s replies. The user must review,
correct or discard visual observations before the next question or plan generation.
Notes remain distinct from reported symptoms, routines and causal hypotheses.

Photos are re-encoded from pixels to remove metadata, sent to the configured OpenAI
model only after explicit photo consent, and not written to journey storage, exports
or image files by the app. Reviewed notes and photo counts are saved. Provider retention
is separate. This does not implement the broader care-profile/raw-chat retention work.

Profile settings are reachable from the dashboard header and My plan. Delete profile
& start over requires confirmation, deletes this journey from the local backend,
forgets its browser token, and returns to direction/goals and a new assessment.
Deletion does not remove existing exports, backups or previously transmitted provider data.


### Update: selective photo answers (2026-11-08)

The generated question's photo_mode now controls whether the browser offers a photo
answer. The LLM defaults to none and chooses products, skin or hair only when an
image can materially help answer that particular question. Duration, sensations,
history, diet, budget and preferences do not show an upload option. Existing/legacy
questions with none also hide it. Visual questions retain optional photos, explicit
consent, temporary processing and review of observations. No extra LLM call is needed:
this decision is part of generating each adaptive question. The backend still accepts
previously prepared photo answers from older clients, preserving consent and review.

### Hosting configuration update

The GitHub deployment layout is now one Vercel Services project with Vite and FastAPI
services under the repository root, sharing same-origin `/v1` routing. This replaces
the earlier two-project layout; the hosted identity, storage and operational gates
still apply. Configuration details are in [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md).
