/**
 * Imports a folder of camera exports into `originals/`, one event per day.
 *
 * The photographs come off two phones grouped by month and nothing else, but
 * an event in this timeline is a day — "a night, a trip, a day worth keeping"
 * — so the day is read back out of each file and every distinct day in a month
 * becomes one event folder. The earliest photograph of a day is its cover.
 *
 *   node scripts/stage-originals.mjs --from=~/Desktop/photos [--apply] [--cap=10]
 *
 * Without --apply it only reports what it would do. It writes originals, not
 * shipped files: `npm run photos` is still what resizes and strips them.
 *
 * A day is taken from the filename where the camera put one there
 * (PXL_20240903_203800455, IMG-20241104-WA0033, Screenshot_20250208-214348)
 * and from Spotlight's content-creation date otherwise, which is where the
 * EXIF lives for the .HEIC and .JPG files an iPhone exports under a bare
 * counter. Videos are skipped; a live photo keeps its still and loses its clip.
 */
import { cp, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join, parse } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const IMAGES = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tif", ".tiff"]);
/** sharp cannot decode HEIF, so these are converted on the way in. */
const HEIF = new Set([".heic", ".heif"]);

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const flag = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const from = flag("from", "~/Desktop/photos").replace(/^~/, homedir());
const cap = Number(flag("cap", "10"));
const outDir = flag("out", "originals");

/** "september-2024" -> "2024-09" */
function monthIdOf(folder) {
  const [name, year] = folder.split("-");
  const index = MONTHS.indexOf(name.toLowerCase());
  if (index < 0 || !/^\d{4}$/.test(year ?? "")) return null;
  return `${year}-${String(index + 1).padStart(2, "0")}`;
}

/**
 * When a photograph was taken, as a sortable string, plus the day it belongs
 * to. `null` when neither the name nor Spotlight knows.
 */
async function takenAt(dir, file) {
  const inName =
    // PXL_20240903_203800455..., IMG_20240903_203800...
    /(?:^|[_-])(\d{8})[_-](\d{6})/.exec(file) ??
    // IMG-20241104-WA0033, Screenshot_20250208-214348
    /(?:^|[_-])(\d{8})[_-](\d{4,6})/.exec(file) ??
    // ...anything left carrying a bare date
    /(?:^|[_-])(\d{8})(?=[._-]|$)/.exec(file);
  if (inName) return { day: inName[1], key: `${inName[1]}-${inName[2] ?? "000000"}` };

  const { stdout } = await run("mdls", [
    "-raw",
    "-name",
    "kMDItemContentCreationDate",
    join(dir, file),
  ]);
  const stamp = stdout.trim();
  if (!stamp || stamp === "(null)") return null;
  // "2026-04-03 16:30:15 +0000"
  const [date, time] = stamp.split(" ");
  return { day: date.replaceAll("-", ""), key: `${date.replaceAll("-", "")}-${(time ?? "").replaceAll(":", "")}` };
}

/**
 * Google Photos leaves the same frame behind twice — once plain and once as
 * `~2` or `(1)` — and both carry the identical capture stamp down to the
 * millisecond. The plain one wins; ties go to the shorter name.
 */
function dedupe(entries) {
  const best = new Map();
  const dropped = [];
  for (const entry of entries) {
    const marked = /(~\d+|\(\d+\))(?=\.[^.]+$)/.test(entry.file);
    const held = best.get(entry.key);
    if (!held) {
      best.set(entry.key, { ...entry, marked });
      continue;
    }
    const better =
      (held.marked && !marked) ||
      (held.marked === marked && entry.file.length < held.file.length);
    if (better) {
      dropped.push(held.file);
      best.set(entry.key, { ...entry, marked });
    } else {
      dropped.push(entry.file);
    }
  }
  return { kept: [...best.values()], dropped };
}

/** True when this original has already been staged here. */
async function already(out, source, ext) {
  try {
    const built = await stat(out);
    if (HEIF.has(ext)) return built.size > 0;
    return built.size === (await stat(source)).size;
  } catch {
    return false;
  }
}

