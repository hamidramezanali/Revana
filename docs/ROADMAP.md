# Implementation Roadmap

All milestones are proposals. The RenevaAI folder was empty at inspection; source code, design exports, dependencies, cloud accounts and deployments are not present. Do not skip milestones or mark work done from visual mocks alone. Requirement IDs refer to `PRODUCT_SPEC.md`.

**Progress note (2026-10-24):** A new frontend-only prototype was created in `src/app/page.tsx` and styling in `src/app/globals.css`. It demonstrates the onboarding-to-dashboard journey with in-memory state and synthetic content. This is a review artifact, not a completed MVP, evidence-reviewed plan, or production-ready app. See architecture prototype boundary.

## Milestone 0 — Requirements and design alignment (visual exploration is underway)

**Scope:** Add the Figma/export assets; confirm dry-hair MVP, adult-only assumption, launch language/region and safety boundaries. Review name candidates but do not commit to a brand.

**Acceptance criteria:**
- Design assets are in the project or a documented source link is supplied; screens and reusable visual tokens are inventoried.
- One dry-hair synthetic user journey and its adaptive question branches are agreed.
- Confirmed product decisions and unresolved risks are recorded in `PRODUCT_SPEC.md`.
- No application code, dependencies, or real personal data are required for this milestone.

**Current state:** A coded visual direction exists for the user to review, but no Figma assets have been supplied and the product/visual choices are not approved. The criteria are not complete.

## Milestone 1 — Foundation and secure identity

**Scope:** Create Next.js/TypeScript app, base responsive design tokens/components from supplied design, Supabase Auth SSR setup, migrations, RLS, CI skeleton.

**Acceptance criteria:**
- Clean checkout builds and CI runs lint/typecheck/unit tests.
- Protected page and API both verify identity; unauthenticated requests fail.
- Database user A cannot read/write/reassign user B data; RLS tests cover grants and all operations.
- Secrets are not in source/client bundle; `.env.example` contains placeholders only.

## Milestone 2 — Resumable dry-hair onboarding

**Scope:** Goal/free text, exact/range/no deadline, relevant dry-hair problem/routine/products/preferences/safety fields, skip/resume and answer provenance states.

**Acceptance criteria:**
- A signed-in user can pause, reload, and resume their onboarding.
- Confirmed, skipped, and unanswered are separate values and drive distinct logic.
- Hair-only flow asks no unrelated skin/fitness sections; no duplicate preference questions.
- Exact deadline can be changed; timeline explains dates without promising outcomes.
- E2E tests cover relevant branches and ownership.

## Milestone 3 — Deterministic analysis and reviewed dry-hair plan

**Scope:** Rule-based analysis of reported facts/hypotheses/unknowns; small reviewed evidence set; safe plan draft, priorities, explanations and actions.

**Acceptance criteria:**
- Analysis visibly separates reported information, hypothesis, and missing information.
- Every recommendation links to confirmed answer IDs and reviewed evidence metadata.
- Two/three initial priorities respect safety, time, budget, effort and preferences.
- Synthetic contrasting profiles produce different, explainable recommendations.
- Missing safety information limits specificity; no diagnostic, medication, or automatic supplement recommendation.
- Daily/weekly action, rationale, expectations, limitations, review timing and adverse reaction guidance render correctly.

## Milestone 4 — Structured AI proposals and grounded coach

**Scope:** Optional server-side AI for targeted follow-ups, analysis wording, plan draft and coach; structured Zod/OpenAI response schema; deterministic validation.

**Acceptance criteria:**
- API key stays server-side; provider sees only minimal, consented context.
- Refusal, timeout, rate-limit, unsupported schema/model, incomplete and invalid business result are handled visibly without saving unsafe output.
- Prompt injection inside product/user text cannot alter policy.
- AI cannot introduce unsupported evidence IDs or turn unconfirmed inference into persisted fact.
- Clearly labeled synthetic demo works without being represented as a live personalized result.

## Milestone 5 — Check-ins, progress and adaptation

**Scope:** Relevant non-punitive check-ins, action completion, feedback, adverse response handling, plan versioning and reviewed adjustment proposals.

**Acceptance criteria:**
- Check-in asks only relevant short questions.
- “Too difficult,” “no improvement,” and “reaction” each produce distinct safe handling.
- A plan adjustment is displayed for user review; accept/reject preserves prior version.
- Progress uses observations relevant to user's own goal, not arbitrary medical scores.

## Milestone 6 — Dashboard and hardening

**Scope:** Personalized dashboard, coach entry, alternatives/effort-impact, privacy controls, export/delete, accessibility, abuse controls, region and release review.

**Acceptance criteria:**
- Dashboard prioritizes a manageable number of actions and explains why they matter.
- User can adjust goal, date, routine, budget and preferences; downstream plan is versioned.
- Cross-user data/file tests, consent/deletion tests, no-sensitive-logging review, responsive/accessibility tests and full E2E pass in CI.
- Data processor terms, regions, retention, privacy copy and support/escalation ownership reviewed before real sensitive data.

## After the MVP — gated expansion

1. Skin/face and skincare routines after reviewed evidence and sensitivity/medication/pregnancy safety rules.
2. Fitness/body composition and energy/nutrition after scope and escalation review.
3. Optional professional treatments only with evidence, risk, recovery, cost and non-invasive alternatives; no automatic referrals or sales funnel.
4. Supplement information only with explicit evidence/safety/indication review; no automatic recommendation or dosage in MVP.
5. Private photos, labs, wearable/data-source integrations only after consent, access, storage, retention, deletion and model-processing decisions.

Native mobile, automated facial analysis, clinic marketplaces, commerce, social/community and agent frameworks remain deferred until user evidence justifies them.
