# CLAUDE.md

Guidance for Claude Code working in this repository. Read this and
`REQUIREMENTS.md` before writing code.

## Project in one paragraph
A scroll-driven anniversary website: a WebGL "month runner" (photos as 3D
cards flying past as the user scrolls, grouped by month and year) layered with
a DOM overlay for text and a side timeline nav. **One card is one event** — a
night, a trip, a day worth keeping — and a month is however many events it
holds. Tapping a card lifts it out of the run and holds it in front of the
reader, with that event's *own* photographs fanned out behind it as a shuffled
deck the reader swipes through. Those pictures are in the run nowhere: the
next card along opens a completely different set. That whole interaction stays
in the 3D scene, captions included. Viewed by ~2 people on
modern iPhones/Android flagships — optimize for "buttery smooth on those exact
devices," not broad compatibility.

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
2. **A photo holds its place on screen, then sweeps out of it.** Placement is
   two parts (`lib/runner-layout.ts`): `holdX/holdY` are screen pixels whose
   world offset grows with distance, so a photo keeps a fixed clearance from
   the middle of the frame at every depth and the centre of the screen is
   never flown through; `x/y` are plain world offsets that count for little far
   away and more as the photo arrives, which is the outward drift. Both
   MonthCard and MonthDeck place a card with
   `photo.holdX * holdScale(runZ) + photo.x * spread` — they must agree or
   opening a card jumps. `spread` scales the drift only, because `hold` is
   already a screen measurement — and `spread` now scales *down* on a phone
   (it used to be floored at 1), so the outermost card of a month is still
   reachable there instead of sitting two screen widths off centre. Photos are drawn the whole way in and fade only as
   they cross the camera, like the flying month titles.
