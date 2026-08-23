import { CalendarSpine } from "@/components/layout/CalendarSpine";
import { TiltPrompt } from "@/components/layout/TiltPrompt";
import { INTRO_DEPTH, screensFor } from "@/lib/runner-layout";
import { monthCount, rangeLabel } from "@/lib/timeline";

/**
 * The title, and the scroll length of the flight up to the camera.
 *
 * Its height is the intro's depth in the runner, at the same pace as every
 * month, so scrolling through the title and scrolling through a month feel
 * like the same movement. The copy is sticky and fades out as the camera fills
 * the screen — ScrollDriver drives that; see [data-intro-copy].
 */
export function IntroSection() {
  const screens = screensFor(INTRO_DEPTH);

  return (
    <section
      data-intro
      className="relative z-10"
      style={{ height: `${(screens * 100).toFixed(1)}svh` }}
    >
      <div
        data-intro-copy
        className="sticky top-0 flex h-svh flex-col justify-between px-5 pb-12 pt-28"
      >
        <div className="flex flex-1 flex-col justify-center">
          <p className="eyebrow text-dim">{rangeLabel}</p>
          <h1 className="display mt-4 text-[22vw]">Two years</h1>
          <p className="mt-6 max-w-[22rem] text-[0.9375rem] leading-6 text-dim">
            {monthCount} months we wrote down, in the order they happened.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <CalendarSpine orientation="horizontal" />
          <TiltPrompt />
          <p className="eyebrow text-bone/40">Scroll</p>
        </div>
      </div>
    </section>
  );
}
