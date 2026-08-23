/**
 * Generates placeholder photos for the mock timeline so the layout has real
 * images to render against before the actual photos exist.
 *
 * Delete this script (and public/images/*) once real, pre-resized photos land.
 *
 *   node scripts/generate-placeholders.mjs
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

// Keep in sync with data/timeline.ts: same start month, same count, same
// photos-per-month rule, so every month the timeline names has pictures.
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const START_YEAR = 2024;
const START_MONTH = 9;
const MONTH_COUNT = 24;
const WRITTEN_PHOTOS = {
  "2024-09": 5,
  "2024-12": 4,
  "2025-04": 5,
  "2025-09": 7,
  "2026-01": 6,
  "2026-05": 6,
};

const MONTHS = Array.from({ length: MONTH_COUNT }, (_, i) => {
  const offset = START_MONTH - 1 + i;
  const year = START_YEAR + Math.floor(offset / 12);
  const monthIndex = (offset % 12) + 1;
  const id = `${year}-${String(monthIndex).padStart(2, "0")}`;
  const label = `${MONTH_NAMES[monthIndex - 1]} ${year}`;
  const count = WRITTEN_PHOTOS[id] ?? 3 + (i % 3);
  // Walk the hue wheel so neighbouring months never look like the same place.
  return [id, label, count, (i * 47) % 360, (i * 47 + 52) % 360];
});

// Longest edge stays under the 1500-2000px cap from REQUIREMENTS.md.
const COVER = { w: 1200, h: 1600 };
const GALLERY = { w: 1000, h: 1000 };

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

for (const [id, label, count, hueA, hueB] of MONTHS) {
  const dir = `public/images/${id}`;
  await mkdir(dir, { recursive: true });

  await sharp(gradient(COVER, hueA, hueB, label))
    .jpeg({ quality: 82 })
    .toFile(`${dir}/cover.jpg`);

  for (let i = 1; i <= count; i++) {
    const n = String(i).padStart(2, "0");
    await sharp(gradient(GALLERY, hueA + i * 6, hueB - i * 4, `${label} · ${n}`))
      .jpeg({ quality: 80 })
      .toFile(`${dir}/${n}.jpg`);
  }
  console.log(`${id}: cover + ${count} gallery`);
}
