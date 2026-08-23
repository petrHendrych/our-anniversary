# Anniversary Timeline

A scroll-driven, 3D anniversary website — a "month runner" of printed photo
cards flying past in WebGL as you scroll through two years together, grouped
by year. Tap a card and it lifts out of the run and holds still in front of
you, with that month's story underneath and a fullscreen slideshow of its
photographs a button away.

Built as a personal one-off project, viewed on a couple of specific phones —
see `REQUIREMENTS.md` for why that shapes a few technical decisions.

## Tech stack
- **Next.js** (App Router) + TypeScript
- **`@react-three/fiber`** + **`@react-three/drei`** (on top of `three`) —
  the WebGL month-runner scene
- **`lenis`** — smooth scroll
- **`gsap`** + **`@gsap/react`** (`ScrollTrigger`) — scroll-linked animation,
  drives both the 3D scene and the DOM nav/headers
- **`motion`** — the overlay's transitions and the slideshow's swipe gestures
- **Tailwind CSS** — styling
- Deployed on **Vercel** (no custom domain)

## Getting started
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Adding your own content
All timeline content lives in `data/timeline.ts` as a typed array of
`YearBlock` objects (years → months → photos). See `REQUIREMENTS.md` for the
full shape. To add a month:

1. Drop resized photos (long edge ~1500–2000px) into `public/images/`.
2. Add a `Month` entry with a `coverImage`, `title`, `summary`, and a
   `gallery` array for the slideshow. `title` is what gets printed along the
   bottom border of the month's cover card; a gallery photo's own `caption`
   is printed on its card, falling back to the month title.
3. Optionally add `notes`, `date`, and `location`.

No CMS, no database — it's all in that one file by design.

## Project structure
No `src/` — the app sits at the repo root, and `@/*` maps to `./*`.

```
app/              Next.js routes, global styles
components/
  canvas/         The R3F/Three.js month-runner scene
  layout/         Year headers, side nav, progress header, flying titles
  focus/          The DOM that belongs to a tapped-open card
  gallery/        Fullscreen swipe slideshow
data/             timeline.ts — all content
lib/              Scroll and focus state, 3D layout maths, texture baking
```

## Deployment
```bash
npm run build
vercel
```
Deploys to a generated `*.vercel.app` URL — no custom domain configured.

## Performance notes
- Source photos are resized before use; don't drop full-resolution camera
  originals straight into `public/images/`.
- Only a sliding window of card textures is kept loaded at once — see
  `lib/card-texture.ts`, which also bakes each card's printed frame and
  downsamples the photograph on its way into the texture. Call
  `residentTextureCount()` from the console when profiling.
- The WebGL loop stops while the slideshow is open, so the GPU stays out of
  the way of decoding full-screen photographs.
- Built and tuned against a specific known device pair rather than a broad
  compatibility matrix — see `REQUIREMENTS.md`.
