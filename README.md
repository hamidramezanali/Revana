# Personalized Beauty & Lifestyle Coach

Planning workspace for **Reneva**, a personalized beauty and lifestyle coaching app. Reneva is the user's chosen working name; keep it configurable and do not imply trademark or domain clearance.

## Current repository state

The folder initially contained planning documents only; it had no Figma export or existing application to preserve. A frontend-only interactive prototype is now present. It has a responsive landing page, four-step dry-hair onboarding, fact/hypothesis/unknown analysis, and a local dashboard with action tracking, plan rationale, feedback adjustments, and a deterministic coach demo. This visual direction can be refined or replaced with a Figma import.

The prototype has no backend, authentication, AI provider, persistence, reviewed evidence store, or production safety validation. State exists only in React memory and resets on refresh. All sample recommendations are illustrative. Other categories are disabled previews. No real user or health data should be entered.

## Documents

- [Agent instructions](AGENTS.md)
- [Product specification and implementation tracker](docs/PRODUCT_SPEC.md)
- [System design and architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Implementation roadmap](docs/ROADMAP.md)

## Product approach

Start with one complete, personalized dry-hair journey that demonstrates the product principle: understand the person, investigate their routine and constraints, explain uncertainties/opportunities, and provide a practical, reviewable plan. Expand into other categories only after the safety model and evidence approach are validated.

## Proposed technical direction

A single Next.js App Router + TypeScript application, modular server endpoints, Supabase Postgres/Auth (RLS enforced), OpenAI Structured Outputs, Zod, Tailwind CSS, selective shadcn/ui, Vitest, Playwright, GitHub Actions, and Vercel. This is a recommendation, not an implemented or locked stack. Verify current provider/model capabilities, regional requirements, data-processing terms, and deployment compatibility before handling real user data.

## Naming and visual assets

The app name and Figma assets have not been supplied in this folder. Names in the specification are unsearched creative candidates, not availability findings or legal clearance. Do not imply a name is available until the documented preliminary checks and professional clearance are complete.

## Next step

Run the local prototype with `npm install` and `npm run dev`, then review the visual direction and user journey. If approved, decide whether to refine this prototype or replace its presentation layer with the Figma import. Add reviewed evidence, safety/business rules, authentication, persistence, tests, and server endpoints only through approved roadmap milestones. No deployment has been configured.

The current interface uses a compact mobile-first flow: optional onboarding details are collapsed, primary onboarding actions stay reachable, dashboard navigation sits at the bottom on phones, and text/state labels do not rely on color alone. It has been checked for horizontal overflow at common phone CSS widths, but still needs real-device, keyboard, landscape, and formal contrast/accessibility testing.
