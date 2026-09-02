/**
 * Turns camera originals into the photographs the run actually ships.
 *
 * Originals never enter the repo. They sit in `originals/` (gitignored),
 * laid out exactly like `public/images/` — one folder per event, `cover` plus
 * `01`, `02`... — in whatever format the camera or the phone produced. This
 * script reads data/timeline.ts to learn which photographs the site expects,
 * finds each one's original by basename regardless of extension, and writes
 * the resized copy to the path the data file names.
 *
 *   node scripts/resize-photos.mjs [--dir=originals] [--force]
 *
 * Two things it deliberately does beyond resizing:
 *
 * EXIF orientation is baked into the pixels (`.rotate()`), and then all
 * metadata is dropped. Orientation has to be applied here because it is no
 * longer carried anywhere: lib/card-texture reads the shipped file with
 * `createImageBitmap`, which honours EXIF, but a file with no EXIF left has
 * nothing to honour. Dropping the rest also takes the GPS tag off every
 * photograph, which matters for a page that gets a public URL.
 *
 * Nothing is re-encoded unless the original is newer than what was built from
 * it, so importing one month's photos costs one month's work, not eight
 * hundred photographs'.
 */
import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { availableParallelism } from "node:os";
import sharp from "sharp";
import { timeline } from "../data/timeline.ts";

/**
 * Longest edge of a shipped photograph, in pixels.
 *
 * Comfortably more than anything reaches the screen, and deliberately not much
 * more. lib/card-texture downsamples to 768px (phone) or 1024px on its way
 * into the print, and MAX_CARD_SHARE caps a print at 62% of the viewport — so
 * on a 390pt phone at dpr 3 the photograph inside it is around 725 device
 * pixels at its very largest. 1400 leaves room for a tablet and for the deck's
 * front card; past that the bytes are fetched, decoded and thrown away.
 */
const LONGEST = 1400;

/** Per-format quality. Only the extension the data file uses gets used. */
const QUALITY = { jpeg: 80, webp: 78, avif: 55 };

/** Extensions worth looking for in `originals/`, best first. */
const SOURCES = [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".avif", ".heic", ".heif"];
/** sharp's prebuilt binaries have no HEIF decoder — worth saying so by name. */
const UNREADABLE = new Set([".heic", ".heif"]);

const args = process.argv.slice(2);
const force = args.includes("--force");
const sourceDir = (args.find((a) => a.startsWith("--dir=")) ?? "--dir=originals").slice(6);

/** Strips the leading slash: /images/... is a URL, public/images/... is a path. */
const pathFor = (src) => join("public", src);

/**
 * Every photograph the site expects, in run order — covers and deck pictures
 * alike, since both become prints and both need the same treatment.
 */
const expected = timeline
  .flatMap((year) => year.months)
  .flatMap((month) => month.events)
  .flatMap((event) => [event.cover, ...event.photos].map((photo) => photo.src));

/** Files present in one source folder, by basename: { cover: "cover.HEIC" }. */
const listings = new Map();

async function sourceFor(src) {
  // `originals/` mirrors the *contents* of public/images, so the folder for
  // /images/2024-09/the-coffee/cover.jpg is originals/2024-09/the-coffee.
  const { dir, name } = parse(src.replace(/^\/images\//, ""));
  let listing = listings.get(dir);
  if (!listing) {
    listing = new Map();
    try {
      for (const file of await readdir(join(sourceDir, dir))) {
        const parsed = parse(file);
        const rank = SOURCES.indexOf(parsed.ext.toLowerCase());
        if (rank < 0) continue;
        const held = listing.get(parsed.name);
        // A folder holding both an export and the original keeps the export.
        if (!held || rank < held.rank) listing.set(parsed.name, { file, rank });
      }
    } catch {
      // A month whose photographs have not been imported yet is not an error.
    }
    listings.set(dir, listing);
  }
  const found = listing.get(name);
  return found ? join(sourceDir, dir, found.file) : null;
}

function encode(pipeline, ext) {
  switch (ext) {
    case ".webp":
      return pipeline.webp({ quality: QUALITY.webp, effort: 5 });
    case ".avif":
      return pipeline.avif({ quality: QUALITY.avif, effort: 4 });
    default:
      return pipeline.jpeg({ quality: QUALITY.jpeg, mozjpeg: true, chromaSubsampling: "4:2:0" });
  }
}

/** True when the built copy is already newer than the original it came from. */
async function current(out, source) {
  if (force) return false;
  try {
    const [built, original] = await Promise.all([stat(out), stat(source)]);
    return built.mtimeMs >= original.mtimeMs;
  } catch {
    return false;
  }
}

// An empty source folder is the normal state of a fresh clone, and a script
// that says nothing about where to put things is no help at all.
try {
  await stat(sourceDir);
} catch {
  await mkdir(sourceDir, { recursive: true });
  console.log(`Created ${sourceDir}/ — put full-size originals in there. See ${sourceDir}/README.md`);
}

const missing = [];
const unreadable = [];
let skipped = 0;
let written = 0;
let bytesIn = 0;
let bytesOut = 0;

async function build(src) {
  const source = await sourceFor(src);
  if (!source) {
    missing.push(src);
    return;
  }
  if (UNREADABLE.has(parse(source).ext.toLowerCase())) {
    unreadable.push(source);
    return;
  }

  const out = pathFor(src);
  if (await current(out, source)) {
    skipped++;
    return;
  }

  await mkdir(dirname(out), { recursive: true });

  // failOn: "none" — a phone photo with a truncated trailing block still has a
  // perfectly good photograph in it, and this is the only pass over it.
  const info = await encode(
    sharp(source, { failOn: "none" })
      .rotate()
      .resize({ width: LONGEST, height: LONGEST, fit: "inside", withoutEnlargement: true }),
    parse(out).ext.toLowerCase(),
  ).toFile(out);

  bytesIn += (await stat(source)).size;
  bytesOut += info.size;
  written++;
  console.log(`${src}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
}

// One decode-and-encode at a time per core. sharp's own thread pool does the
// rest, and letting eight hundred of them start at once only means eight
// hundred full-size decodes resident in memory together.
const lanes = Math.max(1, Math.min(4, availableParallelism()));
let next = 0;
await Promise.all(
  Array.from({ length: lanes }, async () => {
    while (next < expected.length) await build(expected[next++]);
  }),
);

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

console.log(
  `\n${written} written, ${skipped} already current, ${missing.length} not imported yet.`,
);
if (written) {
  console.log(`${mb(bytesIn)} of originals -> ${mb(bytesOut)} shipped.`);
}
if (unreadable.length) {
  console.log(
    `\n${unreadable.length} HEIC/HEIF original(s) sharp cannot read. Convert them first:\n` +
      `  sips -s format jpeg -s formatOptions 90 ${sourceDir}/<month>/<event>/*.HEIC --out <same folder>\n` +
      `then delete the .HEIC and run this again. First one: ${unreadable[0]}`,
  );
}
if (missing.length) {
  const shown = missing.slice(0, 12);
  console.log(
    `\nStill waiting on originals for:\n${shown.map((s) => `  ${s}`).join("\n")}` +
      (missing.length > shown.length ? `\n  ...and ${missing.length - shown.length} more` : ""),
  );
}
