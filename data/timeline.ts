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
 * The words.
 *
 * Every month below already has its photographs; this is the only place the
 * copy lives, and every field in it is optional. A month left empty runs
 * exactly as it stands — its cards are titled by their dates, its heading is
 * the month and the year, and its summary reads "Still to be written." — so
 * filling one in is additive and nothing has to be done in order.
 *
 * The comment over each month says what is actually in it: how many days, how
 * many photographs, and then every day it holds with that day's picture count,
 * so a day worth naming can be found without opening the folder.
 *
 *   "2025-05": {
 *     title: "…",              // the big line at the bottom of the screen
 *     summary: "…",            // the paragraph under it
 *     date: "2025-05-09",      // ┐ joined with " · " into the small line
 *     location: "…",           // ┘ beneath that; either may stand alone
 *     notes: "…",              // longer story text — nothing renders it yet
 *     days: {
 *       "09": {                // the folder name under public/images/2025-05
 *         title: "…",          // printed into that card, in place of its date
 *         location: "…",
 *         notes: "…",
 *       },
 *     },
 *   },
 */
const written: Record<string, WrittenMonth> = {
  // September 2024 — 5 days, 19 photographs
  // 03×2 04×5 14×1 15×9 17×2
  "2024-09": {
    title: "Where It Starts",
    summary:
      "A night that ran late, an afternoon on the sofa that produced more photographs than it had any right to, and a coat tried on in a bedroom on the 15th.",
    days: {
      "04": { title: "The Sofa" },
      "14": { title: "At the Desk" },
      "15": { title: "The New Coat" },
      "17": { title: "Sushi, and the Shops" },
    },
  },
  // October 2024 — 16 days, 36 photographs
  // 01×7 03×2 05×1 07×1 09×3 10×1 11×1 20×2 22×2 23×1 24×1 26×2 27×3 28×1 30×7 31×1
  "2024-10": {
    title: "Sixteen Days in October",
    summary:
      "The month it stopped being occasional. Fries in a plastic booth, a monument climbed on a grey afternoon, a blue dress tried on for no occasion at all, and one bathroom mirror that saw a lot of use.",
    days: {
      "09": { title: "Feet, Apparently" },
      "26": { title: "The Monument" },
      "27": { title: "The Blue Dress" },
      "30": { title: "The Rainbow Platter" },
    },
  },
  // November 2024 — 6 days, 18 photographs
  // 04×6 11×2 14×1 21×1 25×5 26×3
  "2024-11": {
    title: "Wind and Blankets",
    summary:
      "Brunch, then a walk out to the rocks with the wind doing the styling. The rest of the month was spent horizontal, and on the 25th, doing each other's feet.",
    days: {
      "04": { title: "The Windy Walk" },
      "25": { title: "Feet Duty" },
    },
  },
  // December 2024 — 10 days, 40 photographs
  // 03×3 04×11 05×1 09×3 10×2 13×3 16×2 19×8 30×1 31×6
  "2024-12": {
    title: "Cats, Lights and the Last Night",
    summary:
      "The 4th was the whole month in one day: a cat café in the afternoon, then the old town under those blue umbrella lights. It ends with sparklers and a kiss at midnight.",
    days: {
      "04": { title: "Cats, Then Lights" },
      "13": { title: "The Black Dog" },
      "19": { title: "The Pink Café" },
      "31": { title: "Sparklers" },
    },
  },
  // January 2025 — 12 days, 36 photographs
  // 02×6 04×2 05×2 06×4 09×2 10×4 11×1 14×5 21×2 23×2 30×1 31×5
  "2025-01": {
    title: "Back to the Lanes",
    summary:
      "The season starts again. Sushi and the gym on the 2nd, the dog delivered to the groomer looking betrayed on the 5th, a LEGO bonsai built slowly on the 10th, and a piña colada the size of a lamp on the 31st.",
    days: {
      "02": { title: "Sushi, Then the Gym" },
      "05": { title: "Groomer Day" },
      "06": { title: "First Lanes of the Year" },
      "10": { title: "The Bonsai" },
      "31": { title: "The Big Cocktail" },
    },
  },
  // February 2025 — 7 days, 16 photographs
  // 08×1 11×1 12×1 13×9 14×2 20×1 26×1
  "2025-02": {
    title: "Orchids and Pickled Everything",
    summary:
      "Half of it on a video call. Then the 13th: a LEGO orchid handed over, a bike helmet worn indoors for no reason, and nine photographs of it.",
    days: {
      "08": { title: "Through a Screen" },
      "13": { title: "The Orchid" },
      "20": { title: "The Dog in Sunglasses" },
      "26": { title: "Pizza and Aperol" },
    },
  },
  // March 2025 — 13 days, 36 photographs
  // 03×1 04×3 05×2 06×1 08×2 10×1 13×8 17×3 21×5 22×1 24×2 29×6 30×1
  "2025-03": {
    title: "A Sky, a Loaf, and a Wall of Wine",
    summary:
      "A sunset worth stopping the car for on the 4th, banana bread and a board game on the 5th, and on the 13th a shop with a heart built out of wine bottles — and a baby held in the evening.",
    days: {
      "04": { title: "The Sky on the 4th" },
      "05": { title: "Banana Bread" },
      "13": { title: "The Wine Wall" },
      "24": { title: "A Screen Full of Code" },
      "29": { title: "Face Masks" },
    },
  },
  // April 2025 — 11 days, 26 photographs
  // 05×2 06×3 13×1 15×1 16×3 17×1 22×1 23×5 25×3 28×3 29×3
  "2025-04": {
    title: "The Club, and the First Blossom",
    summary:
      "Green jerseys and a table full of half-drunk beers at the club, matching white trainers on the 13th, and a street that turned pink at the end of the month.",
    days: {
      "05": { title: "The Club Photo" },
      "13": { title: "Matching Shoes" },
      "22": { title: "The Pink Street" },
      "29": { title: "The Grey Cat" },
    },
  },
  // May 2025 — 12 days, 50 photographs
  // 01×1 02×7 03×1 09×10 14×1 15×9 17×2 18×7 19×1 23×4 24×5 25×2
  "2025-05": {
    title: "The Puppy, and the Confetti",
    summary:
      "The 2nd is the day the dog arrives — a garden, a summer dress, a puppy that fits in two arms. Then a newborn to meet on the 3rd, and on the 9th a stage with fire on it and confetti coming down for ten minutes.",
    days: {
      "02": { title: "The Day the Dog Arrived" },
      "03": { title: "Someone New" },
      "09": { title: "Fire and Confetti" },
      "14": { title: "Heart-Shaped Toast" },
      "15": { title: "First Walk in the Field" },
      "18": { title: "Bubbles in the Garden" },
    },
  },
  // June 2025 — 14 days, 41 photographs
  // 08×1 10×1 12×3 13×3 14×4 17×1 18×1 19×5 24×2 25×6 26×1 27×4 29×8 30×1
  "2025-06": {
    title: "Strawberries, Then South",
    summary:
      "Watermelon carried through a supermarket, strawberries eaten standing up, a drum kit sat behind for exactly one photograph — and then on the 27th the car points south and does not stop until the sea.",
    days: {
      "12": { title: "The Watermelon" },
      "14": { title: "Strawberries" },
      "18": { title: "The Drum Kit" },
      "26": { title: "The Paddling Pool" },
      "27": { title: "The Drive South" },
      "29": { title: "Zadar, and the Sunburn" },
    },
  },
  // July 2025 — 14 days, 31 photographs
  // 01×9 02×2 03×2 04×3 05×3 06×1 07×1 09×1 15×1 19×2 21×2 27×1 28×2 29×1
  "2025-07": {
    title: "The Adriatic",
    summary:
      "A week of pine shade and pebble beaches: two blue cocktails held up against the sky on the 2nd, and on the 5th a sunset neither of us moved for. The rest of the month was recovery, a wheat field, and IKEA.",
    days: {
      "01": { title: "The First Morning" },
      "02": { title: "Two Blue Cocktails" },
      "05": { title: "The Sunset on the 5th" },
      "19": { title: "The Inflatable Pool" },
      "21": { title: "The Wheat Field" },
      "28": { title: "IKEA" },
    },
  },
  // August 2025 — 5 days, 20 photographs
  // 03×2 06×1 11×1 12×14 14×2
  "2025-08": {
    title: "Mini-Golf and the Lookout",
    summary:
      "One long day on the 12th and not much else: a cat on the steps, a round of mini-golf nobody won, and then the climb up to the lookout tower with the light going gold behind it.",
    days: {
      "06": { title: "The Bouquets" },
      "12": { title: "Mini-Golf, Then the Tower" },
    },
  },
  // September 2025 — 4 days, 4 photographs
  // 03×1 04×1 21×1 27×1
  "2025-09": {
    title: "One Year",
    summary:
      "Four photographs for the whole month, and one of them is the bouquet on the 4th. Some months are like that, and it does not make them smaller.",
    days: {
      "03": { title: "Breakfast on the 3rd" },
      "04": { title: "One Year" },
    },
  },
  // October 2025 — 13 days, 43 photographs
  // 01×1 07×11 12×1 18×3 19×4 20×9 22×2 24×4 25×4 26×1 28×1 29×1 30×1
  "2025-10": {
    title: "Gold Everywhere",
    summary:
      "Mini-golf under blacklight on the 7th, eleven photographs of it. Then the best fortnight of light all year — a viewpoint with a mesh floor on the 20th, a concert on the 24th, and one yellow tree on the 26th.",
    days: {
      "07": { title: "Mini-Golf in the Dark" },
      "18": { title: "Leaves, and the Dog" },
      "20": { title: "The Viewpoint" },
      "22": { title: "The Lilies" },
      "24": { title: "The Concert" },
      "26": { title: "The Yellow Tree" },
    },
  },
  // November 2025 — 9 days, 16 photographs
  // 01×3 02×1 04×4 05×1 11×1 23×2 27×2 28×1 30×1
  "2025-11": {
    title: "Sushi at the Kitchen Table",
    summary:
      "Grey outside, so the month came indoors: rolling sushi at home on the 4th with a jigsaw half-finished at the other end of the table, and the lanes on the 23rd.",
    days: {
      "01": { title: "The Plush Hat" },
      "04": { title: "Rolling Sushi" },
      "23": { title: "League Night" },
    },
  },
  // December 2025 — 13 days, 28 photographs
  // 01×1 02×2 03×1 08×1 11×1 12×1 13×11 18×3 19×1 20×2 22×1 28×2 30×1
  "2025-12": {
    title: "Lights, and the Long 13th",
    summary:
      "The 13th ran from a nativity sheep in the morning to a whole street of red lights and a crystal arcade at night — eleven photographs and still not the whole day. Fairy lights behind everything from the 18th on.",
    days: {
      "03": { title: "The Market Cup" },
      "13": { title: "The Long 13th" },
      "18": { title: "Fairy Lights" },
      "30": { title: "Almost the New Year" },
    },
  },
  // January 2026 — 9 days, 33 photographs
  // 02×1 03×1 04×9 07×4 08×1 09×6 14×5 23×1 29×5
  "2026-01": {
    title: "First Place",
    summary:
      "On the 4th: the regional championship, 565, and first place — a trophy in one hand and the diploma in the other. Later that day, a newborn held very carefully. The cat arrives on the 9th and takes over the camera roll for good.",
    days: {
      "04": { title: "565, and First Place" },
      "09": { title: "The Ginger Cat" },
      "14": { title: "Larking About" },
    },
  },
  // February 2026 — 9 days, 20 photographs
  // 12×1 14×1 16×2 17×6 22×4 23×2 25×1 26×1 27×2
  "2026-02": {
    title: "Pickles, and a Full Floor",
    summary:
      "A box of six arrived on the 16th. On the 17th, six photographs of eating pickles straight out of the jar. And on the 27th, a dog and two people asleep on the same floor.",
    days: {
      "16": { title: "The Box of Six" },
      "17": { title: "Straight From the Jar" },
      "23": { title: "The Badminton Court" },
      "27": { title: "Everyone Asleep" },
    },
  },
  // March 2026 — 12 days, 22 photographs
  // 01×1 03×1 09×1 10×1 13×2 18×8 19×1 20×1 21×1 22×2 26×2 30×1
  "2026-03": {
    title: "Lilies and Lanes",
    summary:
      "Flowers twice — red on the 9th, pink with a note propped against the vase on the 13th. The 18th went to the garden and the dog, who spent most of it being carried.",
    days: {
      "13": { title: "Para Mi Amor" },
      "18": { title: "Carried Around the Garden" },
      "26": { title: "Name on the Board" },
    },
  },
  // April 2026 — 13 days, 29 photographs
  // 01×1 02×1 03×10 04×1 07×1 14×1 17×6 19×2 20×1 23×1 24×2 25×1 26×1
  "2026-04": {
    title: "Blossom",
    summary:
      "Ten photographs on the 3rd, most of them the same white tree on the same path. Then the pink one on the 17th, and a kiss underneath it that made the shot.",
    days: {
      "03": { title: "The Long Blossom Walk" },
      "14": { title: "The Cat on the Wall" },
      "17": { title: "Under the Pink Tree" },
      "24": { title: "A Rose, in Bed" },
    },
  },
  // May 2026 — 11 days, 30 photographs
  // 01×1 02×10 03×3 05×2 08×2 10×3 11×4 21×1 27×1 28×1 29×2
  "2026-05": {
    title: "Bubbles, Then a Castle",
    summary:
      "The 2nd started with a dog chasing bubbles round the garden and finished on the path up to a ruin. A festival crowd on the 8th, and French toast on the 21st that defeated us both.",
    days: {
      "02": { title: "Bubbles, Then the Ruin" },
      "08": { title: "The Festival" },
      "10": { title: "The Street Cat" },
      "21": { title: "Brunch on the 21st" },
    },
  },
  // June 2026 — 11 days, 25 photographs
  // 01×1 04×2 14×1 15×1 19×3 20×5 21×1 27×1 28×3 29×1 30×6
  "2026-06": {
    title: "Swings and a Small Party",
    summary:
      "A garden swing that neither of us was the right size for, a party at the club on the 20th, and a museum on the 30th where the hats were the best exhibit.",
    days: {
      "19": { title: "Pineapple and Prosecco" },
      "20": { title: "The Party at the Club" },
      "28": { title: "The Swing" },
      "30": { title: "The Frog Hat" },
    },
  },
  // July 2026 — 14 days, 67 photographs
  // 04×2 08×8 11×1 12×2 15×14 17×2 18×12 19×2 20×5 21×2 22×1 23×1 24×14 26×1
  "2026-07": {
    title: "Greece",
    summary:
      "The biggest month there is. A lavender field on the 8th, a wing over the water on the 17th, and then a week of white steps, whitewashed alleys and a sea that stayed the same colour all day. Sixty-seven photographs and it was still not enough.",
    days: {
      "04": { title: "A Day at the Club" },
      "08": { title: "The Lavender Field" },
      "15": { title: "Fourteen Faces" },
      "17": { title: "The Wing" },
      "18": { title: "The First Day by the Sea" },
      "24": { title: "The Last Full Day" },
    },
  },
  // August 2026 — 9 days, 17 photographs
  // 02×1 04×2 05×1 08×2 09×5 12×1 17×1 26×1 30×3
  "2026-08": {
    title: "Coming Down",
    summary:
      "Sunburn wearing off, a rooftop dinner on the 4th, a park full of lights on the 9th, and a sky full of stars on the 12th. It ends in a field on the 30th — two years, almost to the day.",
    days: {
      "04": { title: "The Rooftop" },
      "09": { title: "The Lights in the Park" },
      "12": { title: "Under the Stars" },
      "30": { title: "Two Years" },
    },
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
