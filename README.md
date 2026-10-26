# Personalized Beauty & Lifestyle Coach

Planning workspace for **Revana**, a personalized beauty and lifestyle coaching app. Brand story: “Renew your routines. Reveal your potential.” This is brand positioning, not an ancient-language meaning. Keep the name configurable; trademark/domain clearance is pending.

## Current repository state

The folder initially contained planning documents only; it had no Figma export or existing application to preserve. A frontend-only interactive prototype is now present. Its minimal landing page uses “Your goals. Your lifestyle. Your transformation.” and one primary CTA, followed by multi-focus goal selection, per-focus follow-up questions, fact/hypothesis/unknown analysis, and a local dashboard with action tracking, plan rationale, feedback adjustments, and a deterministic coach demo. Hair has the most detailed routine questions; other categories currently demonstrate discovery and do not provide validated plans or health advice. This visual direction can be refined or replaced with a Figma import.

The prototype has no backend, authentication, AI provider, persistence, reviewed evidence store, or production safety validation. State exists only in React memory and resets on refresh. All sample recommendations are illustrative. Non-hair categories currently demonstrate discovery only; they are not validated advice plans. No real user or health data should be entered.

## Documents

- [Agent instructions](AGENTS.md)
- [Product specification and implementation tracker](docs/PRODUCT_SPEC.md)
- [System design and architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Implementation roadmap](docs/ROADMAP.md)

## Product approach

Start by understanding any of the user's selected goals, then ask relevant questions for each selected focus. Validate the cross-category discovery experience with synthetic users; keep the first evidence-backed recommendation journey narrow (dry hair) until reviewed evidence and safety rules exist for more categories.

## Proposed technical direction

A single Next.js App Router + TypeScript application, modular server endpoints, Supabase Postgres/Auth (RLS enforced), OpenAI Structured Outputs, Zod, Tailwind CSS, selective shadcn/ui, Vitest, Playwright, GitHub Actions, and Vercel. This is a recommendation, not an implemented or locked stack. Verify current provider/model capabilities, regional requirements, data-processing terms, and deployment compatibility before handling real user data.

## Naming and visual assets

Revana is the configurable working name. Its brand story is “Renew your routines. Reveal your potential.” This is brand positioning, not an ancient-language meaning. Trademark/domain clearance is pending. Figma assets have not been supplied in this folder. Do not claim visual fidelity to an absent design or name availability before documented preliminary checks and professional clearance.

## Next step

The user-approved entry direction is a minimal welcome page: “Your goals. Your lifestyle. Your transformation.” and one “Begin your journey” CTA, without a hero graphic, sample-plan action, or extra intro copy. Next, validate the multi-focus question sequence and mobile accessibility; then decide whether to keep refining this UI or import Figma. Add reviewed evidence, safety/business rules, authentication, persistence, tests, and server endpoints only through approved roadmap milestones. No deployment has been configured.

The current interface uses a compact mobile-first flow: optional onboarding details are collapsed, primary onboarding actions stay reachable, dashboard navigation sits at the bottom on phones, and text/state labels do not rely on color alone. It has been checked for horizontal overflow at common phone CSS widths, but still needs real-device, keyboard, landscape, and formal contrast/accessibility testing.

The onboarding lets users select one or several focus areas and shows a relevant follow-up panel for each. Hair has the most detailed routine questions; other categories demonstrate discovery only and do not provide validated plans or health advice. On navigation, views return to the top with reduced-motion support.

The frontend journey starts with a category-neutral **Begin your journey** action. Users can select one or multiple focus areas and answer a relevant follow-up for each. Hair has additional routine questions; other categories demonstrate discovery only and do not generate validated plans or health advice.
