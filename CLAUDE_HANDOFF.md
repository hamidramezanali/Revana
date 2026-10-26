# HABITAT AI Interior Studio — Mockup Handoff

## What this is

An interactive React + Vite prototype for an AI-assisted living-room design experience. The UI is presented as nine separate mobile views inside a desktop presentation shell.

## Experience flow

1. **Scan an empty room**
   - Capture walls, windows, doors, outlets, dimensions, and ceiling height.
2. **Discover taste visually**
   - Users select room images rather than needing to know style terminology.
3. **Set budget and priorities**
   - Choose a whole-room budget and preferences such as comfort or durability.
4. **Explore complete solutions**
   - Compare three coherent design directions with match scores and estimated prices.
5. **Choose the anchor sofa**
   - Tap the sofa, use arrows to compare different sofa typologies, and provide positive or negative feedback.
6. **Choose lighting**
   - Review five lamp alternatives, see suggested placement, and rate each option.
7. **Review designer guidance**
   - Tap contextual room bubbles for short advice about pillows, contrast, lighting, and visual balance.
8. **Review the design recipe**
   - See a flexible color ratio and a mix of wool, linen, timber, and metal.
9. **Save the room plan**
   - Save the 3D room, selected products, design actions, and shopping list.

## Important product principles

- Start from a realistic, empty scan of the user’s actual room.
- Reveal the room progressively instead of immediately showing a finished design.
- Ask as few written questions as possible.
- Infer style through image choices.
- Keep the room context stable while users compare individual products.
- Offer meaningfully different silhouettes, not merely color variations.
- Use thumbs-up, thumbs-down, and swipe/arrow feedback to improve subsequent suggestions.
- Explain recommendations in one or two short sentences.
- Treat the 60–30–10 color split as a flexible heuristic, not a universal rule.
- Use multisensory design principles: visual composition, tactile materials, lighting, acoustics, and scent.

## Main files

- `src/App.tsx` — all prototype screens and interactions
- `src/index.css` — visual system, mobile mockup, responsive presentation shell
- `src/main.tsx` — React entry point
- `package.json` — scripts and dependencies

## Run locally

```bash
pnpm install
pnpm dev
```

Production check:

```bash
pnpm build
pnpm exec tsc --noEmit
```

## Technical notes

- React 19
- TypeScript
- Vite
- Tailwind CSS v4 is available, while the current mockup also uses purpose-built global CSS.
- Interior photography is loaded from Unsplash URLs and requires an internet connection.
- No backend or persistence is connected; interactions are prototype state only.

## Suggested next implementation step

Preserve a single room scan as the stable visual background, then render replaceable furniture as segmented layers or generated inpainting results. Product selection and feedback should be stored separately so the recommendation model can learn from dislikes without altering already-approved pieces.
