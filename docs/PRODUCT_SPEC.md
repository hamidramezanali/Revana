# Product Specification & Implementation Tracker

**Product name:** Revana is the selected working name for the prototype; configurable and not legally cleared. Brand story: “Renew your routines. Reveal your potential.” This is original brand positioning, not an ancient-language etymology.  
**Audience:** Adults seeking individualized appearance and lifestyle improvements. Adult-only scope is an assumption to confirm before launch.  
**Specification state:** Planning baseline, updated 2026-10-24. A frontend-only prototype now demonstrates part of the dry-hair journey. Figma/export assets, backend, authentication, persistence, reviewed evidence integration, and production validation are still absent. A visual control alone does not satisfy a requirement's full acceptance criteria.

## How to maintain this register

Every requirement has an ID, status, and testable acceptance criteria. Update status only with evidence. `Implemented` means the behavior works and its acceptance criteria have been verified by tests or documented manual checks; a mock screen alone does not qualify.

Statuses: `Not started` · `In progress` · `Implemented` · `Blocked` · `Deferred`.

Update the status and evidence note in the same change that completes work. If a requirement changes, revise this document and `SYSTEM_ARCHITECTURE.md` together. Keep the MVP small; use milestone order in `ROADMAP.md`.

## A. Product purpose and principles

| ID | Requirement | Status | Acceptance / verification |
|---|---|---|---|
| P-001 | Understand user and routines before recommending interventions. | Not started | A plan cannot be generated from selected goal alone; it draws on relevant user-confirmed answers. |
| P-002 | Recommendations must explain personal relevance, evidence, uncertainty, risks, effort, cost, expectations, and review timing. | Not started | Every saved recommendation has the required fields and links to answer/evidence IDs. |
| P-003 | Personalization before recommendations; evidence before marketing; practical interventions before complexity; user choice before sales pressure; safety before optimization; progress over perfection. | Not started | Product copy, rules, and tests reflect these principles; no shame or coercive language. |
| P-004 | Clearly differentiate reported facts, AI hypotheses, confirmed inferences, and missing/skipped information. Never imply passive monitoring without an authorized data source. | Not started | Analysis labels provenance and never invents activity/sleep/nutrition observations. |
| P-005 | Keep Revana branding configurable and avoid representing the name as legally cleared. | In progress | Name and brand story are centralized in `src/config/brand.ts`; legal and domain clearance is not complete. |

## B. Naming and brand discovery

| ID | Requirement | Status | Acceptance / verification |
|---|---|---|---|
| N-001 | Generate at least 10 additional short, pronounceable EN/SV, international candidates suitable for beauty and wider personal development. | Not started | Candidate list exists with pronunciation, concept, and risk notes. |
| N-002 | Compare five strongest candidates and propose one provisional favorite without representing it as cleared. | Not started | Table covers meaning, pronunciation, brand potential, and conflict risk; final naming remains configurable. |
| N-003 | Conduct documented preliminary searches for app stores, brands, PRV, EUIPO/WIPO and domains/social handles for promising candidates. | Not started | Dated search log records query, database, result/link, and ambiguity for each shortlist candidate. No availability guarantee. |
| N-004 | Obtain professional trademark/legal clearance before committing to a name. | Deferred | Clearance is recorded by qualified counsel; general web searches are never represented as legal clearance. |

**Draft naming seeds (not searched):** Aretia, Eunoia, Aevia, Eloria, Velora, Auralis, Althea, Orelia, Novara, Virelle, Solenne, Elaris. These are brainstorming only; some may already be used. `Arete` and `Eunoia` were user-suggested directions and are not counted as additional candidates. Naming search and shortlist are pending; no candidate is claimed available.

**Illustrative shortlist for the next research pass (not yet verified or cleared):**

| Candidate | Intended meaning / direction | Approximate EN/SV pronunciation | Brand potential | Potential conflict risk / screening state |
|---|---|---|---|---|
| Aretia | Inspired by Arete: excellence and realizing potential | ah-REE-tee-ah | Greek-inspired, aspirational, broad enough for lifestyle | Similarity to Arete and existing Aretia/Aretia-like marks is unsearched; check health/beauty classes and app names. |
| Eunoia | Beautiful thinking, goodwill, considered self-care | you-NOY-ah | Distinctive, thoughtful, premium | Pronunciation/spelling may be less intuitive in Swedish; existing use and marks unsearched. |
| Aevia | Invented, intended to suggest evolution and a new path | AY-vee-ah | Short, modern, flexible beyond beauty | Highly uncertain: coined names can still overlap with existing brands/domains; all databases unsearched. |
| Velora | Invented, intended to evoke vitality and radiance | veh-LOR-ah | Easy to say, polished, broad | Similar-sounding wellness/beauty brand or product risk unknown; all databases unsearched. |
| Eloria | Invented, intended to evoke a personal journey and luminous well-being | eh-LOR-ee-ah | Soft, editorial, broad | Similarity to existing names and domain/social availability unknown; all databases unsearched. |

