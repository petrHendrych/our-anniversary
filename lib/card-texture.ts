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
 * Framing is cheaper than what it replaced: the photograph is downsampled on
 * its way into the canvas (see photoLimit), so a 1200x1600 cover costs a
 * fraction of the GPU memory it did when it was uploaded at full size.
 *
 * Bakes are also serialized — one at a time, nearest card first. See enqueue.
 */

const RETAINED = 6;

/**
 * Longest edge of the photograph inside the print, in texture pixels.
 *
 * Resolved once per session rather than per bake: a print is cached under its
 * source path, so a number that changed with the viewport would leave two
 * sizes of the same card in the cache and no way to tell them apart.
 *
 * A phone gets the smaller one, and it is not a compromise — MAX_CARD_SHARE
 * caps a print at 62% of the viewport, so on a 390pt screen the photograph
 * inside it is around 460 device pixels wide at its very largest. 1024 was
 * paying four times the memory and four times the upload for detail no screen
 * that size can show, and the upload is what the reader feels: every new
 * texture is a synchronous hand-off to the GPU, mipmaps included, in the
 * middle of a frame.
 */
const NARROW = 900;
let photoMax = 0;

function photoLimit(): number {
  if (!photoMax) photoMax = window.innerWidth < NARROW ? 768 : 1024;
  return photoMax;
}

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

/**
 * Warmed bytes: photographs fetched before anything wants to bake them.
 *
 * A bake is four separate costs — fetch, decode, canvas, upload — and only the
 * last three are worth serializing. The fetch is the one that has to wait on a
 * network, and because bakes run one at a time the fetch for the next card
 * does not even begin until the card before it has finished drawing itself.
 * On a cold cache that is a queue of round trips taken in single file.
 *
 * So the bytes are collected separately and in parallel, ahead of the queue:
 * `warmPhoto` starts a fetch and holds the blob, and `take` hands it to the
 * bake when its turn comes. What is held is bounded and small — a blob of a
 * shipped photograph is a couple of hundred kilobytes, and there are never
 * more than WARM_KEEP of them — so this is not a second texture cache by
 * another name. Nothing here touches a canvas or the GPU.
 *
 * `seen` is what keeps eight hundred photographs from being eight hundred
 * downloads: a source is only ever warmed once per session, whether the warm
 * or the bake got to it first.
 */
const WARM_KEEP = 20;
const warming = new Map<string, Promise<Blob>>();
/** Warmed sources, oldest first — the eviction order. */
const warmOrder: string[] = [];
const seen = new Set<string>();

/**
 * Start fetching a photograph that nothing is asking to draw yet.
 *
 * Cheap to call often and safe to call for a card that is already baked: it
 * returns immediately for anything fetched once already this session.
 */
export function warmPhoto(src: string): void {
  if (seen.has(src)) return;
  seen.add(src);

  const held = fetch(src, { priority: "low" } as RequestInit).then((response) => {
    if (!response.ok) throw new Error(`${src}: ${response.status}`);
    return response.blob();
  });
  // A warm that fails is not a verdict on the photograph — forget it happened
  // and let the bake fetch it properly. Attached here so the rejection is
  // always handled, even for a blob nothing ends up taking.
  held.catch(() => {
    warming.delete(src);
    seen.delete(src);
  });

  warming.set(src, held);
  warmOrder.push(src);
  while (warmOrder.length > WARM_KEEP) {
    const evicted = warmOrder.shift();
    if (evicted) warming.delete(evicted);
  }
}

/** The warmed bytes if any are still held, otherwise a plain fetch. */
async function take(src: string): Promise<Blob> {
  seen.add(src);
  const warmed = warming.get(src);
  if (warmed) {
    warming.delete(src);
    const i = warmOrder.indexOf(src);
    if (i >= 0) warmOrder.splice(i, 1);
    const blob = await warmed.catch(() => null);
    if (blob) return blob;
  }
  const response = await fetch(src);
  if (!response.ok) throw new Error(`${src}: ${response.status}`);
  return response.blob();
}

