import type { Month } from "@/data/timeline";
import { sectionId } from "@/lib/timeline";

/**
 * One month's slot in the scroll.
 *
 * The section provides the scroll length and the text; the photo itself is
 * drawn by the WebGL runner behind it, which is why there is no image here.
 * Copy sits at the bottom so the card has the middle of the screen.
 */
export function MonthSection({ month, index }: { month: Month; index: number }) {
  const meta = [month.date, month.location].filter(Boolean).join(" · ");

  return (
    <section
      id={sectionId(month.id)}
      data-month-index={index}
      className="relative z-10 flex min-h-[100svh] flex-col justify-end px-5 pb-24"
    >
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
    </section>
  );
}