**Naming update:** The user selected **Revana** as the working product name, replacing Reneva and the earlier Aretia concept. Brand story: **“Renew your routines. Reveal your potential.”** This is a brand narrative, not a claim about the word's historical or ancient-language origin. The candidate list and shortlist above are historical brainstorming, not endorsements. Revana has not been screened. Complete N-003 searches and professional clearance before public commercial use; do not imply availability.

## C. Experience and responsive design

| ID | Requirement | Status | Acceptance / verification |
|---|---|---|---|
| UX-001 | Premium, contemporary, mobile-first app with polished desktop support and accessible controls. Warm neutrals, refined type hierarchy, restrained accents, whitespace, clear grouping, subtle motion. | In progress | Prototype tokens/responsive styling in `src/app/globals.css`; complete device and accessibility verification remains. |
| UX-002 | Avoid excessive pink, childish wellness tropes, generic stock imagery, clinical look, arbitrary precision scores, visual clutter, and shame. | Not started | Design review against these constraints and copy review. |
| UX-003 | Complete journey from welcome through personalized first plan and dashboard; controls must perform distinct useful actions. | In progress | A local journey exists in `src/app/page.tsx`; no automated E2E verification and several production capabilities are absent. |
| UX-004 | Provide “why this recommendation?”, alternatives, effort-vs-impact explanation, review/adjust, and non-punitive missed-action handling. | In progress | Prototype shows rationale, simplified action set, and feedback adjustments; effort-vs-impact comparisons and validated alternative plans remain. |
| UX-005 | Use realistic synthetic examples and clearly label demonstration mode when AI is simulated. | In progress | The UI labels local prototype/demo behavior and uses fictional example content; coverage/copy review remains. |
| UX-006 | Mobile-first use on 320–430px phone viewports: avoid horizontal scrolling, keep primary actions reachable, use comfortable touch targets, respect safe areas, and minimize unnecessary page length. | In progress | Implemented safe-area-aware fixed onboarding actions and bottom navigation, collapsed optional questions, and compact mobile rules. Browser checks at 320/360/390/430 CSS px show no horizontal overflow; onboarding CTA is fixed and 44–46px high; dashboard uses a 48px bottom nav and hides secondary summary cards from Today. Verify actual viewport/orientation, keyboard overlap and device behavior before completion. |
| UX-007 | Readable, accessible information that never depends on color alone. Text and controls maintain sufficient contrast; category, status, selection, and safety meanings also use clear text, shape, icon, or patterns. | In progress | Increased contrast/type sizes, 16px controls, “Coming later” labels, selected checkmarks and selected chip checks. Still requires a formal WCAG contrast audit and keyboard/screen-reader verification. |
| UX-008 | Navigation between onboarding stages, analysis, dashboard sections and selected-focus question panels should return the relevant view to its beginning smoothly; honor reduced-motion settings and avoid hiding focused controls behind sticky UI. | In progress | Scroll-to-top behavior added for screen/stage/dashboard changes and reduced-motion is respected. Verify keyboard focus and mobile sticky-header interactions. |
| UX-009 | Use a consistent responsive type scale: comfortable body and control text, legible labels and supporting copy, and display headings that do not crowd the primary action. Keep copy concise and reveal optional detail progressively. | In progress | Input text is 16px to avoid mobile browser zoom; contrast and label sizes were raised. Full screen-by-screen typography review remains. |

## D. Onboarding and adaptive questions

