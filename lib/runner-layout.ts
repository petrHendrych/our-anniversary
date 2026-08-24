/**
 * Where every photo sits in the month runner.
 *
 * The scene works in "screen pixels as world units": the camera sits at
 * CAMERA_Z with a field of view derived from the viewport height, so a plane
 * of N units is N CSS pixels tall when it reaches the camera plane. Every
 * constant below is therefore readable as a pixel measurement.
 *
 * One card flies in the run per *event* — its cover photograph. The rest of an
 * event's pictures are never in the run at all; they exist only in the deck
 * that card opens into, which is why tapping two cards in the same month shows
 * two entirely different sets of photographs.
 *
 * Cards are laid out one behind another down the Z axis, scattered around the
 * frame, so scrolling flies the reader between them rather than past a single
 * centred card. A month is its run of event cards plus MONTH_GAP of empty
 * depth after the last one — that gap is the breathing room between one month
 * and the next, and it is why a month with three events occupies more scroll
 * than a month with one.
 *
 * Layout is derived from the data and is deterministic, so the server and the
 * client agree and nothing needs recomputing on resize.
 */
import type { MemoryEvent } from "@/data/timeline";
import { months } from "@/lib/timeline";

/** Camera distance from the Z=0 plane. Sets the pixels-per-unit mapping. */
export const CAMERA_Z = 800;
/** Haze the photos emerge from, in distance-from-camera. */
export const FOG_NEAR = 1900;
export const FOG_FAR = 3200;

/** Depth between consecutive event cards within a month. */
const EVENT_STEP = 620;
/**
 * Depth from a month's title to its first card.
 *
 * Long on purpose, and the length is not arbitrary: the title is gone by
 * TITLE_PASS_NEAR, and this is what keeps the month's first card still back in
 * the haze at that moment rather than sitting behind the letters at full
 * strength. Shorten it and the type lands on top of a photograph.
 */
const EVENT_LEAD = 2000;
/**
 * Empty depth after a month's last card, before the next month starts.
 *
 * With EVENT_LEAD this is the whole month break — the stretch the next title
 * flies through on its own. It is sized so that the incoming title is only at
 * full strength once the previous month's last card has passed the reader.
 */
const MONTH_GAP = 1400;
/**
 * The intro: the reader flies up to a camera, through its lens, and only then
 * does the first month begin. These are all depths along the same axis as the
 * photographs, so the whole page is one flight.
 */
/**
 * Depth the camera body sits at.
 *
 * Near enough that it is already out of the fog when the gate lifts — at 2600
 * it sat beyond FOG_FAR, so the reader met an empty coloured screen and had to
 * scroll on faith before anything appeared.
 */
export const INTRO_CAMERA_DEPTH = 1700;
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
 * How far off centre a photo sits.
 *
 * Placement has two parts, and they behave differently as a photo approaches.
 *
 * `hold` is measured on the screen and stays there: its world offset grows in
 * step with distance, so the photo keeps the same apparent distance from the
 * middle of the frame however far away it is. That is what keeps the centre of
 * the screen clear — nothing ever emerges from it or flies through it. It is
 * already a screen measurement, so `spread` is not applied to it; scaling it
 * with the viewport as well would have collapsed the clearance to a dozen
 * pixels on a phone, which is no clearance at all.
 *
 * `sweep` is a plain world offset, so it counts for almost nothing while the
 * photo is distant and more and more as it nears. That is the outward drift,
 * and it is deliberately wide: by the time a photo is large it is out at the
 * edge of the frame or half past it. Seeing all of a month means panning
 * around — mouse on a desktop, tilting the phone otherwise. This is the part
 * `spread` scales, so it is the same share of the frame on every screen.
 */
const CORNER = 640;
/**
 * The clearance the middle of the frame always keeps, in CSS pixels.
 *
 * Small on purpose. Dropping the photos that used to come straight down the
 * middle already empties the centre; this is what makes the clearance
 * structural rather than a side effect of how far away photos stop being
 * drawn. Raising it pushes the whole composition towards the edges of a phone
 * screen, where less of each month can be seen at once.
 */
const HOLD = 45;
/**
 * Longest edge of a card, before the narrow-screen scale. A card is a print,
 * so this covers the paper and its border as well as the photograph — it is
 * larger than the bare-photo size it replaced so the picture inside stays
 * roughly the size it always was.
 */
const BASE_SIZE = 780;

/** The viewport the whole run is authored against. */
const DESIGN_WIDTH = 1400;