const monthFolders = (await readdir(from, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && monthIdOf(e.name))
  .sort((a, b) => monthIdOf(a.name).localeCompare(monthIdOf(b.name)));

const manifest = {};
const undated = [];
let deduped = 0;
let truncated = 0;
let staged = 0;
let converted = 0;

for (const folder of monthFolders) {
  const monthId = monthIdOf(folder.name);
  const dir = join(from, folder.name);
  const files = (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isFile() && IMAGES.has(parse(e.name).ext.toLowerCase()))
    .map((e) => e.name)
    .sort();

  const entries = [];
  for (const file of files) {
    const at = await takenAt(dir, file);
    if (!at) {
      undated.push(join(folder.name, file));
      continue;
    }
    entries.push({ file, ...at });
  }

  const { kept, dropped } = dedupe(entries);
  deduped += dropped.length;

  const days = new Map();
  for (const entry of kept.sort((a, b) => a.key.localeCompare(b.key))) {
    const slug = entry.day.slice(6);
    if (!days.has(slug)) days.set(slug, []);
    days.get(slug).push(entry);
  }

  const events = [];
  for (const [slug, day] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
    if (day.length > cap) truncated += day.length - cap;
    const take = day.slice(0, cap);
    events.push({ slug, photos: take.length - 1, date: `${monthId}-${slug}` });

    if (!apply) continue;
    const target = join(outDir, monthId, slug);
    await mkdir(target, { recursive: true });
    for (const [i, entry] of take.entries()) {
      const ext = parse(entry.file).ext.toLowerCase();
      const base = i === 0 ? "cover" : String(i).padStart(2, "0");
      const source = join(dir, entry.file);
      // Re-running the import should not re-copy two gigabytes, and should not
      // re-decode eighteen HEICs, so anything already the right size stays.
      if (await already(join(target, HEIF.has(ext) ? `${base}.jpg` : `${base}${ext}`), source, ext)) {
        staged++;
        continue;
      }
      if (HEIF.has(ext)) {
        // sharp's prebuilt binary has no HEIF decoder; sips does, and this is
        // the only pass over the file that has to care.
        await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "95", source,
          "--out", join(target, `${base}.jpg`)]);
        converted++;
      } else {
        await cp(source, join(target, `${base}${ext}`));
      }
      staged++;
    }
  }
  manifest[monthId] = events;

  const counts = [...days.values()].map((d) => Math.min(d.length, cap));
  console.log(
    `${monthId}  ${String(days.size).padStart(2)} days  ` +
      `${String(counts.reduce((a, b) => a + b, 0)).padStart(3)} photos  [${counts.join(" ")}]`,
  );
}

/**
 * The manifest is a TypeScript module rather than JSON so that both Next and
 * `node --experimental-strip-types` (scripts/resize-photos.mjs) can import it
 * with no loader configuration on either side.
 */
function serialise(months) {
  const body = Object.entries(months)
    .map(([monthId, events]) => {
      const lines = events
        .map((e) => `    { slug: "${e.slug}", photos: ${e.photos}, date: "${e.date}" },`)
        .join("\n");
      return `  "${monthId}": [\n${lines}\n  ],`;
    })
    .join("\n");
  return (
    "// Generated by scripts/stage-originals.mjs — do not edit by hand.\n" +
    "//\n" +
    "// One entry per event: the day it happened, and how many photographs sit\n" +
    "// behind its cover. data/timeline.ts turns these into the run's cards, titled\n" +
    "// by the day itself; scripts/resize-photos.mjs builds the files.\n" +
    "export interface StagedEvent {\n" +
    "  /** Day of the month, zero-padded — the folder its photographs live in. */\n" +
    "  slug: string;\n" +
    "  /** Photographs behind the cover — the cover itself is not counted. */\n" +
    "  photos: number;\n" +
    "  date: string;\n" +
    "}\n\n" +
    "// A list, not a keyed object: \"03\" and \"14\" as object keys come back out\n" +
    "// in the wrong order, because JavaScript sorts the integer-looking ones first.\n" +
    "/** monthId -> its events, earliest day first. */\n" +
    "export const staged: Record<string, StagedEvent[]> = {\n" +
    body +
    "\n};\n"
  );
}

const events = Object.values(manifest).reduce((n, m) => n + m.length, 0);
const photos = Object.values(manifest).reduce(
  (n, m) => n + m.reduce((k, e) => k + e.photos + 1, 0),
  0,
);
console.log(`\n${monthFolders.length} months, ${events} events, ${photos} photographs.`);
if (deduped) console.log(`${deduped} duplicate export(s) skipped.`);
if (truncated) console.log(`${truncated} photograph(s) over the ${cap}-per-event cap, dropped.`);
if (undated.length) {
  console.log(`\n${undated.length} file(s) with no date in the name and none in Spotlight:`);
  for (const file of undated.slice(0, 10)) console.log(`  ${file}`);
}
if (apply) {
  console.log(`\n${staged} staged into ${outDir}/ (${converted} HEIC converted).`);
  await writeFile("data/photos.generated.ts", serialise(manifest));
  console.log("data/photos.generated.ts written. Next: npm run photos");
} else {
  console.log("\nDry run. Add --apply to stage the files.");
}
