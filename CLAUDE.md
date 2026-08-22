# CLAUDE.md

Guidance for Claude Code working in this repository. Read this and
`REQUIREMENTS.md` before writing code.

## Project in one paragraph
A scroll-driven anniversary website: a WebGL "month runner" (photos as 3D
cards flying past as the user scrolls, grouped by year) layered with a DOM
overlay for text, a side timeline nav, and a tap-to-expand photo drawer per
month. Viewed by ~2 people on modern iPhones/Android flagships — optimize
for "buttery smooth on those exact devices," not broad compatibility.

## Architecture principles (don't deviate without discussion)

1. **WebGL is only for the month-runner scene.** Cards = textured planes in
   a `@react-three/fiber` `<Canvas>`. Nothing else lives in the 3D scene —
   no 3D text, no UI, no drawer content. All of that is DOM/React on top of
   or around the canvas.
2. **One scroll source of truth.** `lenis` drives real page scroll.
   `gsap` `ScrollTrigger` reads scroll position/progress from Lenis and is
   the single thing that updates: 3D card transforms, year header
   pin/transition state, and the active dot in the side nav. Don't invent a
   second scroll system inside the canvas (e.g. drei's `<ScrollControls>`)
   — it will fight with Lenis.
3. **Texture budget matters even on flagship phones.** Mobile Safari has a
   real WebGL memory ceiling independent of chip speed. Never mount textures
   for all months at once. Maintain a sliding window (current ± a few
   months) and dispose textures for anything scrolled far out of range.
4. Keep the codebase small and legible over clever. This is a personal
   project maintained by one frontend dev using an AI pair — prefer
   straightforward React/R3F components over abstraction layers.

## Tech stack — exact package names

Package naming has shifted in this ecosystem; use these, not older names
you might recall from training data or older tutorials:

- `three`, `@react-three/fiber`, `@react-three/drei`
- `gsap` + `@gsap/react` (gives the `useGSAP()` hook) — **all GSAP plugins,
  including ScrollTrigger, are free** since Webflow's 2025 acquisition of
  GreenSock. Do not add a `.npmrc` with a GreenSock auth token or suggest a
  paid Club GreenSock plan — that's outdated.
- `lenis` — **not** `@studio-freight/lenis`, which is deprecated/renamed.
  React usage: `import { ReactLenis } from 'lenis/react'`.
- `motion` — **not** `framer-motion`, which is deprecated/renamed (same
  API). Import from `motion/react`, e.g.
  `import { motion, AnimatePresence } from 'motion/react'`.
- `vaul` for the mobile bottom-sheet drawer.
- Tailwind CSS for styling.
- Next.js App Router, TypeScript.

## Do NOT
- Do not add `three-bmfont-text`, `three.meshline`, `three-svg-loader`, or
  any custom GLSL text-in-3D pipeline. Those solve problems this project
  doesn't have (the reference site used them for 3D typography — we're
  keeping all text in the DOM instead).
- Do not add analytics, a CMS, or auth — content is a static data file.
- Do not build a broad device-compatibility layer or feature-detect for
  old browsers — target is modern mobile Safari/Chrome only.
- Do not silently swap in `framer-motion` or `@studio-freight/lenis` if a
  package or example you're referencing uses the old name — translate to
  the current package.

## File/folder structure (starting point, adjust as needed)
```
src/
  app/                      # Next.js App Router
    page.tsx
    layout.tsx
  components/
    canvas/
      MonthRunnerScene.tsx  # R3F Canvas + card meshes
      MonthCard.tsx
    layout/
      YearHeader.tsx
      SideNav.tsx
      ProgressHeader.tsx
    drawer/
      MonthDrawer.tsx       # vaul drawer + motion shared-element transition
      PhotoGrid.tsx
  data/
    timeline.ts             # YearBlock[] — see REQUIREMENTS.md for shape
  lib/
    scroll-store.ts          # shared scroll progress state (context or zustand)
    texture-window.ts         # sliding-window texture load/dispose logic
  styles/
```

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build
- `vercel` — deploy (no custom domain; use the generated `*.vercel.app` URL)

## Working style for this project
- Break work into milestones and check in before starting the WebGL scene —
  get the data model, layout skeleton, and DOM nav working first with
  placeholder cards, then layer in the 3D.
- Since the device target is fixed and known, it's fine to test against
  real device assumptions rather than building broad fallbacks.
- Ask before adding new dependencies beyond what's listed above.
