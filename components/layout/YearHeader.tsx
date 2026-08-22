import type { YearBlock } from "@/data/timeline";

/**
 * Atmosphere layer, not a banner. The year label pins behind its own months
 * and the cards pass over it — once the WebGL runner lands, literally so.
 *
 * The pin itself is CSS sticky; ScrollDriver only fades it in and out.
 */
export function YearHeader({ year }: { year: YearBlock }) {
  return (
    <div className="pointer-events-none sticky top-0 z-0 -mb-[100svh] flex h-[100svh] flex-col items-center justify-center">
      <div data-year-ghost className="flex flex-col items-center">
        <span className="eyebrow text-dim">{year.year}</span>
        <span
          aria-hidden
          className="display mt-2 text-[26vw] leading-none text-bone/[0.07]"
        >
          {year.label}
        </span>
      </div>
      <h2 className="sr-only">{year.label}</h2>
    </div>
  );
}