async function decode(src: string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    // Without this a phone photo bakes on its side: createImageBitmap ignores
    // EXIF rotation by default, where <img> honours it.
    return createImageBitmap(await take(src), { imageOrientation: "from-image" });
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
  const fit = photoLimit() / Math.max(sourceWidth, sourceHeight);
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

/**
 * Bakes run one at a time, nearest card first.
 *
 * A bake is a fetch, an `ImageBitmap` decode, a canvas the size of a print
 * drawn with a blurred shadow, and then — the moment the card first draws — a
 * synchronous texture upload with mipmaps. Any one of those inside a frame is
 * survivable. The problem was that a fast flick moves the mount window several
 * cards in a single frame, so half a dozen of them fired at once and the page
 * spent the next few frames doing nothing else. One at a time turns a stall
 * into a card that arrives a frame or two late, out in the haze where nobody
 * is looking at it yet.
 *
 * Queued work is taken nearest-first: `priority` is read at dequeue time, not
 * at enqueue time, so a card the reader has already scrolled past loses its
 * place to one that is about to arrive.
 */
interface Job {
  key: string;
  priority: () => number;
  run: () => void;
  drop: () => void;
}

const queue: Job[] = [];
let running = false;

/** A card that has scrolled out of the mount window is no longer worth baking. */
const wanted = (key: string) => (refs.get(key) ?? 0) > 0;

function pump() {
  if (running) return;

  // Abandoned work first: a flick through half a year queues a card a frame
  // and unmounts most of them again before their turn comes round. Baking
  // those anyway is how a queue meant to smooth the scroll ends up being the
  // thing that stalls it.
  for (let i = queue.length - 1; i >= 0; i--) {
    if (!wanted(queue[i].key)) queue.splice(i, 1)[0].drop();
  }
  if (queue.length === 0) return;

  let best = 0;
  for (let i = 1; i < queue.length; i++) {
    if (queue[i].priority() < queue[best].priority()) best = i;
  }
  const job = queue.splice(best, 1)[0];
  running = true;
  job.run();
}

class Abandoned extends Error {}

function enqueue<T>(
  key: string,
  priority: () => number,
  work: () => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      key,
      priority,
      // `pending` is cleared here rather than in the rejection handler: that
      // runs a microtask later, and a card that remounts in between would
      // otherwise attach itself to an already-rejected bake and never draw.
      drop: () => {
        pending.delete(key);
        reject(new Abandoned(key));
      },
      run: () =>
        work()
          .then(resolve, reject)
          .finally(() => {
            running = false;
            pump();
          }),
    });
    pump();
  });
}

async function bake(src: string, caption: string): Promise<THREE.CanvasTexture> {
  const [source, face] = await Promise.all([decode(src), captionFamily()]);
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  const canvas = drawPrint(source, width, height, caption, face);
  if (source instanceof ImageBitmap) source.close();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // A print faces the reader — the camera only ever leans by a third of a
  // radian — so anisotropic filtering has nothing oblique to sharpen, and at
  // dpr 2 with cards overlapping it was paying four taps a fragment for it.
  texture.anisotropy = 1;
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

export function acquireCardTexture(
  src: string,
  caption: string,
  /** Distance-from-camera of the card asking, read when the queue picks. */
  priority: () => number = () => 0,
): Promise<THREE.Texture> {
  const key = keyFor(src, caption);
  refs.set(key, (refs.get(key) ?? 0) + 1);
  unretire(key);

  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  let inflight = pending.get(key);
  if (!inflight) {
    inflight = enqueue(key, priority, () => bake(src, caption)).then((texture) => {
      cache.set(key, texture);
      pending.delete(key);
      // The card may already have scrolled out of the window while this was in
      // flight — if nothing holds it now, it goes straight to the retired list.
      if ((refs.get(key) ?? 0) === 0) retire(key);
      return texture;
    });
    inflight = inflight.catch((error) => {
      // Otherwise the failed key sits in `pending` forever and the card can
      // never be retried, even after a scroll away and back. The reference
      // stays where it is: the card that took it releases it on unmount like
      // any other, and dropping it here as well double-counted.
      pending.delete(key);
      throw error;
    });
    pending.set(key, inflight);
  }
  return inflight;
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
