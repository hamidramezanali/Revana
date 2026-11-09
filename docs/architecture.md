> Current deployment update (2026-11-05): temporary public Vercel testing has been
> explicitly approved. Hosted mode now requires Postgres, supports same-origin API
> requests and preserves per-journey bearer access. Account sign-in and deployment
> privacy are deferred. This supersedes historical local-only/guard checkpoints below.
> See [the current deployment guide](VERCEL_DEPLOYMENT.md).

# Architecture decisions

Updated 2026-11-05. The table and runtime sections describe the implemented local
application. Planned product behavior is specified in [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md).

| Area | Current implementation | Hosted direction |
|---|---|---|
| Repo | `frontend/`, `backend/`, `contracts/` | Same |
| Backend | Python/FastAPI, versioned `/v1` API | Same |
| Frontend | React/TypeScript/Vite; merged mobile-responsive workflow | Mobile-first web; native/voice later |
| Hosting | Single-user local, loopback only | One Vercel Services project after hosted readiness |
| Access | Random per-journey bearer capability, hashed in database | Auth0 + ownership enforcement |
| Database | Local durable SQLite | Managed pooled EU Postgres + migrations |
| LLM | Server-side structured OpenAI Responses adapter | Reviewed guidance + evaluations |
| Data | Saved raw answers, accepted plan versions, pending proposal; export/delete | Care profile + structured outcomes; temporary raw turns; explicit retention |

## Adaptive agent

### Conversation-led coaching (2026-11-09)

The latest user message and selected answers lead the response; earlier goals and
plans are supporting context. Relevant constraints and safety rules remain active.
`POST /v1/agent/suggestions` now accepts an optional active question ID and selected
choice IDs, or a plain new message to change direction. It validates choices against
the saved question, and persists user messages, selected labels, explicit skips and
coach replies separately from accepted plans and completed actions. Only selected
answers reach model context; unselected question choices remain display metadata.
Conversation context also informs subsequent check-ins and proposed plan revisions.
A newer check-in takes precedence over an older chat message.

The structured coach reply can explain, ask a focused question, offer actions, or
combine them. Clarification-only replies preserve existing suggestions. More than
three alternatives are supported. Fixed assessment/check-in turn caps, question-option
caps, action-count caps and the old suggestion-round cap are removed; one question is
shown at a time. Request sizes, field lengths, provider timeout/output tokens and
revision checks still bound individual operations. This is not unlimited model capacity.
The Today, Coach and My plan screens expose the composer before action lists, with
selectable follow-ups, optional text, skip and a way to ask something else.

Replies explain the recommendation and its uncertainty in public-facing language;
private chain-of-thought is not requested or exposed. For unsafe or unrealistic
deadlines, the role guidance asks for direct acknowledgement, a brief explanation,
and practical safer alternatives rather than tracking-only advice. The
[NHS weight-management guidance](https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/tips-to-help-you-lose-weight/)
supports gradual weight loss and discourages sudden loss through diets. Prompt rules
and synthetic tests do not establish medical safety or live recommendation quality.

Conversation turns use the existing journey storage/export/delete lifecycle. This
checkpoint does not implement temporary-turn consolidation, expiry or payment gates.

### Goal-specific fit and editable answers (2026-11-09)

`POST /v1/agent/fit-options` uses the stated goals, description and recorded answers
to generate optional constraint labels and a relevant limitations hint. The frontend
no longer displays a fixed skin-oriented list for every goal. On failure, it offers
retry and optional text input. Generated labels remain possibilities, never profile
facts. Relevance is model-guided and requires live quality evaluation.

Answer events now retain an optional question snapshot for editing; older events
remain editable as text. Snapshots are removed from model context so unselected
choices are not treated as reports. An answer request with `event_index` edits only
the active unfinished cycle, drops dependent later answers, recounts the question
budget and generates a new next question. Validation/provider failures leave the
stored cycle intact. Editing replaces photo notes for that answer; raw photos cannot
be restored. Accepted plan history cannot be edited through this route. Fit/safety
has a Back to questions control before plan generation.

### Bokadirekt discovery investigation (2026-11-09; not implemented)

Public service listings can supply links for optional professional-service ideas.
A future search step should use a relevant service category and a user-provided town
or online preference, rather than sending private questionnaire answers to search.
Match listings to the actual request, budget and relevant constraints, link the
retrieved source, record retrieval time, and distinguish a listing from evidence of
effectiveness or verified professional qualifications. Do not invent availability,
prices or book appointments automatically. Failure to find a suitable service should
leave the ordinary plan useful.

The documented [Merchant API](https://external.api.portal.bokadirekt.se/index.html)
provides authenticated access to a merchant's own salon data; this investigation did
not establish a supported API for marketplace-wide discovery. Confirm partner access
with Bokadirekt before building a whole-marketplace API integration. Search and
outbound listing links are a separate possible implementation, not live booking.

Direction and goal selection lead to a consent step, then adaptive questions without
a fixed cycle or option quota. Fit/safety controls precede plan generation. The analysis
separates reported facts, hypotheses and uncertainties. Check-ins continue until enough
is known or the user finishes; proposed plan revisions still require acceptance.

The backend owns active-question IDs, input bounds and revision
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

## Vercel Services configuration

The repository-root `vercel.json` now declares backend (FastAPI) and frontend (Vite)
services on one project/domain. The frontend retains same-origin `/v1` requests;
ordered service rewrites preserve that prefix. FastAPI has an explicit `app.main:app`
entrypoint in its pyproject. This supersedes the earlier two-project hosting plan.
The startup guard and local SQLite runtime are unchanged: hosted execution remains
blocked until storage, authorization, request handling and upload limits pass their
gates. See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for exact setup and limitations.


## Postgres storage checkpoint

An optional psycopg adapter now persists journeys in `revana_journeys`, with packaged
initial migration, hashed capabilities and compare-and-swap revision writes. Neon’s
`DATABASE_URL` is accepted directly. Local SQLite remains available without a database
URL; remote Postgres uses TLS. Integration tests exercise the journey workflow on both
stores. Photo payloads fit within 4 MB total. The hosted runtime guard is still present:
the requested temporary public mode was rejected by automatic review and is pending
explicit approval. No deployment privacy settings have been changed.
