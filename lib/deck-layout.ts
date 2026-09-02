import { rngFor } from "@/lib/runner-layout";

/**
 * The pile of photographs behind an open card.
 *
 * One float — the cursor — drives the whole thing. A whole number means the
 * deck is settled on that photograph; dragging moves it continuously, and the
 * ring wraps so the reader can go round a month for ever.
 *
 * The wrap is the delicate part. A card being swiped away has a *negative*
 * ring offset, and the moment it passes -1 the arithmetic flips it to the back
 * of the pile. That jump is only invisible because both ends of the range
 * describe the same pose — far back, dead centre, fully transparent. Every
 * curve below is shaped to arrive there: `peek` is a sine that returns to zero,
 * and `alpha` reaches zero exactly at the seam. Change one and the deck will
 * blink once per lap.
 */

/** World units a card falls back per place in the pile. */
export const DECK_STEP = 45;
/** How far a card leans out sideways at the fattest part of the pile. */
const PEEK = 0.19;
/** Nothing is drawn deeper than this many places back. */
const MAX_VISIBLE = 4;

/** Places in the pile that are drawn at all, for a deck of `count` photos. */
export function visibleDepth(count: number): number {
  return Math.max(1, Math.min(MAX_VISIBLE, count - 1));
}

/**
 * Cards mounted past the back of the visible pile.
 *
 * The pile draws `visibleDepth` places back and everything beyond that is at
 * alpha zero, so those are the only ones worth *drawing* — but a card has to
 * be mounted before it can be baked, and a texture that starts baking the
 * frame it becomes visible arrives too late. Two places of lead is the
 * difference between swiping into a photograph and swiping into a gap.
 */
const MOUNT_LEAD = 2;

/**
 * Which photographs of a deck are mounted, given the card at the front.
 *
 * An event's whole set used to mount at once, which was fine while a set was
 * four to eight pictures: only the front few are ever drawn, and the rest sat
 * at alpha zero costing a texture each. At forty pictures that is forty prints
 * baked and resident on top of the run's own window, which is well past what
 * mobile Safari will hold — so the ring is windowed the same way the run is.
 *
 * One card behind the front (the one on its way out, at offset -1), the
 * visible pile, and MOUNT_LEAD past it. The modulo folds duplicates together,
 * so a deck smaller than the window mounts all of itself and nothing changes
 * for a small event.
 */
export function deckWindow(slot: number, count: number): Set<number> {
  const wanted = new Set<number>();
  if (count <= 0) return wanted;
  const span = visibleDepth(count) + MOUNT_LEAD;
  for (let k = -1; k <= span; k++) {
    wanted.add((((slot + k) % count) + count) % count);
  }
  // The cover, wherever the reader has spun to. It costs no bake — the run
  // card it came from is holding that same print — and closing winds the deck
  // back to it, which is the one card that has to be there when it lands.
  wanted.add(0);
  return wanted;
}

/**
 * Where card `i` sits relative to the front of the deck, in [-1, count - 1].
 * Zero is the card being looked at; -1 is the same slot as the very back.
 */
export function ringOffset(i: number, cursor: number, count: number): number {
  const raw = i - cursor + 1;
  return (((raw % count) + count) % count) - 1;
}

export interface DeckSeed {
  /** Which way this photograph leans out of the pile. */
  side: number;
  /** Its own tilt, radians. */
  lean: number;
}

/** Seeded from the source path, so a photograph always leans the same way. */
export function deckSeed(src: string): DeckSeed {
  const random = rngFor(src);
  return {
    side: random() < 0.5 ? -1 : 1,
    lean: (random() - 0.5) * 0.18,
  };
}

export interface PilePose {
  /** Extra distance behind the focus plane, in world units. */
  back: number;
  /** Sideways offset at the focus plane, in CSS pixels. */
  peek: number;
  /** Roll, in radians. */
  lean: number;
  /** 1 in the pile, 0 once parked at the back. */
  alpha: number;
  /** Higher draws later — the pile composites strictly front over back. */
  order: number;
}

export function pilePose(
  offset: number,
  count: number,
  viewportWidth: number,
  seed: DeckSeed,
): PilePose {
  const visible = visibleDepth(count);
  // A card on its way out travels to the same place the backmost card already
  // sits, over the half-lap it has to get there.
  const u = Math.min(visible, offset < 0 ? -offset * visible : offset);
  // Only a swipe leftwards sends a card through the negative offsets, so a
  // card on its way out always sweeps left before tucking in behind the one
  // replacing it, whichever side it leans to at rest. The seam is safe: peek
  // is zero at both ends of the range, so the side can flip there unseen.
  const side = offset < 0 ? -1 : seed.side;

  return {
    back: u * DECK_STEP,
    // Zero at the front and zero again at the very back, fattest in between:
    // the pile bulges out and tucks itself back in.
    peek: side * PEEK * viewportWidth * Math.sin((Math.PI * u) / visible),
    lean: seed.lean * Math.min(u, 1),
    alpha: Math.max(0, Math.min(1, visible - u)),
    order: Math.round(100 - u * 10),
  };
}
