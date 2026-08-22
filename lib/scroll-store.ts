"use client";

/**
 * The single place scroll state is published to the rest of the app.
 *
 * Deliberately not React state at heart: `progress` updates every frame, and
 * the 3D scene (milestone 5) needs to read it inside a render loop without
 * causing React re-renders. So the store is a plain object plus a listener
 * set, with thin hooks on top for the few things that genuinely belong in
 * React's render cycle.
 *
 * Whoever *writes* to this store changes over time — a native scroll listener
 * first, GSAP ScrollTrigger reading Lenis after that. Nothing that reads from
 * it has to care.
 */
import { useSyncExternalStore } from "react";

export interface ScrollSnapshot {
  /** 0-1 across the whole page. */
  progress: number;
  /** Index into `months` from lib/timeline. */
  activeIndex: number;
  /**
   * Continuous position along the month run, in month units: 2.5 means
   * exactly between the third and fourth month. This is what the 3D cards
   * read — `activeIndex` is just this value rounded.
   */
  runner: number;
}

const state: ScrollSnapshot = { progress: 0, activeIndex: 0, runner: 0 };
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
  // `runner` moves every frame and is only ever read from render loops, so it
  // updates silently — notifying listeners for it would defeat the point.
  if (next.runner !== undefined) state.runner = next.runner;
  if (changed) for (const listener of listeners) listener();
}

/**
 * Re-renders on every active-month change only — safe for React.
 * There is intentionally no `useScrollProgress()`: subscribing a component to
 * a value that changes 60+ times a second is how this page would get slow.
 * Read `scrollState.progress` from a subscription and write to a ref instead.
 */
export function useActiveMonthIndex(): number {
  return useSyncExternalStore(
    subscribeScroll,
    () => state.activeIndex,
    () => 0,
  );
}
