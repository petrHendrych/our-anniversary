# CLAUDE.md

Guidance for Claude Code working in this repository. Read this and
`REQUIREMENTS.md` before writing code.

## Project in one paragraph
A scroll-driven anniversary website: a WebGL "month runner" (photos as 3D
cards flying past as the user scrolls, grouped by year) layered with a DOM
overlay for text and a side timeline nav. Tapping a card lifts it out of the
run and holds it in front of the reader, with the month's story in DOM
underneath and a "Show more" button into a fullscreen photo slideshow. Viewed by ~2 people on modern iPhones/Android flagships — optimize
for "buttery smooth on those exact devices," not broad compatibility.

## Architecture principles (don't deviate without discussion)

1. **WebGL is only for the month-runner scene.** Cards = textured planes in
   a `@react-three/fiber` `<Canvas>`. Nothing else lives in the 3D scene —
   no 3D text, no UI, no overlay copy. All of that is DOM/React on top of
   or around the canvas.

   The one thing that *is* baked into the scene is a card's own frame: a card
   is a printed photo — paper, border, caption set into the deep bottom edge —
   drawn once into a 2D canvas and uploaded as a single `CanvasTexture`
   (`lib/card-texture.ts`). That is deliberately not "text in 3D": one quad,
   one texture, and the caption travels with the card for free. Don't replace
   it with projected DOM labels or a text-in-GL pipeline.
2. **One scroll source of truth.** `lenis` drives real page scroll.
   `gsap` `ScrollTrigger` reads scroll position/progress from Lenis and is
   the single thing that updates: 3D card transforms, year header
   pin/transition state, and the active dot in the side nav. Don't invent a
   second scroll system inside the canvas (e.g. drei's `<ScrollControls>`)
   — it will fight with Lenis.
3. **A tapped card is placed in camera space, not world space.** It flies to
   `FOCUS_DISTANCE` straight down the camera's own axis with its rotation
   slerped to the camera's, so it lands centred and face-on no matter where
   the tilt has left the camera looking — the tilt just freezes, it never has
   to swing back to level. `FOCUS_DISTANCE` must stay nearer than the nearest
   card still being drawn (`CAMERA_Z - PASSED`), which is what puts the open
   card in front of everything without touching the depth buffer. See
   `lib/focus-layout.ts`.
4. **Texture budget matters even on flagship phones.** Mobile Safari has a
   real WebGL memory ceiling independent of chip speed. Never mount textures
   for all months at once. Maintain a sliding window (current ± a few
   months) and dispose textures for anything scrolled far out of range.
5. Keep the codebase small and legible over clever. This is a personal
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
  `motion` also drives the slideshow's swipe gestures — no separate gesture
  or carousel library.
- Tailwind CSS for styling.
- Next.js App Router, TypeScript.

## Do NOT
- Do not add `three-bmfont-text`, `three.meshline`, `three-svg-loader`, or
  any custom GLSL text-in-3D pipeline. Those solve problems this project
  doesn't have (the reference site used them for 3D typography). Every piece
  of type is either real DOM or drawn with `fillText` into a card's own
  texture — nothing else.
- Do not re-add `vaul` or any other bottom-sheet library. Tapping a card is
  the 3D zoom plus the fullscreen slideshow; there is no drawer any more.
- Do not add analytics, a CMS, or auth — content is a static data file.
- Do not build a broad device-compatibility layer or feature-detect for
  old browsers — target is modern mobile Safari/Chrome only.
- Do not silently swap in `framer-motion` or `@studio-freight/lenis` if a
  package or example you're referencing uses the old name — translate to
  the current package.

## File/folder structure
There is no `src/` — the app sits at the repo root, and `@/*` maps to `./*`.

```
app/                        # Next.js App Router
  page.tsx
  layout.tsx
  globals.css
components/
  canvas/
    MonthRunnerScene.tsx    # R3F Canvas, pixel camera, fog, mount window
    MonthCard.tsx           # one print: run pose + focus flight, in useFrame
    IntroCamera.tsx
    CameraTilt.tsx
  layout/                   # year headers, side nav, progress header, titles
  focus/
    FocusOverlay.tsx        # the DOM that belongs to an open card
  gallery/
    PhotoSlideshow.tsx      # fullscreen swipe slideshow
data/
  timeline.ts               # YearBlock[] — see REQUIREMENTS.md for shape
lib/
  scroll-store.ts           # scroll progress; `depth` never notifies
  focus-store.ts            # which card is open; `t` never notifies
  focus-layout.ts           # where an open card lands (3D and DOM agree here)
  runner-layout.ts          # all 3D placement maths
  card-texture.ts           # bakes the printed frame; sliding-window cache
  tilt.ts, timeline.ts, palette.ts
```

The two stores follow the same pattern: a plain mutable module object read
from inside render loops, with thin `useSyncExternalStore` hooks on top for
the few values React genuinely needs. Values that change every frame update
silently — subscribing a component to one of those is how this page would get
slow.

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
