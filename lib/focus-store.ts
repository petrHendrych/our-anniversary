"use client";

/**
 * Which card the reader has tapped open.
 *
 * Same shape as lib/scroll-store, and for the same reason: `t` — how far the
 * card has flown out of the run and towards the reader — changes every frame
 * and is only ever read from inside the render loop, so it updates silently.
 * The handful of things React genuinely needs to know about (which month is
 * open, whether the card has landed, whether the slideshow is up) notify.
 *
 * GSAP owns the easing. Its ticker is already the page's only clock, so
 * tweening this object costs no new loop.
 */
import { useSyncExternalStore } from "react";
import gsap from "gsap";

interface FocusState {
  /** RunnerPhoto.key of the focused card — which is its src. */
  key: string | null;
  monthId: string | null;
  /** 0 while the card is in the run, 1 once it has landed in front of the reader. */
  t: number;
  /** True once the flight out has finished; false the moment it starts back. */
  landed: boolean;
  /**
   * Viewport Y, in pixels, of the bottom edge of the landed card. The card is
   * the only thing that knows its own aspect ratio, so it publishes where it
   * will come to rest and the DOM column underneath sits on that — no
   * per-frame projection of the mesh.
   */
  bottom: number;
  slideshow: boolean;
}

const state: FocusState = {
  key: null,
  monthId: null,
  t: 0,
  landed: false,
  bottom: 0,
  slideshow: false,
};

/** True for the length of the flight home, so a second tap cannot restart it. */
let closing = false;

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Live, mutable read for animation loops. Never mutate from outside. */
export const focusState: Readonly<FocusState> = state;

export function focusCard(key: string, monthId: string, bottom: number): void {
  if (state.key === key || closing) return;
  state.key = key;
  state.monthId = monthId;
  state.bottom = bottom;
  state.landed = false;
  state.slideshow = false;
  notify();

  gsap.killTweensOf(state);
  gsap.to(state, {
    t: 1,
    duration: 0.55,
    ease: "power3.out",
    onComplete: () => {
      state.landed = true;
      notify();
    },
  });
}

export function releaseFocus(): void {
  if (!state.key || closing) return;
  closing = true;
  state.landed = false;
  state.slideshow = false;
  notify();

  gsap.killTweensOf(state);
  gsap.to(state, {
    t: 0,
    duration: 0.45,
    ease: "power2.inOut",
    onComplete: () => {
      // Only now does the card stop being the focused one — it has to keep
      // reading its own flight all the way back into the run.
      state.key = null;
      state.monthId = null;
      closing = false;
      notify();
    },
  });
}

/** Called again if the viewport changes shape while a card is open. */
export function setFocusBottom(bottom: number): void {
  if (state.bottom === bottom) return;
  state.bottom = bottom;
  notify();
}

export function openSlideshow(): void {
  if (!state.monthId || state.slideshow) return;
  state.slideshow = true;
  notify();
}

export function closeSlideshow(): void {
  if (!state.slideshow) return;
  state.slideshow = false;
  notify();
}

/** Re-renders when a card opens and again once it is fully closed. */
export function useFocusedMonthId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => state.monthId,
    () => null,
  );
}

/** Re-renders twice per open: on arrival, and when the card starts back. */
export function useFocusLanded(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.landed,
    () => false,
  );
}

/** Where the copy underneath the open card starts, in viewport pixels. */
export function useFocusBottom(): number {
  return useSyncExternalStore(
    subscribe,
    () => state.bottom,
    () => 0,
  );
}

export function useSlideshowOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.slideshow,
    () => false,
  );
}
