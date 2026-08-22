# Anniversary Timeline

A scroll-driven, 3D anniversary website — a "month runner" of photo cards
flying past in WebGL as you scroll through two years together, grouped by
year, with a tap-to-expand drawer for each month's full photo set and story.

Built as a personal one-off project, viewed on a couple of specific phones —
see `REQUIREMENTS.md` for why that shapes a few technical decisions.

## Tech stack
- **Next.js** (App Router) + TypeScript
- **`@react-three/fiber`** + **`@react-three/drei`** (on top of `three`) —
  the WebGL month-runner scene
- **`lenis`** — smooth scroll
- **`gsap`** + **`@gsap/react`** (`ScrollTrigger`) — scroll-linked animation,
  drives both the 3D scene and the DOM nav/headers
- **`motion`** — shared-element transitions (card → drawer)
- **`vaul`** — mobile bottom-sheet drawer
- **Tailwind CSS** — styling
- Deployed on **Vercel** (no custom domain)

## Getting started
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Adding your own content
All timeline content lives in `src/data/timeline.ts` as a typed array of
`YearBlock` objects (years → months → photos). See `REQUIREMENTS.md` for the
full shape. To add a month:

1. Drop resized photos (long edge ~1500–2000px) into `public/images/`.
2. Add a `Month` entry with a `coverImage`, `title`, `summary`, and a
   `gallery` array for the drawer.
3. Optionally add `notes`, `date`, and `location`.

No CMS, no database — it's all in that one file by design.

## Project structure
```
src/
  app/            Next.js routes
  components/
    canvas/       The R3F/Three.js month-runner scene
    layout/       Year headers, side nav, progress header
    drawer/       Tap-to-expand photo drawer
  data/           timeline.ts — all content
  lib/            Shared scroll state, texture windowing logic
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
- Only a sliding window of month textures is kept loaded at once — see
  `src/lib/texture-window.ts`.
- Built and tuned against a specific known device pair rather than a broad
  compatibility matrix — see `REQUIREMENTS.md`.
