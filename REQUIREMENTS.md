# Anniversary Timeline — Requirements

## What this is
A personal, one-off scroll website celebrating 2 years together. Not a product,
not meant for broad traffic — it will be opened a handful of times by two
people, on their own phones. Optimize for "feels incredible on our exact
devices," not for compatibility or scale.

## Audience & device target
- Viewers: you and your girlfriend, maybe shown to a couple of close people.
- Devices: iPhone 13 Pro or newer, recent Android flagships. Assume a modern
  GPU, a modern mobile Safari/Chrome, and a good connection.
- Because of this narrow target, it's fine to lean on a real WebGL scene
  instead of faking depth with CSS — see Architecture below.
- No requirement to support old Android, old iOS Safari, desktop-first
  layouts, or slow 3G.

## Core experience
Two layers, working together:

1. **The Month Runner (WebGL / Three.js).** The primary scroll experience.
   As the user scrolls, month "cards" (textured planes, using each month's
   cover photo) move through 3D space — tilting, scaling, and passing near
   the camera — in the spirit of `2018.craftedbygc.com`. Organized
   chronologically, grouped by year.
2. **The DOM overlay.** Sits on top of / alongside the canvas. Handles:
   - Year headers ("Year One", "Year Two") that pin/transition as their
     range of months scrolls past.
   - A side timeline nav (sticky, vertical dots for years/months) that lets
     the user jump directly to any point instead of scrolling linearly.
   - Text sections (milestone write-ups) interspersed between visual
     sections.
   - Everything that belongs to an open card (see below).

Text and interactive UI stay in real DOM elements — never baked into the
3D scene as textures/geometry. This keeps text crisp, keeps the WebGL scene
simple, and keeps the codebase debuggable.

## The cards
Each card is a *printed* photograph: warm paper with a thin border on three
sides and a deep one along the bottom carrying the photo's caption. The frame
and its caption are drawn into a 2D canvas once and uploaded as a single
texture, so a card stays one textured quad and the caption travels with it
through the scene.

## Tap-to-zoom interaction
Tapping/clicking a card:
- Pauses the main scroll and freezes the camera tilt.
- Lifts that same card out of the run — it is still the same mesh — and holds
  it in front of the reader, face-on, filling most of the screen. The rest of
  the run falls back into the haze and dims behind it.
- Underneath the card, in DOM: the date and location, the month's summary,
  and its notes, plus a **Show more** button.
- **Show more** opens a fullscreen slideshow of that month's photographs —
  swipe or arrow-key between them, captions underneath, opening on whichever
  photo was tapped. The WebGL loop pauses while it is up.
- Tapping outside the card, or Escape, flies it home and resumes the main
  scroll where it left off.

## Data model
All content is static and hand-authored — no CMS, no backend.

```ts
interface MemoryPhoto {
  id: string;
  src: string;       // path under /public/images/...
  alt: string;
  caption?: string;
}

interface Month {
  id: string;             // "2024-03"
  year: number;           // 2024
  monthIndex: number;     // 1-12
  monthLabel: string;     // "March"
  coverImage: string;     // used by the 3D card
  title: string;          // short milestone title, e.g. "Our First Trip"
  summary: string;        // 1-2 sentence teaser shown on the card itself
  date?: string;          // specific date, if there's one headline event
  location?: string;
  gallery: MemoryPhoto[]; // full photo set shown in the slideshow
  notes?: string;         // longer story text shown under the zoomed card
}

interface YearBlock {
  year: number;
  label: string;   // "Year One"
  months: Month[]; // ideally all 12, empty months are fine to omit or leave sparse
}
```

## Tech stack

| Purpose | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | |
| 3D scene | `@react-three/fiber` + `@react-three/drei`, on top of `three` | R3F over raw three.js — declarative components, automatic scene cleanup on unmount, much easier for AI-assisted code to reason about. |
| Scroll | `lenis` (not `@studio-freight/lenis` — renamed) | React usage via `lenis/react`. |
| Scroll-linked animation | `gsap` + `@gsap/react` (`useGSAP` hook) + `ScrollTrigger` | All GSAP plugins, including ScrollTrigger, are free since Webflow's 2025 acquisition — no Club GreenSock membership or license key needed. |
| Overlay motion + slideshow swipe | `motion` (not `framer-motion` — renamed, same API) | Import from `motion/react`. Also handles the drag gestures — no separate carousel library. |
| Styling | Tailwind CSS | |
| Images | Next.js `<Image />`, pre-resized source assets | See performance rules. |
| Deployment | Vercel, no custom domain, `vercel` CLI | |

## Performance rules (non-negotiable, even on high-end phones)
1. **Resize/compress every source photo before it becomes a texture.**
   Cap the longest edge around 1500–2000px. A 4000px original gains nothing
   on a phone screen and burns GPU memory. The card baker downsamples again
   on its way into the texture, so the ceiling there is what actually binds.
2. **Never load all months' textures at once.** Keep a sliding window of
   textures loaded (current month ± a few), dispose textures for cards that
   have scrolled far out of range.
3. **One scroll source of truth.** Lenis drives the real page scroll;
   GSAP ScrollTrigger reads that scroll and drives both (a) the 3D card
   transforms and (b) the DOM nav/year-header state. Don't let the 3D canvas
   own a second, separate scroll container — that's how you get drift and
   janky sync bugs.
4. Even though the whole target device pool is high-end, still profile on
   the actual two phones the site will be viewed on before calling it done.

## Non-goals (explicitly out of scope)
- Broad device/browser compatibility.
- SEO, analytics, CMS/admin backend.
- Automated testing infrastructure (a nice-to-have if there's time, not a
  requirement for a one-off personal site).
- Accessibility beyond reasonable basics (alt text, don't trap keyboard
  focus) — not a WCAG compliance target.

## Content you need to gather before/while building
- Final list of months with at least a cover photo and short title/summary.
- Full photo sets for each month's slideshow.
- Any specific dates/locations worth calling out.
- Freeform notes/story text per month (optional, can be added incrementally).
