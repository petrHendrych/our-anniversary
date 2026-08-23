import type { YearBlock } from "@/data/timeline";

/**
 * The year exists for structure and for screen readers only. Its visible
 * expression is the year label riding along with each month title as that
 * title flies through the scene — see MonthTitleRunner.
 */
export function YearHeader({ year }: { year: YearBlock }) {
  return <h2 className="sr-only">{year.label}</h2>;
}
