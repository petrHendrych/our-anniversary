# Full-size originals go here

Straight off the phone or the camera, at whatever size they came in. Nothing in
this folder is committed or deployed — `.gitignore` keeps everything here
except this file, so treat it as a workbench, not a backup.

`npm run photos` reads these, resizes to a 1400px long edge, bakes in EXIF
orientation, strips every tag (GPS included) and writes the copies the site
actually ships into `public/images/`.

## Layout

One folder per event, named `<month-id>/<event-slug>` exactly as
`data/timeline.ts` names it, holding `cover` plus `01`, `02`, and so on:

```
originals/
  2024-09/
    the-coffee/
      cover.HEIC
      01.HEIC
      02.jpg
      03.jpg
      04.jpg
    the-bridge/
      cover.jpg
      01.jpg
      ...
  2025-04/
    keys/
      ...
```

Extension and case do not matter — `.jpg`, `.jpeg`, `.png`, `.webp`, `.tif`,
`.avif` all work. Only the basename does: `cover`, `01`, `02`.

## How many

The count comes from the event's `photos` in `data/timeline.ts`. An event
written as `{ slug: "the-coffee", photos: 4 }` means `cover` plus `01`–`04`; a
fifth original sits here ignored until that number goes up, and a missing one
turns up in the script's "still waiting on originals for" list.

## iPhone .heic

sharp's prebuilt binary has no HEIF decoder, so `.heic`/`.heif` files are
reported rather than converted. The script prints the `sips` command for the
folder it found them in — run that, delete the `.heic`, run `npm run photos`
again. Shooting with Settings → Camera → Formats → Most Compatible avoids it
entirely.
