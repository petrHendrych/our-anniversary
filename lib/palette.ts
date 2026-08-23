/**
 * One pastel per month.
 *
 * The page takes its colour from whichever month the reader is in — the DOM
 * background, the type, and the scene fog all shift together, so photos always
 * dissolve into the same colour the page is painted. Reading the palette off
 * the month (rather than a single fixed theme) is what makes the run feel like
 * it is passing through somewhere rather than scrolling a list.
 *
 * `bg` carries the page; `text` has to stay legible on it, so every pair here
 * is a deep neutral of the same hue family rather than pure black.
 */
export interface Palette {
  /** Page background, scene fog. */
  bg: string;
  /** Body and heading colour. */
  text: string;
  /** Secondary copy. */
  dim: string;
  /** The single accent — lit calendar ticks, live month readout. */
  lit: string;
}

const PASTELS: Palette[] = [
  { bg: "#e9d9c9", text: "#332a24", dim: "#7d6d5f", lit: "#b4703f" }, // sand
  { bg: "#cfe0d6", text: "#25322b", dim: "#61756a", lit: "#3f7f68" }, // sage
  { bg: "#ded5ec", text: "#2c2739", dim: "#6d6684", lit: "#6a56a8" }, // lilac
  { bg: "#f3d9d5", text: "#37272a", dim: "#83666a", lit: "#b45566" }, // blush
  { bg: "#d5e1f0", text: "#242c38", dim: "#63708a", lit: "#4a6fa8" }, // sky
  { bg: "#efe4c6", text: "#332f21", dim: "#7a725a", lit: "#9c7a2c" }, // butter
];

/** Palette for a month, by its index in `months`. Cycles if there are more months than pastels. */
export function paletteFor(monthIndex: number): Palette {
  return PASTELS[((monthIndex % PASTELS.length) + PASTELS.length) % PASTELS.length];
}

/** What the page wears before the first month and after the last. */
export const openingPalette: Palette = PASTELS[0];
