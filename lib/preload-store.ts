"use client";

/**
 * What has to be ready before the page opens.
 *
 * The counter on the loading screen is real: it tracks a fixed list of things
 * that genuinely have to finish — the display face, the scene coming up, and
 * the first few photographs baked into cards — rather than a timer pretending
 * to be progress. Warming those first cards is the point of the whole gate:
 * the flight through the lens is the worst possible moment to be baking a
 * texture.
 *
 * Like the other stores here, it is a plain mutable object for the loop to
 * read, with hooks over the two values React actually mounts on.
 */
import { useSyncExternalStore } from "react";
import { runnerPhotos } from "@/lib/runner-layout";
import { acquireCardTexture, releaseCardTexture } from "@/lib/card-texture";

/** Photographs warmed before the gate opens — the first ones down the run. */
const WARM = 6;
/** Nothing may hold the page shut for longer than this, whatever went wrong. */
const PATIENCE = 9000;

interface PreloadState {
  done: number;
  total: number;
  /** Everything is loaded; the gate can offer to open. */
  ready: boolean;
  /** The reader has stepped through it. */
  started: boolean;
}

const state: PreloadState = {
  done: 0,
  // The display face, the scene's first frame, and one per warmed photograph.
  total: 2 + WARM,
  ready: false,
  started: false,
};

const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Live, mutable read for the ticker that drives the counter. */
export const preloadState: Readonly<PreloadState> = state;

let begun = false;
let timer: number | undefined;

function step() {
  if (state.ready) return;
  state.done = Math.min(state.total, state.done + 1);
  if (state.done >= state.total) finish();
}

function finish() {
  if (state.ready) return;
  if (timer !== undefined) window.clearTimeout(timer);
  state.done = state.total;
  state.ready = true;
  notify();
}

let sceneCounted = false;

/** Called once the R3F canvas exists — see MonthRunnerScene's onCreated. */
export function markSceneReady(): void {
  if (sceneCounted) return;
  sceneCounted = true;
  step();
}

export function beginPreload(): void {
  if (begun) return;
  begun = true;

  // A photograph that will not load, or a face that never arrives, must not
  // leave the reader looking at a stuck number.
  timer = window.setTimeout(finish, PATIENCE);

  const fonts = document.fonts?.ready ?? Promise.resolve();
  fonts.then(step, step);

  for (const photo of runnerPhotos.slice(0, WARM)) {
    acquireCardTexture(photo.src, photo.caption).then(
      () => {
        // Released straight away: the cache keeps it warm without pinning it,
        // so the sliding window can still evict it later.
        releaseCardTexture(photo.src, photo.caption);
        step();
      },
      step,
    );
  }
}

export function enterSite(): void {
  if (state.started) return;
  state.started = true;
  notify();
}

export function usePreloadReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.ready,
    () => false,
  );
}

export function useHasEntered(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.started,
    () => false,
  );
}
