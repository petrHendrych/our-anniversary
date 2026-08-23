/**
 * Where every photo sits in the month runner.
 *
 * The scene works in "screen pixels as world units": the camera sits at
 * CAMERA_Z with a field of view derived from the viewport height, so a plane
 * of N units is N CSS pixels tall when it reaches the camera plane. Every
 * constant below is therefore readable as a pixel measurement.
 *
 * Photos are laid out one behind another down the Z axis, cycling through the
 * four screen corners, so scrolling flies the reader between them rather than
 * past a single centred card. A month is a run of photos plus MONTH_GAP of
 * empty depth after its last one — that gap is the breathing room between one
 * month and the next, and it is why a month with seven photos occupies more
 * scroll than a month with four.
 *
 * Layout is derived from the data and is deterministic, so the server and the
 * client agree and nothing needs recomputing on resize.
 */
import { months } from "@/lib/timeline";

/** Camera distance from the Z=0 plane. Sets the pixels-per-unit mapping. */
export const CAMERA_Z = 800;
/** Haze the photos emerge from, in distance-from-camera. */
export const FOG_NEAR = 1900;
export const FOG_FAR = 3200;

/** Depth between consecutive photos within a month. */
const PHOTO_STEP = 520;
/**
 * Depth from a month's title to its first photo. Long on purpose: the title
 * flies through and is gone before the photographs arrive.
 */
const PHOTO_LEAD = 950;
/** Empty depth after a month's last photo, before the next month starts. */
const MONTH_GAP = 1250;
/**
 * The intro: the reader flies up to a camera, through its lens, and only then
 * does the first month begin. These are all depths along the same axis as the
 * photographs, so the whole page is one flight.
 */
/** Depth the camera body sits at. */
export const INTRO_CAMERA_DEPTH = 2600;
/** Depth at which the reader is level with the camera — the moment of passing. */
export const CAMERA_PASS_DEPTH = INTRO_CAMERA_DEPTH + CAMERA_Z;
/**
 * The gate: the depth at which the glass has cleared and the reader is looking
 * into the lens rather than at it. The first month is already out there, deep
 * in the haze beyond the bore, so passing through the camera reveals the run
 * rather than cutting to it.
 */
export const LENS_DEPTH = CAMERA_PASS_DEPTH - 1400;
/** Ramp over which month content comes up from nothing once the gate opens. */
const GATE_RAMP = 700;
/** Depth past the camera before the first month's title flies through. */
const AFTER_LENS = 900;

/**
 * 0 before the lens opens, 1 once the reader is properly through it. Month
 * titles and photographs multiply their opacity by this, so nothing pops into
 * existence at the gate.
 */
export function gateOpacity(depth: number): number {
  return Math.max(0, Math.min(1, (depth - LENS_DEPTH) / GATE_RAMP));
}

/**
 * How far off centre a photo sits. This is deliberately wider than the screen:
 * a photo arrives near the middle of the frame while it is still far off, then
 * sweeps outward as it approaches, and by the time it is large it is out at the
 * edge or past it. Seeing all of a month means panning around — mouse on a
 * desktop, tilting the phone otherwise.
 */
const CORNER = 640;
/** Longest edge of a photo, before the narrow-screen scale. */
const BASE_SIZE = 700;

/**
 * Photo *size* is designed at 1400px wide and scaled down from there, which is
 * what keeps a phone from flying through photos each wider than the screen.
 * Depth deliberately does not scale, so the spacing between photos feels the
 * same on every device.
 */
export function planeScale(viewportWidth: number): number {
  return Math.min(1, viewportWidth / 1400);
}

/**
 * Photo *placement* scales the other way: it never shrinks below the authored
 * spread, so a small screen sees a smaller slice of the same wide arrangement
 * and has to be panned around. On a screen wider than the design width the
 * spread grows with it, so the composition holds.
 */
export function spreadScale(viewportWidth: number): number {
  return Math.max(1, viewportWidth / 1400);
}