| ID | Requirement | Status | Acceptance / verification |
|---|---|---|---|
| ONB-001 | Minimal, welcoming entry page with the headline “Your goals. Your lifestyle. Your transformation.” and one primary “Begin your journey” CTA; no hero graphic, sample-plan CTA, or filler copy. | In progress | Simplified entry page implements the specified headline and single CTA; verify mobile/desktop layout and user review. |
| ONB-002 | Flexible timeline: exact date, approximate range/timeframe, or no deadline; distinguish event deadline, long-term goal, and ongoing journey. | In progress | UI offers date/range/no deadline and date editing; remaining-time calculation and date-aware feasibility are not implemented. |
| ONB-003 | Let users choose one or multiple broad focus areas (face/skin, hair, body/fitness, health/energy/lifestyle, other) and describe concerns in their own words. | In progress | All five categories are selectable, free-text context is available, and choice cards are usable on mobile; category-specific plan claims are not implemented for all goals. |
| ONB-004 | Ask relevant follow-up questions for each selected goal; avoid irrelevant or repeated questions. | In progress | Focus-specific prompts are implemented; on Continue the flow advances to the next unanswered selected focus, with optional extra context and explicit skip. Hair-specific routine details appear only when Hair is selected. Validate every category, answer/skip behavior, returning to prior focus, and multi-goal sequencing. |
| ONB-005 | Understand the experienced problem, timing, change/history, existing attempts, triggers and user observations. | Not started | Branch questions are relevant and avoid assuming a cause. |
| ONB-006 | Reconstruct actual routine and lifestyle instead of asking only users to identify bad habits. | In progress | Prototype collects a limited hair routine and product details; lifestyle reconstruction is not part of dry-hair scope yet. |
| ONB-007 | Learn existing products/routines before proposing new products; collect budget, effort, treatment comfort and intervention preferences once. | In progress | Prototype collects product text, time, budget and approach preference; treatment safety and persisted profile behavior are absent. |
| ONB-008 | Save and resume onboarding; allow optional skip and later return. Keep unanswered, skipped, and confirmed distinct. | Not started | Reload/resume preserves answers and states; conditional logic handles each state differently. |
| ONB-009 | Contextual safety questions only when relevant: allergy, sensitivity/reaction, conditions, medications, supplements, pregnancy/breastfeeding, labs or clinical advice where relevant. | In progress | Prototype asks only a limited sensitivity question and displays a scope disclaimer; safety gates and escalation are not validated. |
| ONB-010 | Optional product name entry/photo upload only when useful; explicit informed consent, private access, retention/deletion plan before photos. | Deferred | No photo collection in MVP; feature requires approved privacy/storage design before enabling. |

## E. Analysis and recommendation engine

| ID | Requirement | Status | Acceptance / verification |
|---|---|---|---|
| REC-001 | Intermediate “connect the dots” analysis: user goal, reported information, hypotheses/opportunities, unknowns, and targeted follow-up when material information is missing. | Not started | Facts, inferences, and gaps have distinct labels and provenance. |
| REC-002 | Application logic owns required topics, completion criteria, safety gates, category scope, and allowed recommendation rules. | Not started | Rule tests prove unsafe or ineligible AI proposals cannot be saved. |
| REC-003 | AI interprets free text and proposes follow-ups/recommendation drafts using structured outputs; business logic validates before saving. | Not started | Schema-valid but business-invalid output is rejected; non-JSON/refusal/timeout is handled. |
| REC-004 | Recommendations reflect goal, current routine/products, constraints, preferences/budget, safety, timeline, evidence strength, and previous feedback. | Not started | Contrasting synthetic profiles produce meaningfully different reasons/actions. |
| REC-005 | Every recommendation states what/how/how often where appropriate, why for this user, expected outcome, assessment timeframe, risks/limits, source IDs, related answer IDs, and review timing. | Not started | Required fields enforced; unsupported or unlinked recommendation fails validation. |
| REC-006 | Prioritize a few actions by expected benefit, safety, practicality, cost, relevance and evidence; avoid unrelated tip dumps. | Not started | User sees two or three initial priorities, with alternatives available on request. |
| REC-007 | Be realistic about deadlines and uncertainty; no guaranteed or dramatic rapid outcomes. | Not started | Date-aware plans distinguish feasible short-term steps from longer-term outcomes. |
| REC-008 | Track prompt, knowledge, policy/rules, and plan versions for reproducibility. | Not started | Saved plan identifies the versions and source set used. |
| REC-009 | Product-label text, uploaded content and user text are treated as untrusted input, not model instructions. | Not started | Prompt-injection tests cannot override system constraints or business rules. |

## F. Initial MVP: dry-hair journey

