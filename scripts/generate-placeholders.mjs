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

// Keep in sync with data/timeline.ts. [monthId, label, gallery count, hueA, hueB]
const MONTHS = [
  ["2024-03", "March 2024", 5, 268, 320],
  ["2024-06", "June 2024", 7, 188, 232],
  ["2024-11", "November 2024", 4, 18, 348],
  ["2025-02", "February 2025", 6, 205, 168],
  ["2025-05", "May 2025", 5, 32, 8],
  ["2025-09", "September 2025", 6, 128, 96],
];

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