/**
 * Photo *size*, designed at DESIGN_WIDTH and scaled down from there.
 *
 * The falloff is a square root rather than a straight ratio, and that is a
 * phone fix. Apparent size is governed by the *height* of the frame — the
 * camera takes its field of view from the viewport height, so one world unit
 * is one CSS pixel — while this scale is taken from the width. On a wide
 * desktop those pull the same way; on a tall narrow phone they pull apart, and
 * a straight ratio gave a card that was a sensible share of the width and a
 * tiny share of the frame, which is what made the whole scene read as further
 * away on a phone than on a laptop. The square root closes most of that gap
 * and leaves every screen at or above 1400px exactly where it was.
 */
export function planeScale(viewportWidth: number): number {
  return Math.min(1, Math.sqrt(viewportWidth / DESIGN_WIDTH));
}

/**
 * Scale for a wide object rather than a print — the intro camera's body is
 * 1150 units across where a card is 780 tall.
 *
 * planeScale's square root exists because the prints are portrait and it is
 * the *height* of the frame that governs how big they look. A landscape object
 * is governed by the width instead, so it takes the straight ratio: give it
 * the square root and the camera body hangs half a screen past both edges of a
 * phone.
 */
export function bodyScale(viewportWidth: number): number {
  return Math.min(1, viewportWidth / DESIGN_WIDTH);
}

/**
 * Photo *placement*, in proportion to the screen it is placed on.
 *
 * This used to be floored at 1, so a phone got the full desktop spread and had
 * to be panned around to reach the edges of it. In practice the outermost card
 * of a month sat the better part of two screen widths off centre and could not
 * be tapped at all. Scaling straight with the viewport instead means the same
 * arrangement covers the same share of the frame everywhere — the widest card
 * is a little over half a screen off centre on a phone exactly as it is on a
 * desktop, so it always has enough of itself on screen to be reached, and the
 * tilt still brings the rest of it in.
 */
export function spreadScale(viewportWidth: number): number {
  return viewportWidth / DESIGN_WIDTH;
}