| ID | Requirement | Status | Acceptance / verification |
|---|---|---|---|
| HAIR-001 | Complete dry-hair goal through personalized plan, daily/weekly actions, feedback and adaptation. | Not started | Synthetic end-to-end profile completes all steps with a coherent personalized plan. |
| HAIR-002 | Ask relevant details: dryness location/timing, wash cadence, shampoo/conditioner/mask/leave-in, heat/bleach/dye, recent changes, breakage/shedding, budget, time and preferences. | Not started | Questions adapt; no unrelated goals are required. |
| HAIR-003 | Consider current routine before product/treatment escalation; explain possible contribution as a hypothesis, not fact. | Not started | A profile reporting frequent clarifying shampoo, high heat and little conditioner gets a reasoned routine-review-first plan; alternative profiles differ. |
| HAIR-004 | Explain product ingredient roles/categories rather than promoting brands; distinguish cosmetic conditioning/softness from repair or growth claims. | Not started | Plan does not claim oils repair all damage or guarantee growth; product rationale is clear. |
| HAIR-005 | Nutrition/supplement questions only when relevant; no automatic supplement advice; flag appropriate professional assessment for concerning shedding/symptoms. | Not started | No indiscriminate iron, vitamin D, omega-3, collagen or other supplement recommendation; safety tests pass. |
| HAIR-006 | Define progress review around softness, breakage, manageability/appearance and user feedback without promising fast dramatic results. | Not started | Review timing and useful observations are included; user can report no effect/reaction. |

## G. Future category expansion (not MVP)

| ID | Requirement | Status | Acceptance / verification |
|---|---|---|---|
| EXP-001 | Skin/face: investigate concern, sleep/stress only where relevant, sensitivity, existing routine, products/actives/prescriptions and reactions before advice. | Deferred | Dedicated reviewed question/evidence set and safety rules before activation. |
| EXP-002 | Fitness/body composition: understand goals, current activity, constraints, preferences, energy and barriers; create manageable plan. | Deferred | No aggressive or universal prescription; health warning escalation is defined. |
| EXP-003 | Energy/nutrition: understand typical routine, restrictions, allergies, relevant energy patterns; avoid diagnosis and unsupported claims. | Deferred | Clinical symptoms route to appropriate assessment; no restrictive diet or medical claims. |
| EXP-004 | Professional treatments: optional, relevant discussion of benefits, non-goals, recovery, cost where verified, risks, contraindications, alternatives, and qualified assessment. No automatic clinic/salon referral. | Deferred | Reviewed evidence and safety policy per treatment before this category goes live; no sales pressure. |
| EXP-005 | Laboratory interpretation and data-source integrations. | Deferred | Requires separate clinical/safety review, explicit consent, source/context display and privacy architecture. |
| EXP-006 | Supplements, medication interaction checking, diagnosis, prescribing. | Deferred | Diagnosis/prescribing out of product scope; no claim of complete interaction checking. Supplement info needs clinical/evidence review and indication/safety gates. |

## H. Plan, actions, dashboard, and coach

| ID | Requirement | Status | Acceptance / verification |
|---|---|---|---|
| PLN-001 | Plan includes starting point, 2–3 priorities, personalized routine, product/ingredient rationale when relevant, lifestyle only if relevant, optional professional layer, expectations, and next review. | In progress | Prototype shows rule-based action cards and answer-linked rationales; evidence, full expectations, and validated recommendations are absent. |
| PLN-002 | Provide manageable daily and weekly actions, completion/skip/not-applicable tracking, no guilt or streak pressure. | In progress | In-memory completion toggle and non-punitive copy exist; skip/not-applicable and persistence are absent. |
| PLN-003 | Check-ins ask only relevant short questions about adherence, outcome, difficulty and adverse response. | In progress | Prototype includes four feedback choices, including reaction; targeting and validated escalation remain. |
| PLN-004 | Version plans and explain material changes; user reviews AI-proposed changes before applying. | In progress | Feedback can change the local preview after a user action; version history and AI proposal review are absent. |
| PLN-005 | Dashboard shows today’s manageable priorities, plan by category/cadence, “why it matters,” relevant progress/insights, coach entry, and review/adjust. | In progress | Prototype dashboard provides these as local UI sections; automated behavior tests and persistence remain. |
| PLN-006 | Coach chat uses structured confirmed profile and active plan as source of truth; history is secondary supporting context. | In progress | Deterministic local canned responses use current profile values; no AI, structured profile backend, or authority tests. |
| PLN-007 | Alternatives support lower budget, time, effort, at-home preference or treatment comfort. | In progress | Local feedback can simplify to fewer actions; explicit alternative comparison and preference-based validated options remain. |
| PLN-008 | Optional progress photos require explicit consent and clear access/deletion controls. | Deferred | No photo feature in MVP; enable only after privacy review and private object authorization tests. |

