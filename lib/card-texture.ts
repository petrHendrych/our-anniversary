"use client";

import * as THREE from "three";

/**
 * Sliding-window cache of *printed* photographs.
 *
 * A card is not the bare photograph — it is a print: warm paper, a thin border
 * on three sides, a deep one along the bottom carrying the title. All of that
 * is drawn once into a 2D canvas and uploaded as a single texture, so the frame
 * and its caption move with the card through the scene with no extra geometry,
 * no 3D type, and no per-frame projection of DOM elements on top.
 *
 * Lifetime works exactly as it did for the raw textures: mobile Safari has a
 * WebGL memory ceiling unrelated to how fast the chip is, so a card acquires
 * its print on mount and releases it on unmount, and the last few released
 * prints are retained rather than disposed so that scrubbing back and forth
 * across a month boundary re-bakes nothing.
 *
 * Framing is cheaper than what it replaced: the photograph is downsampled to
 * PHOTO_MAX on its way into the canvas, so a 1200x1600 cover now costs roughly
 * half the GPU memory it did when it was uploaded at full size.
 */

const RETAINED = 10;

/** Longest edge of the photograph inside the print, in texture pixels. */
const PHOTO_MAX = 1024;
/** Border on the left, right and top, as a fraction of the photo's width. */
const SIDE = 0.055;
/** The deep border along the bottom, where the caption is set. */
const BOTTOM = 0.2;
/** Transparent room around the print, so it can carry its own drop shadow. */
const MARGIN = 0.02;

const PAPER = "#f7f2ea";
const CAPTION_INK = "#3a322c";

const cache = new Map<string, THREE.CanvasTexture>();
const pending = new Map<string, Promise<THREE.CanvasTexture>>();
const refs = new Map<string, number>();
/** Zero-ref prints, oldest first. */
const retired: string[] = [];

const keyFor = (src: string, caption: string) => `${src}|${caption}`;

/**
 * The display face, resolved once. next/font decides the family name (and its
 * fallback) at build time, so the only handle on it is the CSS variable it
 * wrote onto <html> — the literal "Newsreader" would miss the fallback metrics.
 */
let family: Promise<string> | null = null;

function captionFamily(): Promise<string> {
  if (family) return family;
  family = (async () => {
    const declared = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-newsreader")
      .trim();
    const face = declared ? `${declared}, Georgia, serif` : "Georgia, serif";
    try {
      // Canvas silently falls back to a default face for a font that has not
      // loaded yet, and the first cards bake within a second of first paint.
      await document.fonts.load(`italic 400 60px ${declared || "Georgia"}`);
      await document.fonts.ready;
    } catch {
      // A face that never arrives is not worth holding a photograph back for.
    }
    return face;
  })();
  return family;
}

async function decode(src: string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`${src}: ${response.status}`);
    // Without this a phone photo bakes on its side: createImageBitmap ignores
    // EXIF rotation by default, where <img> honours it.
    return createImageBitmap(await response.blob(), { imageOrientation: "from-image" });
  }
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

function writeCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  face: string,
  x: number,
  top: number,
  width: number,
  height: number,
) {
  if (!text) return;

  const limit = width * 0.92;
  const largest = height * 0.34;
  const smallest = height * 0.24;

  ctx.fillStyle = CAPTION_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Long titles come down a couple of points before they are cut.
  let size = largest;
  ctx.font = `italic 400 ${size}px ${face}`;
  while (size > smallest && ctx.measureText(text).width > limit) {
    size -= 2;
    ctx.font = `italic 400 ${size}px ${face}`;
  }

  let label = text;
  if (ctx.measureText(label).width > limit) {
    let cut = text.length;
    while (cut > 1 && ctx.measureText(`${text.slice(0, cut)}…`).width > limit) cut--;
    label = `${text.slice(0, cut).trimEnd()}…`;
  }

  // Slightly above the middle of the bar: optical centre, not geometric.
  ctx.fillText(label, x + width / 2, top + height * 0.46);
}