3. **One scroll source of truth.** `lenis` drives real page scroll, and
   `gsap.ticker` drives Lenis. `ScrollDriver` reads that one scroll position
   once per frame off the same ticker and publishes it to `scroll-store`;
   everything scroll-linked — 3D card transforms, the flying titles, the
   header, the active tick — reads the store. Don't invent a second scroll
   system inside the canvas (e.g. drei's `<ScrollControls>`) — it will fight
   with Lenis.

   The reading is deliberately *not* taken inside a `ScrollTrigger`'s
   `onUpdate`. A ScrollTrigger only calls back while the scroll sits between
   its start and end, and both are measured off an element's box; anything
   that gets that measurement wrong stops the callback entirely, and the
   symptom is not a misplaced run, it is no run at all — the page scrolls, the
   sticky month copy goes with it because that is pure CSS, and the reader
   looks at the intro camera for the length of two years. A phone found one of
   those ways and a desktop did not. ScrollTrigger is still used for what it
   is good at: the scrubbed copy fades, and `refresh` as the signal to
   re-measure the section anchors.
4. **A tapped card is placed in camera space, not world space.** It flies to
   `FOCUS_DISTANCE` straight down the camera's own axis with its rotation
   slerped to the camera's, so it lands centred and face-on no matter where
   the tilt has left the camera looking — the tilt just freezes, it never has
   to swing back to level. What keeps the deck in front of the run is draw
   order, not distance: nothing writes depth anywhere in this scene, so deck
   cards simply take a higher `renderOrder` and turn `depthTest` off. See
   `lib/focus-layout.ts`.
5. **The tapped card flies itself; the deck takes over when it lands.**
   `MonthCard` owns the zoom, start to finish — that path is deliberately
   untouched. `MonthDeck` mounts as soon as the card opens so its textures
   are ready, but draws nothing until `focusState.handed`, at which point its
   front card is at the identical pose holding the identical texture, so the
   swap cannot be seen. It has to take over, because after one swipe the front
   card is a photograph the run never held at all. The two poses agree by
   algebra, not by luck: the deck's front-card path is
   `lerp(target, rest, 1 - t)` where MonthCard's is `lerp(rest, target, t)`.
   Only the cover has a slot in the run, so closing winds the cursor back to
   it (`releaseFocus`) before the flight home starts — the card that lands is
   the card that was tapped, and the deck's extra photographs inherit the
   cover's run pose only so the maths has somewhere to point.
6. **The deck is one float.** `focusState.cursor` is a continuous, *unwrapped*
   position around the event's ring of photographs; every card derives its
   whole pose from `ringOffset()` and `pilePose()` (`lib/deck-layout.ts`).
   Cycling loops for ever, and the seam where the ring index jumps is
   invisible only because both ends of the range describe the same pose — far
   back, centred, transparent. The curves are shaped to land there. Changing
   one without the other makes the deck blink once per lap.
7. **Texture budget matters even on flagship phones.** Mobile Safari has a
   real WebGL memory ceiling independent of chip speed. Never mount textures
   for the whole run at once. Maintain a sliding window (the nearest few
   cards) and dispose textures for anything scrolled far out of range. An
   event's photographs are mounted only while its card is open, and all of
   them at once — which is the reason to keep a set small.
8. **The loading gate counts real work, and it is the page's one guaranteed
   tap.** `lib/preload-store.ts` tracks a fixed list — the display face, the
   scene's first frame, and the first few photographs baked into cards — so the
   counter never lies, and it opens anyway after `PATIENCE` if something never
   arrives. The Enter button is where `requestGyro()` is called from: iOS only
   hands out device orientation from inside a gesture, and this is the one
   gesture every reader makes. It lifts away upwards rather than dissolving,
   and what is behind it is the camera alone — `IntroSection` is pure scroll
   height now, because repeating the title over the camera would be reading
   the reader the same page twice — except the header, which carries the title
   across so it does not vanish and reappear on the far side.
9. **Tilt only wakes up past the lens.** `armTilt()` in `lib/tilt.ts` pins the
   camera dead centre until `scrollState.entered`. The reader arrives from the
   gate with their pointer wherever Enter happened to be — usually a corner —
   and a camera leaning towards it would show them the intro at an angle for
   no reason they could name. It arms on `scrollState.passed` — level with the
   camera and past it — not on `entered`, which fires 1400 units earlier while
   the camera is still out in front. `entered` is the gate for month content;
   `passed` is the only honest answer to "have they gone through it yet", and
   the scroll hint uses it too.
10. Keep the codebase small and legible over clever. This is a personal
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
- Tailwind CSS for styling.
- Next.js App Router, TypeScript.

## Do NOT
- Do not add `three-bmfont-text`, `three.meshline`, `three-svg-loader`, or
  any custom GLSL text-in-3D pipeline. Those solve problems this project
  doesn't have (the reference site used them for 3D typography). Every piece
  of type is either real DOM or drawn with `fillText` into a card's own
  texture — nothing else.
- Do not re-add `vaul`, a bottom sheet, a lightbox or a DOM carousel. Tapping
  a card is the 3D deck and nothing else — the captions are printed into the
  card textures, so there is no DOM in the open state at all.
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
    MonthCard.tsx           # one print in the run; flies the tapped one out
    MonthDeck.tsx           # takes over once it lands: the event's own photos
    IntroCamera.tsx
    CameraTilt.tsx
  layout/                   # year headers, side nav, progress header, titles
    Loader.tsx              # the gate: real progress, Enter, then lifts away
    ScrollHint.tsx          # the page's one instruction, and only briefly
  focus/
    FocusMode.tsx           # draws nothing; stops Lenis and the tilt
data/
  timeline.ts               # YearBlock[] -> Month[] -> MemoryEvent[] -> photos
lib/
  scroll-store.ts           # scroll progress; `depth` never notifies
  focus-store.ts            # which card is open; `t`/`spread`/`cursor` never notify
  focus-layout.ts           # where the front card of a deck lands
  deck-layout.ts            # the ring: where each card sits behind the front one
  runner-layout.ts          # all 3D placement maths; builds each event's deck
  card-texture.ts           # bakes the printed frame; sliding-window cache
  preload-store.ts          # what must be ready before the gate opens
  tilt.ts, timeline.ts, palette.ts
```

Both stores follow the same pattern: a plain mutable module object read
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
