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
      <div className="sticky top-0 flex h-svh flex-col justify-end px-5 pb-24">
        <div data-month-copy className="max-w-[21rem]">
          <p className="eyebrow text-dim">
            {month.monthLabel} {month.year}
          </p>
          <h3 className="display mt-2 text-[2rem]">{month.title}</h3>
          <p className="mt-3 text-[0.9375rem] leading-6 text-dim">
            {month.summary}
          </p>
          {meta && <p className="eyebrow mt-4 text-bone/40">{meta}</p>}
        </div>
      </div>
    </section>
  );
}
