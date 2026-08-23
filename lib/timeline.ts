/**
 * Derived views over the static timeline data.
 *
 * The flat `months` array is the canonical ordering for everything downstream:
 * scroll progress, the side nav, and later the 3D card positions all index
 * into it, so a card's global index is the same number in every layer.
 */
import { timeline, type Month, type YearBlock } from "@/data/timeline";

export const years: YearBlock[] = timeline;

export const months: Month[] = timeline.flatMap((year) => year.months);

export const monthCount = months.length;

const indexById = new Map(months.map((month, i) => [month.id, i]));

export function getMonthIndex(id: string): number {
  const index = indexById.get(id);
  if (index === undefined) throw new Error(`Unknown month id: ${id}`);
  return index;
}

export function getMonth(id: string): Month {
  return months[getMonthIndex(id)];
}

/** Scroll progress (0-1) at which a given month sits at the centre of the run. */
export function monthProgress(index: number): number {
  return monthCount > 1 ? index / (monthCount - 1) : 0;
}

/** Flat list the side nav renders: year headings with their months inline. */
export const navItems: Array<
  | { kind: "year"; year: number; label: string }
  | { kind: "month"; id: string; label: string; index: number }
> = timeline.flatMap((year) => [
  { kind: "year" as const, year: year.year, label: year.label },
  ...year.months.map((month) => ({
    kind: "month" as const,
    id: month.id,
    label: month.monthLabel,
    index: getMonthIndex(month.id),
  })),
]);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface SpineTick {
  key: string;
  year: number;
  monthIndex: number;
  label: string;
  /** Null for months with nothing recorded — the gaps are the point. */
  monthId: string | null;
  index: number | null;
}

/**
 * Every month of both years, recorded or not.
 *
 * A "year" here is an anniversary year, not a calendar one: it runs twelve
 * months from whenever that year's first recorded month falls, so Year One
 * starts in September and rolls over into the next calendar year partway
 * through. The nav draws all twelve ticks and lights only the months we
 * actually wrote something for, so the empty stretches stay visible instead of
 * being collapsed away.
 */
export const spineTicks: SpineTick[] = timeline.flatMap((year) => {
  const first = year.months[0];
  return Array.from({ length: 12 }, (_, i) => {
    const offset = first.monthIndex - 1 + i;
    const monthIndex = (offset % 12) + 1;
    const calendarYear = first.year + Math.floor(offset / 12);
    const month = year.months.find(
      (m) => m.monthIndex === monthIndex && m.year === calendarYear,
    );
    return {
      key: `${calendarYear}-${String(monthIndex).padStart(2, "0")}`,
      year: calendarYear,
      monthIndex,
      label: MONTH_NAMES[monthIndex - 1],
      monthId: month?.id ?? null,
      index: month ? getMonthIndex(month.id) : null,
    };
  });
});

/** "March 2024 — September 2025" */
export const rangeLabel = `${months[0].monthLabel} ${months[0].year} — ${
  months[monthCount - 1].monthLabel
} ${months[monthCount - 1].year}`;

/** DOM id for a month's scroll section; also the scroll-to target. */
export function sectionId(monthId: string): string {
  return `month-${monthId}`;
}
