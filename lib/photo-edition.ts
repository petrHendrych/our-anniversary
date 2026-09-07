import { photoEditions } from "@/data/photo-editions.generated";

/**
 * The URL a photograph is actually fetched from.
 *
 * Shipped filenames are stable — `/images/2024-10/01/cover.jpg` is that day's
 * cover whatever photograph is in it this week — and the images are served
 * with a month-long cache lifetime, because eight hundred conditional requests
 * on a repeat visit cost more on a phone than the bytes ever did. The two do
 * not go together on their own: this page ran on placeholder plates at these
 * exact paths before the real photographs were imported, and a phone that had
 * seen it once kept drawing "October 2024 · 1" on a green plate for weeks
 * afterwards, with only the pictures at *new* paths coming through.
 *
 * So the month's version stamp goes on the request. It is written from the
 * bytes that shipped (scripts/resize-photos.mjs), so importing a month gives
 * every photograph in it a URL nothing has cached, and leaves the other
 * twenty-three months alone.
 *
 * Only the network sees this. Everything else — the print cache, the warm
 * blobs, a card's identity in the run — is keyed by the plain path, so nothing
 * downstream has to know that a stamp exists.
 */
export function photoUrl(src: string): string {
  // "/images/2024-10/01/cover.jpg" -> "2024-10"
  const edition = photoEditions[src.split("/")[2]];
  return edition ? `${src}?v=${edition}` : src;
}