export interface RunnerPhoto {
  key: string;
  src: string;
  monthId: string;
  /** Index into `months` — the month this photo belongs to. */
  monthIndex: number;
  /** Index into `photos` — position along the whole run. */
  photoIndex: number;
  /** Distance from the start of the run. Grows as the reader scrolls. */
  depth: number;
  /** Centre offset in world units, before planeScale(). */
  x: number;
  y: number;
  /** Longest edge in world units, before planeScale(). */
  size: number;
  roll: number;
}

/**
 * Successive photos are placed a golden angle apart around the frame. It is
 * the same trick sunflowers use: the sequence never repeats, never clumps, and
 * two photos in a row are always well separated — but with the radius jittered
 * it reads as scattered rather than as a pattern.
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** How often a photo ignores the spread and passes straight through the middle. */
const CENTRE_CHANCE = 0.16;
/** Screens are taller than they are wide, so the scatter is an ellipse. */
const TALL = 1.3;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32 — small and deterministic; only used for gentle per-photo variety. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: () => number, min: number, max: number) => min + r() * (max - min);

const photos: RunnerPhoto[] = [];
/** Depth at which each month starts — where its title lands. */
const monthDepths: number[] = [];
/** Depth each month occupies, including its trailing gap. */
const monthSpans: number[] = [];

{
  // Months start on the far side of the camera; nothing of them exists before it.
  let cursor = CAMERA_PASS_DEPTH + AFTER_LENS;

  months.forEach((month, monthIndex) => {
    monthDepths.push(cursor);

    const sources = [month.coverImage, ...month.gallery.map((photo) => photo.src)];

    sources.forEach((src, i) => {
      const random = rng(hash(src));
      const angle = photos.length * GOLDEN_ANGLE + between(random, -0.45, 0.45);
      // Most photos sweep out past the edges of the screen; every so often one
      // comes straight down the middle instead, so the reader is not always
      // looking away from centre.
      const radius =
        random() < CENTRE_CHANCE
          ? CORNER * between(random, 0, 0.2)
          : CORNER * between(random, 0.6, 1.35);

      photos.push({
        key: src,
        src,
        monthId: month.id,
        monthIndex,
        photoIndex: photos.length,
        // Jitter is under half a step, so photo depths stay strictly ascending
        // for nearestPhotoIndex() while the run stops reading as a ladder.
        depth: cursor + PHOTO_LEAD + i * PHOTO_STEP + between(random, -70, 70),
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * TALL,
        size: BASE_SIZE * between(random, 0.86, 1.16),
        roll: between(random, -0.05, 0.05),
      });
    });

    cursor = photos[photos.length - 1].depth + MONTH_GAP;
    monthSpans.push(cursor - monthDepths[monthIndex]);
  });
}

export const runnerPhotos: RunnerPhoto[] = photos;
export const monthStartDepths: number[] = monthDepths;
export const monthDepthSpans: number[] = monthSpans;
export const runnerDepth: number = monthDepths[monthDepths.length - 1] + monthSpans[monthSpans.length - 1];

/** Depth the intro occupies: everything before the first month's title. */
export const INTRO_DEPTH: number = monthDepths[0];

/**
 * World units of depth the reader flies per screen of scrolling — the one knob
 * for the pace of the whole page. Sections size themselves from it so that a
 * month with seven photos gets more scroll than one with four, and the flight
 * speed stays even across all of them.
 */
export const UNITS_PER_SCREEN = 1500;

/** How many screens of scrolling a stretch of depth is worth. */
export function screensFor(depth: number): number {
  return depth / UNITS_PER_SCREEN;
}

/** Ascending photo depths — the lookup table behind nearestPhotoIndex(). */
const depths = photos.map((photo) => photo.depth);

/** Index of the photo nearest the given depth. Binary search; called per frame. */
export function nearestPhotoIndex(depth: number): number {
  let lo = 0;
  let hi = depths.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (depths[mid] < depth) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(depths[lo - 1] - depth) <= Math.abs(depths[lo] - depth)) return lo - 1;
  return lo;
}
