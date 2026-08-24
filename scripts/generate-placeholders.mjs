/**
 * Generates placeholder photos for the mock timeline so the layout has real
 * images to render against before the actual photos exist.
 *
 * It reads data/timeline.ts directly — Node strips the types — so the pictures
 * on disk can never drift from the events the site expects. Every event gets
 * its own folder: a cover, which is the card that flies in the run, and the
 * photographs behind it, which belong to that event alone.
 *
 * Delete this script (and public/images/*) once real, pre-resized photos land.
 *
 *   node scripts/generate-placeholders.mjs
 */
import { mkdir, rm } from "node:fs/promises";
import sharp from "sharp";
import { timeline } from "../data/timeline.ts";

// Longest edge stays under the 1500-2000px cap from REQUIREMENTS.md.
const COVER = { w: 1200, h: 1600 };
const PHOTO = { w: 1000, h: 1000 };

function gradient({ w, h }, hueA, hueB, label) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hueA} 45% 32%)"/>
        <stop offset="100%" stop-color="hsl(${hueB} 38% 12%)"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <text x="50%" y="50%" fill="rgba(255,255,255,0.72)" font-family="Helvetica, Arial, sans-serif"
          font-size="${Math.round(w / 14)}" font-weight="600" text-anchor="middle"
          dominant-baseline="middle" letter-spacing="2">${label}</text>
  </svg>`);
}

/** Strips the leading slash: /images/... is a URL, public/images/... is a path. */
const pathFor = (src) => `public${src}`;

// Anything left from an earlier shape of the data would just sit there unused.
await rm("public/images", { recursive: true, force: true });

const events = timeline.flatMap((year) => year.months.flatMap((month) => month.events));

let i = 0;
for (const event of events) {
  // Walk the hue wheel so neighbouring events never look like the same place.
  const hueA = (i * 47) % 360;
  const hueB = (i * 47 + 52) % 360;
  i++;

  await mkdir(pathFor(`/images/${event.monthId}/${event.slug}`), { recursive: true });

  await sharp(gradient(COVER, hueA, hueB, event.title))
    .jpeg({ quality: 82 })
    .toFile(pathFor(event.cover.src));

  let n = 1;
  for (const photo of event.photos) {
    await sharp(gradient(PHOTO, hueA + n * 6, hueB - n * 4, `${event.title} · ${String(n).padStart(2, "0")}`))
      .jpeg({ quality: 80 })
      .toFile(pathFor(photo.src));
    n++;
  }

  console.log(`${event.id}: cover + ${event.photos.length}`);
}
