import { INTRO_DEPTH, screensFor } from "@/lib/runner-layout";

/**
 * The scroll length of the flight up to the camera.
 *
 * Nothing but height. The title and the range used to be set here, but the
 * loading gate says all of that now and then lifts away — repeating it over the
 * camera would be reading the reader the same page twice. So the far side of
 * the gate is the camera alone, hanging in the haze, and this section is only
 * what makes the scroll long enough to reach it.
 *
 * Its height is the intro's depth in the runner, at the same pace as every
 * month, so scrolling through the approach and scrolling through a month feel
 * like the same movement.
 */
export function IntroSection() {
  const screens = screensFor(INTRO_DEPTH);

  return (
    <section
      aria-hidden
      className="relative z-10"
      style={{ height: `${(screens * 100).toFixed(1)}svh` }}
    />
  );
}
