import * as THREE from "three";

/**
 * Sliding-window texture cache.
 *
 * Mobile Safari has a WebGL memory ceiling that has nothing to do with how
 * fast the chip is, so textures are never all resident at once. Lifetime is
 * tied to card mount: the scene only mounts cards near the current month, each
 * card acquires its cover on mount and releases it on unmount, and the window
 * falls out of that with no separate bookkeeping.
 *
 * Released textures are not disposed immediately — the last few are retained
 * so that scrubbing back and forth across a month boundary re-decodes nothing.
 * A month is a cluster of several photos, so the retained count is sized to
 * hold roughly two clusters' worth.
 */

const RETAINED = 10;

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();
const pending = new Map<string, Promise<THREE.Texture>>();
const refs = new Map<string, number>();
/** Zero-ref sources, oldest first. */
const retired: string[] = [];

function unretire(src: string) {
  const i = retired.indexOf(src);
  if (i >= 0) retired.splice(i, 1);
}

function retire(src: string) {
  if (!cache.has(src) || retired.includes(src)) return;
  retired.push(src);
  while (retired.length > RETAINED) {
    const evicted = retired.shift();
    if (!evicted || (refs.get(evicted) ?? 0) > 0) continue;
    cache.get(evicted)?.dispose();
    cache.delete(evicted);
  }
}

export function acquireTexture(src: string): Promise<THREE.Texture> {
  refs.set(src, (refs.get(src) ?? 0) + 1);
  unretire(src);

  const cached = cache.get(src);
  if (cached) return Promise.resolve(cached);

  let load = pending.get(src);
  if (!load) {
    load = loader.loadAsync(src).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      cache.set(src, texture);
      pending.delete(src);
      // The card may already have scrolled out of the window while this was in
      // flight — if nothing holds it now, it goes straight to the retired list.
      if ((refs.get(src) ?? 0) === 0) retire(src);
      return texture;
    });
    pending.set(src, load);
  }
  return load;
}

export function releaseTexture(src: string): void {
  const remaining = (refs.get(src) ?? 1) - 1;
  if (remaining > 0) {
    refs.set(src, remaining);
    return;
  }
  refs.delete(src);
  retire(src);
}

/** Resident texture count — handy when profiling on a real device. */
export function residentTextureCount(): number {
  return cache.size;
}
