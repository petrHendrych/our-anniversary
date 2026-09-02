# Anniversary Timeline

A scroll-driven, 3D anniversary website — a "month runner" of printed photo
cards flying past in WebGL as you scroll through two years together, grouped
by year. Each card is one event — a night, a trip, a day worth keeping. Tap it
and it lifts out of the run and holds still in front of you, with that event's
own photographs, which are nowhere else on the page, shuffled into a deck
behind it — swipe to cycle through them. All of it stays in the 3D scene.

Built as a personal one-off project, viewed on a couple of specific phones —
see `REQUIREMENTS.md` for why that shapes a few technical decisions.

## Tech stack
- **Next.js** (App Router) + TypeScript
- **`@react-three/fiber`** + **`@react-three/drei`** (on top of `three`) —
  the WebGL month-runner scene
- **`lenis`** — smooth scroll
- **`gsap`** + **`@gsap/react`** (`ScrollTrigger`) — scroll-linked animation,
  drives both the 3D scene and the DOM nav/headers
- **`motion`** — the loading gate's transitions (the open card state is
  entirely 3D and uses none of it)
- **Tailwind CSS** — styling
- Deployed on **Vercel** (no custom domain)

## The loading gate
The page opens behind a gate that counts real work — the display face, the 3D
scene coming up, and the first few photographs baked into printed cards — then
offers **Enter**. That tap is also what asks iOS for device-orientation access,
so the tilt-to-look-around effect works without a second prompt — though the
tilt itself stays asleep until the reader is through the camera's lens, so the
intro is never shown at an angle just because the pointer is in a corner. If an asset
never arrives the gate opens anyway after nine seconds; see
`lib/preload-store.ts`.

## Getting started
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Adding your own content
All timeline content lives in `data/timeline.ts` as a typed array of
`YearBlock` objects (years → months → events → photos). See `REQUIREMENTS.md`
for the full shape. An event is one thing that happened: its cover is the card
that flies in the run, and its photos are the deck that card opens into. To add
one:

1. Drop the camera originals into `originals/<month-id>/<event-slug>/` —
   `cover` plus `01`, `02`, and so on, in whatever format they came in — then
   run `npm run photos`. That folder is gitignored; the script resizes to a
   1400px long edge, bakes in EXIF orientation, strips every tag (GPS
   included) and writes `public/images/<month-id>/<event-slug>/cover.jpg`
   etc., which is what actually ships. It only re-encodes what changed, so
   importing one month costs one month. Photographs it does not have originals
   for yet are listed at the end, and iPhone `.heic` files need converting
   first — it prints the `sips` command for that.
2. Add an entry to that month's `events`, with a `slug`, a `title`, and how
   many `photos` it has. `title` is what gets printed along the bottom border
   of the card; a photo's own `caption` is printed on its card in the deck,
   falling back to the event title.
3. Optionally add `notes`, `date`, and `location` — to the event, the month,
   or both.

No CMS, no database — it's all in that one file by design.

## Project structure
No `src/` — the app sits at the repo root, and `@/*` maps to `./*`.

```
app/              Next.js routes, global styles
components/
  canvas/         The R3F/Three.js month-runner scene and the open-card deck
  layout/         Year headers, side nav, progress header, flying titles
  focus/          Housekeeping while a deck is open — stops Lenis and the tilt
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
  originals straight into `public/images/` — `npm run photos` is the way in.
- Only the fetch part of a bake is warmed ahead: `warmPhoto()` in
  `lib/card-texture.ts` collects the bytes for the few covers past each end of
  the mount window, and for a whole event's set the moment its card is tapped,
  in parallel and with no decode, canvas or texture attached. The bakes
  themselves stay strictly one at a time.
- Only a sliding window of card textures is kept loaded at once — see
  `lib/card-texture.ts`, which also bakes each card's printed frame and
  downsamples the photograph on its way into the texture. Call
  `residentTextureCount()` from the console when profiling.
- Opening a card mounts a window onto that event's deck — the card on its way
  out, the four places the pile actually draws, two of lead and the cover —
  eight or nine cards at most, however many photographs the event has. A set
  of eight or fewer mounts whole. See `deckWindow()` in `lib/deck-layout.ts`.
- `/images/*` is served with a month of freshness and background revalidation
  (`next.config.ts`). Without it every photograph costs a conditional request
  on each repeat visit, which at eight hundred of them is all latency and no
  bytes.
- Built and tuned against a specific known device pair rather than a broad
  compatibility matrix — see `REQUIREMENTS.md`.
