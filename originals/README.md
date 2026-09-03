# Full-size originals go here

Straight off the phone, at whatever size they came in. Nothing in this folder
is committed or deployed — `.gitignore` keeps everything here except this file,
so treat it as a workbench, not a backup.

## Importing a folder of exports

Photographs come off a phone grouped by month and nothing else. An event in
this timeline is a *day*, so the import reads each file's capture date and
groups a month's pictures into one folder per day:

```
npm run photos:import -- --from=~/Desktop/photos       # dry run: prints the plan
npm run photos:import -- --from=~/Desktop/photos --apply
npm run photos                                          # build what ships
```

The source folder holds one folder per month named `<month>-<year>`
(`september-2024`, `july-2026`). The import:

- takes the date from the filename where the camera left one (`PXL_20240903_…`,
  `IMG-20241104-WA0033`, `Screenshot_20250208-214348`) and from Spotlight's
  content-creation date otherwise, which is where an iPhone's bare `IMG_2292`
  keeps it;
- skips videos, so a live photo keeps its still and loses its clip;
- converts `.HEIC`/`.HEIF` to JPEG with `sips`, because sharp's prebuilt binary
  has no HEIF decoder;
- drops Google Photos' duplicate exports — the same capture stamp appearing
  twice, once plain and once as `~2` or `(1)`;
- caps a day at `--cap` photographs (14 by default), earliest first, because
  every photograph in an open event is a live texture at the same moment;
- is idempotent: a re-run re-copies nothing already staged.

It then writes `data/photos.generated.ts`, which is where `data/timeline.ts`
learns which events exist and how many pictures each holds. Words —  a month's
title and summary, a day's title where the date is not enough — are hand-written
in `data/timeline.ts` and never touched by the import.

## Layout

One folder per event, named `<month-id>/<day>`, holding `cover` plus `01`,
`02`, and so on. The import produces exactly this, so it is only worth knowing
if you are dropping a photograph in by hand:

```
originals/
  2024-09/
    03/
      cover.jpg
      01.jpg
    15/
      cover.HEIC
      01.jpg
      ...
```

Extension and case do not matter — `.jpg`, `.jpeg`, `.png`, `.webp`, `.tif`,
`.avif` all work. Only the basename does: `cover`, `01`, `02`. Adding one by
hand means bumping that day's count in `data/photos.generated.ts` too, or just
re-running the import.

## What ships

`npm run photos` resizes to a 1400px long edge, bakes in EXIF orientation,
strips every tag (GPS included) and writes into `public/images/`. It only
re-encodes what is newer than the copy built from it, so importing one month
costs one month's work. A photograph the data file expects and cannot find
turns up in its "still waiting on originals for" list.
