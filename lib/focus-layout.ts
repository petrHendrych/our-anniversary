import { CAMERA_Z } from "@/lib/runner-layout";

/**
 * Where a tapped card lands.
 *
 * The print is placed in *camera space* — a fixed distance straight down the
 * camera's own axis, turned to face it — so it is centred and face-on however
 * the camera happens to be leaning at the time. That is what lets the tilt
 * simply freeze when a card opens instead of having to swing back to level
 * before the flight arrives.
 *
 * FOCUS_DISTANCE is deliberately nearer than any card still being drawn:
 * MonthCard culls at `z >= PASSED (240)`, i.e. at distances greater than
 * `CAMERA_Z - 240 = 560`. Raising PASSED means lowering this. The pile behind
 * the front card reaches back a further `visibleDepth * DECK_STEP` (see
 * lib/deck-layout), and all of it has to stay in front of the camera.
 *
 * The scene is built so one world unit is one CSS pixel at the Z=0 plane, so a
 * world size S at distance D covers `S * CAMERA_Z / D` pixels. Everything below
 * is that identity read forwards and backwards — it is what lets the deck be
 * laid out in pixels and placed in world units without ever projecting a mesh.
 */

export const FOCUS_DISTANCE = 520;

/** Widest the print may be, as a fraction of the viewport. */
const BOX_W = 0.88;
/** Tallest it may be. Nothing sits underneath the card any more, so it can
    take most of the height. */
const BOX_H_PORTRAIT = 0.68;
const BOX_H_LANDSCAPE = 0.74;
/** How far above centre the print sits, as a fraction of viewport height —
    barely at all, now that it is the only thing on screen. */
const RISE_PORTRAIT = 0.02;
const RISE_LANDSCAPE = 0.02;

export interface FocusPose {
  /** Multiplier on the card's resting world scale. */
  zoom: number;
  /** Camera-local +Y offset in world units. */
  rise: number;
}

/** Fits a card of this resting world size into the focus box. */
export function focusPose(
  viewportWidth: number,
  viewportHeight: number,
  restWidth: number,
  restHeight: number,
): FocusPose {
  const portrait = viewportHeight >= viewportWidth;
  const boxH = portrait ? BOX_H_PORTRAIT : BOX_H_LANDSCAPE;
  const riseShare = portrait ? RISE_PORTRAIT : RISE_LANDSCAPE;

  // Contain-fit, in CSS pixels.
  const fit = Math.min(
    (viewportWidth * BOX_W) / restWidth,
    (viewportHeight * boxH) / restHeight,
  );
  // Pixels back into world units at the focus distance.
  const perPixel = FOCUS_DISTANCE / CAMERA_Z;

  return {
    zoom: fit * perPixel,
    rise: viewportHeight * riseShare * perPixel,
  };
}
