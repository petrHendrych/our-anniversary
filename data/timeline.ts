/**
 * All site content lives here — static, hand-authored, no CMS.
 *
 * A month is a list of *events*. An event is one thing that happened: it has
 * its own cover photograph — that is the card that flies past in the run — and
 * its own set of photographs, which exist nowhere else on the page and are
 * only pulled in when the reader taps that card open. Two events in the same
 * month share nothing but the month.
 *
 * Which events exist, and how many photographs each one holds, is not written
 * here — it is read from data/photos.generated.ts, which scripts/stage-originals.mjs
 * writes from the actual folders in `originals/`. An event is a *day*: the
 * import groups a month's photographs by the day they were taken, so a card in
 * the run is one day and its deck is that day's other pictures. What is written
 * here is the words — a month's title and summary, and a day's title where it
 * deserves one better than its date.
 */
import { staged, type StagedEvent } from "./photos.generated.ts";

export interface MemoryPhoto {
  id: string;
  src: string; // path under /public/images/...
  alt: string;
  caption?: string; // printed into this photo's own card; falls back to the event title
}

export interface MemoryEvent {
  id: string; // "2024-09/bridge" — unique across the site
  monthId: string; // "2024-09"
  slug: string; // "bridge" — the folder its photos live in
  title: string; // printed into the card that flies in the run
  cover: MemoryPhoto; // the card in the run
  photos: MemoryPhoto[]; // the deck behind it — loaded only when it opens
  date?: string;
  location?: string;
  notes?: string; // longer story text for this event
}

export interface Month {
  id: string; // "2024-03"
  year: number; // 2024
  monthIndex: number; // 1-12
  monthLabel: string; // "March"
  title: string; // short milestone title, e.g. "Our First Trip"
  summary: string; // 1-2 sentence teaser shown in the DOM overlay
  events: MemoryEvent[]; // one card each in the run
  date?: string; // specific date, if there's one headline event
  location?: string;
  notes?: string; // longer story text
}

export interface YearBlock {
  year: number;
  label: string; // "Year One"
  months: Month[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The run starts here and covers every month since, with no gaps. */
const START_YEAR = 2024;
const START_MONTH = 9;
const MONTH_COUNT = 24;

/**
 * Words for one day, over and above the date it already has.
 *
 * The photographs and their count come from the import, so an entry here only
 * ever adds text — there is no way to name a day that has no pictures, and no
 * way for the count to drift from the files on disk.
 */
interface WrittenEvent {
  title?: string;
  location?: string;
  notes?: string;
}

interface WrittenMonth {
  title?: string;
  summary?: string;
  date?: string;
  location?: string;
  notes?: string;
  /** Keyed by day-of-month, exactly as the folder under this month is named. */
  days?: Record<string, WrittenEvent>;
}

/**
 * The months whose words have been written.
 *
 * Every month has its photographs already; this is only the copy. A month
 * missing from here still runs — it carries its days as cards titled by their
 * date, and reads "Still to be written." in the overlay until it gets a line.
 */
const written: Record<string, WrittenMonth> = {
  "2024-09": {
    title: "The First Night",
    summary:
      "A coffee that was supposed to take an hour and somehow took until the trams stopped running.",
    date: "2024-09-14",
    location: "Prague",
    notes:
      "Neither of us remembers who suggested walking to the river. What we do remember is standing on the bridge arguing about whether the swans were asleep, and the exact moment it stopped feeling like a first date.",
  },
  "2024-12": {
    title: "Rain and Ramen",
    summary: "The grey month. We stayed inside and made it the best one anyway.",
  },
  "2025-04": {
    title: "The Apartment",
    summary: "Keys, boxes, and one plant that did not survive the move.",
    date: "2025-04-03",
    location: "Prague",
    notes:
      "We ate the first dinner on the floor because the table came a week later. Best meal of the year.",
  },
  "2025-09": {
    title: "Salt and Sunburn",
    summary:
      "Our first trip together. Four days, one very small rental car, zero regrets.",
    location: "Istria, Croatia",
    notes:
      "You insisted we take the coastal road even though it added two hours. You were right. You are usually right about roads.",
  },
  "2026-01": {
    title: "Snow Week",
    summary:
      "You learned to snowboard. I learned how many times a person can fall over and still be smug about it.",
    location: "\u0160pindler\u016fv Ml\u00fdn",
    notes: "Day three was the good one. Empty slope, no wind, the light going gold at four.",
  },
  "2026-05": {
    title: "The Long Way Home",
    summary: "No plan, a full tank, and every detour we felt like taking.",
    location: "Somewhere in Moravia",
  },
};

/**
 * What a day's card says when nobody has written it a title: the date itself.
 *
 * Short on purpose. The month and the year are already flying past in the
 * overlay as the reader reaches these cards, so a card repeating them would be
 * the third time in one screen.
 */
function dateTitle(slug: string, monthLabel: string): string {
  return `${Number(slug)} ${monthLabel}`;
}

function buildEvent(
  monthId: string,
  monthLabel: string,
  event: StagedEvent,
  overlay: WrittenEvent | undefined,
): MemoryEvent {
  const dir = `/images/${monthId}/${event.slug}`;
  const title = overlay?.title ?? dateTitle(event.slug, monthLabel);

  return {
    id: `${monthId}/${event.slug}`,
    monthId,
    slug: event.slug,
    title,
    date: event.date,
    location: overlay?.location,
    notes: overlay?.notes,
    cover: {
      id: `${monthId}-${event.slug}-cover`,
      src: `${dir}/cover.jpg`,
      alt: title,
    },
    photos: Array.from({ length: event.photos }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return {
        id: `${monthId}-${event.slug}-${n}`,
        src: `${dir}/${n}.jpg`,
        alt: `${title} \u2014 photo ${i + 1}`,
      };
    }),
  };
}

function buildMonth(i: number): Month {
  const offset = START_MONTH - 1 + i;
  const year = START_YEAR + Math.floor(offset / 12);
  const monthIndex = (offset % 12) + 1;
  const monthLabel = MONTH_NAMES[monthIndex - 1];
  const id = `${year}-${String(monthIndex).padStart(2, "0")}`;
  const entry = written[id];

  return {
    id,
    year,
    monthIndex,
    monthLabel,
    title: entry?.title ?? `${monthLabel} ${year}`,
    summary: entry?.summary ?? "Still to be written.",
    date: entry?.date,
    location: entry?.location,
    notes: entry?.notes,
    // A month with no folder under `originals/` has no cards at all. That is
    // the honest answer and not a crash: import its photographs and it fills in.
    events: (staged[id] ?? []).map((event) =>
      buildEvent(id, monthLabel, event, entry?.days?.[event.slug]),
    ),
  };
}

const allMonths: Month[] = Array.from({ length: MONTH_COUNT }, (_, i) => buildMonth(i));

/**
 * Two anniversary years, twelve months each — September to August, not January
 * to December. lib/timeline's spine draws its ticks the same way.
 */
export const timeline: YearBlock[] = [
  { year: 2024, label: "Year One", months: allMonths.slice(0, 12) },
  { year: 2025, label: "Year Two", months: allMonths.slice(12) },
];
