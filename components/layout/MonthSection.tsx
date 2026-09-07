import type { Month } from "@/data/timeline";
import { monthDepthSpans, screensFor } from "@/lib/runner-layout";
import { sectionId } from "@/lib/timeline";

/**
 * One month's slot in the scroll.
 *
 * The section's only job is to be exactly as long as the month is deep: its
 * height is derived from the month's depth in the runner (photo count plus the
 * gap after it), which is what lets ScrollDriver map scroll to depth at an
 * even rate across months of different sizes.
 *
 * The photos themselves are drawn by the WebGL runner behind this, which is
 * why there are no images here. The copy is sticky, so a month's title holds
 * at the bottom of the screen for as long as the reader is flying through that
 * month, then hands over to the next.
 *
 * "Hands over" is not free: a sticky block lets go once its section's bottom
 * reaches the bottom of the screen, and then rides up the last screenful —
 * straight through the next month's title, which is flying past at exactly
 * that point. So the frame is tagged for ScrollDriver, which fades it out
 * across that last screen. On a phone, where the title fills the frame, that
 * collision was the whole of the clutter.
 */
export function MonthSection({ month, index }: { month: Month; index: number }) {
  const meta = [month.date, month.location].filter(Boolean).join(" · ");
  const screens = screensFor(monthDepthSpans[index]);

  return (
    <section
      id={sectionId(month.id)}
      data-month-index={index}
      className="relative z-10"
      style={{ height: `${(screens * 100).toFixed(1)}svh` }}
    >
      {/* The section is measured in svh and the frame inside it in dvh, and
          the two units are doing different jobs. The section is scroll length:
          it must not change when a phone slides its URL bar away, or the map
          from scroll to depth would move under the reader mid-flight — which
          is also why ScrollTrigger runs with ignoreMobileResize. The frame is
          where the copy sits on the glass, and there svh is simply wrong: it
          is the height with the browser chrome *showing*, so once the chrome
          slides off the text hangs a chrome's worth above the bottom of the
          screen, which on a phone is most of a thumb. dvh is the viewport the
          reader is actually looking at. */}
      <div
        data-month-copy-frame
        className="sticky top-0 flex h-dvh flex-col justify-end px-5 pb-[calc(2.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(5rem+env(safe-area-inset-bottom))]"
      >
        <div data-month-copy className="max-w-[19rem] sm:max-w-[21rem]">
          <p className="eyebrow text-dim">
            {month.monthLabel} {month.year}
          </p>
          <h3 className="display mt-2 text-[1.75rem] sm:text-[2rem]">{month.title}</h3>
          <p className="mt-3 text-[0.875rem] leading-6 text-dim sm:text-[0.9375rem]">
            {month.summary}
          </p>
          {meta && <p className="eyebrow mt-4 text-bone/40">{meta}</p>}
        </div>
      </div>
    </section>
  );
}
