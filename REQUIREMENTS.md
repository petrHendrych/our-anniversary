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
   As the user scrolls, event "cards" (textured planes, using each event's
   cover photo) move through 3D space — tilting, scaling, and passing near
   the camera — in the spirit of `2018.craftedbygc.com`. Organized
   chronologically, grouped into months and years. A month contributes one
   card per event it holds, so a busy month is several cards in a row.
2. **The DOM overlay.** Sits on top of / alongside the canvas. Handles:
   - The loading gate, which is the whole first screen and lifts away upwards
     when the reader taps Enter. Behind it the intro is the 3D camera alone.
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

## Tap-to-open interaction
Tapping/clicking a card:
- Pauses the main scroll and freezes the camera tilt.
- Lifts that same card out of the run — it is still the same mesh — and holds
  it in front of the reader, face-on, filling most of the screen. The rest of
  the run falls back into the haze and dims behind it.
- That event's *own* photographs then fan out **behind** the open card as a
  shuffled deck, leaning alternately left and right, each one further back,
  smaller and slightly rotated, peeking out at the sides. They belong to that
  card alone — they are not in the run, and the next card along in the same
  month opens a completely different set.
- Swiping horizontally turns the deck. The card at the front slides away and
  tucks in at the very back; the next one takes its place. It loops for ever
  in both directions, and a flick turns exactly one card.
- Tapping a photograph peeking out of the pile brings it to the front.
- Tapping empty space, pressing Escape, or swiping down winds the deck back
  to the event's cover and flies it home to its place in the run — the cover
  is the only one of the event's photographs that has a place there — then
  resumes the main scroll where it left off.

There is no DOM in the open state at all — no copy, no buttons, no chrome.
Each photograph's caption is printed into its own card, so the text is in the
scene with everything else.

## Data model
All content is static and hand-authored — no CMS, no backend.

```ts
interface MemoryPhoto {
  id: string;
  src: string;       // path under /public/images/<month>/<event>/...
  alt: string;
  caption?: string;  // printed on this photo's card; falls back to the event title
}

interface MemoryEvent {
  id: string;             // "2024-09/the-bridge"
  monthId: string;        // "2024-09"
  slug: string;           // "the-bridge" — the folder its photos live in
  title: string;          // printed along the bottom of the card in the run
  cover: MemoryPhoto;     // the card that flies in the run
  photos: MemoryPhoto[];  // the deck it opens into — in the run nowhere
  date?: string;
  location?: string;
  notes?: string;         // longer story text (not shown yet — see below)
}

interface Month {
  id: string;             // "2024-03"
  year: number;           // 2024
  monthIndex: number;     // 1-12
  monthLabel: string;     // "March"
  title: string;          // short milestone title, e.g. "Our First Trip"
  summary: string;        // 1-2 sentence teaser shown in the DOM overlay
  events: MemoryEvent[];  // one card each in the run
  date?: string;          // specific date, if there's one headline event
  location?: string;
  notes?: string;         // longer story text (not shown yet — see below)
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
| DOM motion | `motion` (not `framer-motion` — renamed, same API) | Import from `motion/react`. Used by the loading gate; the open card state is entirely 3D and uses none of it. |
| Styling | Tailwind CSS | |
| Images | Next.js `<Image />`, pre-resized source assets | See performance rules. |
| Deployment | Vercel, no custom domain, `vercel` CLI | |

## Performance rules (non-negotiable, even on high-end phones)
1. **Resize/compress every source photo before it becomes a texture.**
   Cap the longest edge around 1500–2000px. A 4000px original gains nothing
   on a phone screen and burns GPU memory. The card baker downsamples again
   on its way into the texture, so the ceiling there is what actually binds.
2. **Never load all the textures at once.** Keep a sliding window of card
   textures loaded (the nearest few in the run), dispose textures for cards
   that have scrolled far out of range, and keep an event's photo set small —
   opening a card bakes all of it at once.
3. **One scroll source of truth.** Lenis drives the real page scroll;
   GSAP ScrollTrigger reads that scroll and drives both (a) the 3D card
   transforms and (b) the DOM nav/year-header state. Don't let the 3D canvas
   own a second, separate scroll container — that's how you get drift and
   janky sync bugs.
4. Even though the whole target device pool is high-end, still profile on
   the actual two phones the site will be viewed on before calling it done.

## Not built yet
`Month.summary`, `Month.notes`, `Month.date` and `Month.location` are authored
in the data but nothing displays them any more — the deck replaced the copy
that used to sit under the open card. Somewhere to read a month's story is
still wanted; where it goes is undecided.

## Non-goals (explicitly out of scope)
- Broad device/browser compatibility.
- SEO, analytics, CMS/admin backend.
- Automated testing infrastructure (a nice-to-have if there's time, not a
  requirement for a one-off personal site).
- Accessibility beyond reasonable basics (alt text, don't trap keyboard
  focus) — not a WCAG compliance target.

## Content you need to gather before/while building
- The events worth a card, month by month — each needs a name and a cover.
- A photo set per event: the pictures that belong to that one thing only.
- Any specific dates/locations worth calling out.
- Freeform notes/story text per event or month (optional, can be added
  incrementally).