function drawPrint(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  caption: string,
  face: string,
): HTMLCanvasElement {
  const fit = PHOTO_MAX / Math.max(sourceWidth, sourceHeight);
  const pw = Math.round(sourceWidth * fit);
  const ph = Math.round(sourceHeight * fit);

  const side = Math.round(pw * SIDE);
  const bottom = Math.round(pw * BOTTOM);
  const margin = Math.round(pw * MARGIN);

  const canvas = document.createElement("canvas");
  canvas.width = pw + side * 2 + margin * 2;
  canvas.height = ph + side + bottom + margin * 2;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingQuality = "high";

  const cardX = margin;
  const cardY = margin;
  const cardW = pw + side * 2;
  const cardH = ph + side + bottom;

  // The paper, with a shadow so a print reads as an object lying on the page
  // rather than as a white rectangle painted onto it.
  ctx.save();
  ctx.shadowColor = "rgba(40, 30, 22, 0.3)";
  ctx.shadowBlur = margin * 1.6;
  ctx.shadowOffsetY = margin * 0.5;
  ctx.fillStyle = PAPER;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.restore();

  // Barely-there shading down the paper, so it is never flat white.
  const wash = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
  wash.addColorStop(0, "rgba(0,0,0,0)");
  wash.addColorStop(1, "rgba(0,0,0,0.035)");
  ctx.fillStyle = wash;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  const px = cardX + side;
  const py = cardY + side;
  ctx.drawImage(source, px, py, pw, ph);

  // The lip of the print, where the emulsion meets the border.
  ctx.strokeStyle = "rgba(0,0,0,0.14)";
  ctx.lineWidth = Math.max(1, Math.round(pw * 0.002));
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

  writeCaption(ctx, caption, face, px, py + ph, pw, bottom);

  return canvas;
}

async function bake(src: string, caption: string): Promise<THREE.CanvasTexture> {
  const [source, face] = await Promise.all([decode(src), captionFamily()]);
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  const canvas = drawPrint(source, width, height, caption, face);
  if (source instanceof ImageBitmap) source.close();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function unretire(key: string) {
  const i = retired.indexOf(key);
  if (i >= 0) retired.splice(i, 1);
}

function dispose(key: string) {
  const texture = cache.get(key);
  if (!texture) return;
  texture.dispose();
  // Safari holds the canvas backing store until it is explicitly zero-sized.
  const canvas = texture.image as HTMLCanvasElement;
  canvas.width = 0;
  canvas.height = 0;
  cache.delete(key);
}

function retire(key: string) {
  if (!cache.has(key) || retired.includes(key)) return;
  retired.push(key);
  while (retired.length > RETAINED) {
    const evicted = retired.shift();
    if (!evicted || (refs.get(evicted) ?? 0) > 0) continue;
    dispose(evicted);
  }
}

export function acquireCardTexture(src: string, caption: string): Promise<THREE.Texture> {
  const key = keyFor(src, caption);
  refs.set(key, (refs.get(key) ?? 0) + 1);
  unretire(key);

  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  let baking = pending.get(key);
  if (!baking) {
    baking = bake(src, caption).then((texture) => {
      cache.set(key, texture);
      pending.delete(key);
      // The card may already have scrolled out of the window while this was in
      // flight — if nothing holds it now, it goes straight to the retired list.
      if ((refs.get(key) ?? 0) === 0) retire(key);
      return texture;
    });
    baking = baking.catch((error) => {
      // Otherwise the failed key sits in `pending` forever and the card can
      // never be retried, even after a scroll away and back.
      pending.delete(key);
      refs.delete(key);
      throw error;
    });
    pending.set(key, baking);
  }
  return baking;
}

export function releaseCardTexture(src: string, caption: string): void {
  const key = keyFor(src, caption);
  const remaining = (refs.get(key) ?? 1) - 1;
  if (remaining > 0) {
    refs.set(key, remaining);
    return;
  }
  refs.delete(key);
  retire(key);
}

/** Resident print count — handy when profiling on a real device. */
export function residentTextureCount(): number {
  return cache.size;
}