export interface RunnerPhoto {
  key: string;
  src: string;
  monthId: string;
  /** The event this photograph belongs to. One card per event flies in the run. */
  eventId: string;
  /** Set into the print's bottom border. */
  caption: string;
  /** Index into `months` — the month this photo belongs to. */
  monthIndex: number;
  /** Index into `photos` — position along the whole run. */
  photoIndex: number;
  /**
   * Position within its own event — 0 is the cover, which is the card that
   * flies in the run; everything above 0 exists only inside the deck.
   */
  slide: number;
  /** Distance from the start of the run. Grows as the reader scrolls. */
  depth: number;
  /** Outward drift, in world units, before spreadScale(). */
  x: number;
  y: number;
  /** Clearance held from the middle of the frame, in CSS pixels at any depth. */
  holdX: number;
  holdY: number;
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
/** Screens are taller than they are wide, so the scatter is an ellipse. */
const TALL = 1.3;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A generator for one photo, seeded from its own source path.
 *
 * Deterministic per photo, which is what lets both the run and the deck give
 * the same photograph the same character — its tilt in the run, the side it
 * leans to in a pile — without either of them storing anything.
 */
export function rngFor(src: string): () => number {
  return rng(hash(src));
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
/**
 * The deck each card opens into, by event id. Plain objects only — nothing
 * here touches a texture, so holding every event's deck costs nothing until a
 * card is actually tapped and its photographs are asked for.
 */
const decks = new Map<string, RunnerPhoto[]>();

/**
 * The deck a card opens into: its own cover first, then the photographs that
 * belong to that event and appear nowhere else on the page.
 *
 * The first entry is the run card itself — the same object — so the pose the
 * deck takes over at is identical by construction rather than by arithmetic.
 * The rest inherit the cover's place in the run, because they have no place of
 * their own: they were never in it. That is what the deck flies home to.
 */
function buildDeck(cover: RunnerPhoto, event: MemoryEvent): RunnerPhoto[] {
  return [
    cover,
    ...event.photos.map((photo, i) => {
      const random = rng(hash(photo.src));
      return {
        ...cover,
        key: photo.src,
        src: photo.src,
        // A photograph says its own thing if it has one, and falls back to the
        // name of the event it belongs to if it does not.
        caption: photo.caption ?? event.title,
        slide: i + 1,
        size: BASE_SIZE * between(random, 0.86, 1.16),
        roll: between(random, -0.05, 0.05),
      };
    }),
  ];
}

{
  // Months start on the far side of the camera; nothing of them exists before it.
  let cursor = CAMERA_PASS_DEPTH + AFTER_LENS;

  months.forEach((month, monthIndex) => {
    monthDepths.push(cursor);

    month.events.forEach((event, i) => {
      const src = event.cover.src;
      const random = rng(hash(src));
      const angle = photos.length * GOLDEN_ANGLE + between(random, -0.45, 0.45);
      const radius = CORNER * between(random, 0.55, 1.25);
      const hold = HOLD * between(random, 0.8, 1.3);

      const card: RunnerPhoto = {
        key: src,
        src,
        monthId: month.id,
        eventId: event.id,
        // A card names the thing that happened, not the month it happened in —
        // the month has its own title flying through ahead of it.
        caption: event.cover.caption ?? event.title,
        monthIndex,
        photoIndex: photos.length,
        slide: 0,
        // Jitter is under half a step, so card depths stay strictly ascending
        // for nearestPhotoIndex() while the run stops reading as a ladder.
        depth: cursor + EVENT_LEAD + i * EVENT_STEP + between(random, -70, 70),
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * TALL,
        holdX: Math.cos(angle) * hold,
        holdY: Math.sin(angle) * hold * TALL,
        size: BASE_SIZE * between(random, 0.86, 1.16),
        roll: between(random, -0.05, 0.05),
      };

      photos.push(card);
      decks.set(event.id, buildDeck(card, event));
    });

    cursor = photos[photos.length - 1].depth + MONTH_GAP;
    monthSpans.push(cursor - monthDepths[monthIndex]);
  });
}

export const runnerPhotos: RunnerPhoto[] = photos;

const NO_DECK: RunnerPhoto[] = [];

/**
 * Every photograph of one event, cover first. This is the deck a tapped card
 * opens into — its own pictures, not its month's.
 */
export function photosForEvent(eventId: string | null): RunnerPhoto[] {
  return (eventId && decks.get(eventId)) || NO_DECK;
}

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
export const UNITS_PER_SCREEN = 1800;

/** How many screens of scrolling a stretch of depth is worth. */
export function screensFor(depth: number): number {
  return depth / UNITS_PER_SCREEN;
}

/**
 * How much of a photo's held offset applies at this point in its flight.
 *
 * One at the Z=0 plane, larger the further away the photo is, shrinking towards
 * zero as it reaches the camera — exactly the reciprocal of the perspective
 * division, so `holdX * holdScale(runZ)` always lands on the same number of
 * screen pixels. MonthCard and MonthDeck both place a card with
 * `(photo.holdX * holdScale(runZ) + photo.x) * spread`; they have to agree, or
 * opening a card would jump.
 */
export function holdScale(runZ: number): number {
  return (CAMERA_Z - runZ) / CAMERA_Z;
}

/** Distance from the camera at which a photo has gone entirely. */
export const PASS_NEAR = 65;
/** Where it begins to go — the last moment before the reader passes through it. */
export const PASS_FAR = 150;

/**
 * The window a month's title is on screen, in distance-from-camera.
 *
 * These live here rather than in MonthTitleRunner because they are half of the
 * spacing contract: a title is visible over TITLE_APPEAR_FAR - TITLE_PASS_NEAR
 * of depth, and a month occupies EVENT_LEAD + steps + MONTH_GAP. The second
 * number has to be the larger one, or two months name themselves at once —
 * which is exactly what the run used to do.
 *
 * TITLE_PASS_NEAR is also what caps how big the type ever gets: apparent scale
 * is CAMERA_Z / distance, so 380 means a title never rasterises past ~2x. The
 * reader still flies through the letters — at 2x they are wider than two
 * screens — without the browser being asked to re-raster a 6000px word.
 */
export const TITLE_APPEAR_FAR = 2400;
export const TITLE_APPEAR_NEAR = 2000;
export const TITLE_PASS_FAR = 700;
export const TITLE_PASS_NEAR = 380;

/**
 * Photos hold full strength all the way in and only fade as they cross the
 * camera, the same way the flying month titles do (see MonthTitleRunner). The
 * reader flies through a photograph rather than watching it wink out while it
 * is still mid-screen.
 */
export function passOpacity(distance: number): number {
  return Math.max(0, Math.min(1, (distance - PASS_NEAR) / (PASS_FAR - PASS_NEAR)));
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
