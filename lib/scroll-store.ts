"use client";

/**
 * The single place scroll state is published to the rest of the app.
 *
 * Deliberately not React state at heart: `depth` updates every frame, and the
 * 3D scene needs to read it inside a render loop without causing React
 * re-renders. So the store is a plain object plus a listener set, with thin
 * hooks on top for the few things that genuinely belong in React's render
 * cycle.
 *
 * GSAP ScrollTrigger, reading Lenis, is the only writer. Nothing that reads
 * from it has to care.
 */
import { useSyncExternalStore } from "react";

export interface ScrollSnapshot {
  /** 0-1 across the whole page. */
  progress: number;
  /** Index into `months` from lib/timeline — drives the nav and the copy. */
  activeIndex: number;
  /**
   * How far the reader has flown down the run, in world units (see
   * lib/runner-layout). This is what the 3D cards read: a card sits at the
   * camera plane when `depth` equals the card's own depth.
   */
  depth: number;
  /**
   * False until the reader has flown through the intro camera's lens. Nothing
   * belonging to a month — photo, title, nav, header — exists before it.
   */
  entered: boolean;
  /**
   * False until the reader is level with the intro camera and past it. Later
   * than `entered`, which fires while the camera is still out in front: this is
   * the moment the approach is actually over, and the only honest answer to
   * "have they gone through it yet".
   */
  passed: boolean;
  /**
   * Index into `runnerPhotos` of the photo nearest the camera. Changes a few
   * dozen times across the whole page, so unlike `depth` it is safe to
   * re-render on — the scene mounts its texture window around it.
   */
  photoIndex: number;
}

const state: ScrollSnapshot = {
  progress: 0,
  activeIndex: 0,
  depth: 0,
  photoIndex: 0,
  entered: false,
  passed: false,
};
const listeners = new Set<() => void>();

/** Live, mutable read for animation loops. Never mutate from outside. */
export const scrollState: Readonly<ScrollSnapshot> = state;

export function subscribeScroll(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setScrollState(next: Partial<ScrollSnapshot>): void {
  let changed = false;
  if (next.progress !== undefined && next.progress !== state.progress) {
    state.progress = next.progress;
    changed = true;
  }
  if (next.activeIndex !== undefined && next.activeIndex !== state.activeIndex) {
    state.activeIndex = next.activeIndex;
    changed = true;
  }
  if (next.photoIndex !== undefined && next.photoIndex !== state.photoIndex) {
    state.photoIndex = next.photoIndex;
    changed = true;
  }
  if (next.entered !== undefined && next.entered !== state.entered) {
    state.entered = next.entered;
    changed = true;
  }
  if (next.passed !== undefined && next.passed !== state.passed) {
    state.passed = next.passed;
    changed = true;
  }
  // `depth` moves every frame and is only ever read from render loops, so it
  // updates silently — notifying listeners for it would defeat the point.
  if (next.depth !== undefined) state.depth = next.depth;
  if (changed) for (const listener of listeners) listener();
}

/**
 * Re-renders on every active-month change only — safe for React.
 * There is intentionally no `useScrollProgress()`: subscribing a component to
 * a value that changes 60+ times a second is how this page would get slow.
 * Read `scrollState.depth` from a subscription and write to a ref instead.
 */
export function useActiveMonthIndex(): number {
  return useSyncExternalStore(
    subscribeScroll,
    () => state.activeIndex,
    () => 0,
  );
}

/** Re-renders once, when the reader passes through the lens. */
export function useEntered(): boolean {
  return useSyncExternalStore(
    subscribeScroll,
    () => state.entered,
    () => false,
  );
}

/** Re-renders once, when the reader is past the intro camera. */
export function usePassedCamera(): boolean {
  return useSyncExternalStore(
    subscribeScroll,
    () => state.passed,
    () => false,
  );
}

/** Re-renders only when a different photo becomes the nearest one. */
export function useNearestPhotoIndex(): number {
  return useSyncExternalStore(
    subscribeScroll,
    () => state.photoIndex,
    () => 0,
  );
}
