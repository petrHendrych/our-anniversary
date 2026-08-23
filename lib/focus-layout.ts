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
 * `CAMERA_Z - 240 = 560`. Raising PASSED means lowering this.
 *
 * The scene is built so one world unit is one CSS pixel at the Z=0 plane, so a
 * world size S at distance D covers `S * CAMERA_Z / D` pixels. Everything below
 * is that identity read forwards and backwards, which is also how the DOM
 * column underneath knows where the card's bottom edge will be without ever
 * projecting the mesh.
 */

export const FOCUS_DISTANCE = 520;

/** Widest the print may be, as a fraction of the viewport. */
const BOX_W = 0.88;
/** Tallest it may be — shorter in portrait, where the copy needs the room. */
const BOX_H_PORTRAIT = 0.58;
const BOX_H_LANDSCAPE = 0.74;
/** How far above centre the print sits, as a fraction of viewport height. */
const RISE_PORTRAIT = 0.07;
const RISE_LANDSCAPE = 0.02;

/** Gap between the bottom edge of the print and the copy beneath it, in pixels. */
export const FOCUS_GAP = 20;

export interface FocusPose {
  /** Multiplier on the card's resting world scale. */
  zoom: number;
  /** Camera-local +Y offset in world units — lifts the print off the copy. */
  rise: number;
  /** Viewport Y, in pixels, of the bottom edge of the landed print. */
  bottom: number;
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
    bottom: viewportHeight * (0.5 - riseShare) + (restHeight * fit) / 2,
  };
}