## I. Safety, evidence, privacy, and security

| ID | Requirement | Status | Acceptance / verification |
|---|---|---|---|
| SAFE-001 | No diagnosis, medication prescribing, automatic supplements, or presentation of general wellness content as medical advice. | Not started | Unit and E2E tests reject prohibited recommendation types. |
| SAFE-002 | Missing safety information limits specificity; support escalation for concerning symptoms/adverse reactions. | Not started | Branch tests show an appropriate pause/stop and professional-assessment route. |
| SAFE-003 | Use reviewed guidance; cite real source metadata; do not fabricate evidence or imply comprehensive interaction checking. | Not started | Each evidence-backed recommendation resolves to reviewed source ID/version; unknown evidence is explicit. |
| SAFE-004 | Explicit consent and disclosure for AI processing and external providers; user can withdraw consent and delete/export account data. | Not started | Consent state is checked server-side; deletion/export flow is tested. |
| SAFE-005 | API keys are server-only; no secrets in client bundles/logs/repository. | Not started | CI secret scan and build inspection; all provider calls occur server-side. |
| SAFE-006 | Per-user ownership enforced in database RLS and backend authorization; private uploads only if approved. | Not started | Cross-user read/write and object access tests deny access. |
| SAFE-007 | Minimize sensitive logs and retention; use synthetic development and test data. | Not started | Logging review confirms no raw sensitive payloads; fixtures are synthetic. |
| SAFE-008 | Document data controller/processor, retention, hosting region, subprocessors, and deployment/privacy limits before real user data. | Blocked | Requires jurisdiction and commercial/privacy decisions; do not claim compliance until reviewed. |

## J. Platform, quality, and release readiness

| ID | Requirement | Status | Acceptance / verification |
|---|---|---|---|
| ENG-001 | One modular application initially; frontend and backend boundaries clear; avoid unnecessary services/agent frameworks. | Not started | Folder structure follows `SYSTEM_ARCHITECTURE.md` or documented deviation. |
| ENG-002 | Build mobile-first, accessible web app; native mobile is deferred. | Not started | Responsive visual checks and accessibility tests pass. |
| ENG-003 | Unit, API/integration, database RLS and Playwright E2E coverage. | Not started | Required test scenarios in architecture/roadmap run in CI. |
| ENG-004 | GitHub Actions validates lint/typecheck/unit/API/RLS/E2E/build using synthetic data. | Not started | CI required checks pass on a clean checkout. |
| ENG-005 | Vercel deployment with approved region near Supabase; secrets and preview environments handled safely. | Not started | Deployment reviewed for region, cache/session leakage, environment separation and access controls. |
| ENG-006 | Native apps, wearable integration, facial automation, lab interpretation, clinic marketplaces, commerce and community are deferred. | Deferred | Revisit only after validated MVP and explicit product decision. |

## K. Decision log / unresolved decisions

| Decision | Current default | Status / impact |
|---|---|---|
| App name | Revana; configurable working name | Selected for prototype; brand story is “Renew your routines. Reveal your potential.” Trademark/domain screening and clearance remain open. |
| First experience | Multi-goal discovery; first evidence-backed recommendation journey is dry hair | Current prototype offers discovery prompts for all five focus areas; non-hair advice/plans remain out of scope until evidence and safety gates are reviewed. |
| Audience age | Adults only | Assumption to confirm; affects onboarding, safety, consent and legal review. |
| Language/launch region | English first, region TBD | Open; affects evidence sources, localization, data residency and provider selection. |
| AI/data processing | User-consented, minimal context to server-side OpenAI integration | Proposed; confirm provider terms, budget, user disclosure and model availability. |
| Persistence | Save profile, answers, plans and check-ins; no chat/photos by default until justified | Proposed; retention/deletion details must be decided before launch. |
| Authentication | Supabase Auth from first persisted personal profile | Proposed; required for per-user cloud storage. |
| Hosting | Vercel + Supabase with co-located approved region | Proposed; residency and processor contracts unresolved. |
| Existing Figma/source | Not present in RenevaAI folder at inspection | Blocker to visual-parity work; add assets before UI build. |
| Git remote | User supplied https://github.com/hamidramezanali/RevenaAI.git | Not configured in inspected folder; repository spelling differs from local RenevaAI folder. Verify intended destination before pushing. |
