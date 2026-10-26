# Revana Frontend Project

This repository is the Revana frontend only. The backend will be developed and deployed as a separate project and repository. Do not add backend services, database credentials, or LLM provider secrets to this frontend.

## Product direction

- Improve the frontend gradually, preserving a clear, calm, mobile-first experience.
- Keep user-reported information distinct from generated suggestions and planned actions.
- Treat completion, skips, edits, and progress notes as user input; never infer that a recommendation was followed.
- Make recommendations explainable, optional, and non-diagnostic. Show uncertainty and avoid presenting an LLM response as medical advice.
- Use the product roadmap for the proposed architecture, data model, and sequencing: [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md).

## Frontend conventions

- React 19, TypeScript, Vite 8, and Tailwind CSS v4.
- Main UI: `src/App.tsx`; global styles: `src/index.css`; entry point: `src/main.tsx`.
- Keep API contracts typed and validate untrusted responses at the boundary.
- Backend communication must use documented HTTP APIs. Do not connect directly to the database or call an LLM provider from the browser.
- Follow existing responsive and reduced-motion patterns. Keep keyboard access, visible focus, and accessible labels.

## Build and validation

- Install dependencies with `pnpm install`.
- Run locally with `pnpm dev`.
- Verify production output with `pnpm build` and types with `pnpm exec tsc --noEmit`.
- Format with `pnpm format`.

Keep changes focused, update relevant documentation, and run the smallest validation that covers the change.
