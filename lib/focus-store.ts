"use client";

/**
 * Which month the reader has tapped open, and where the deck has been spun to.
 *
 * Same shape as lib/scroll-store, and for the same reason: `t`, `spread` and
 * `cursor` all change every frame — the first two while the deck flies in and
 * out, the third under the reader's finger — and are only ever read from
 * inside the render loop, so they update silently. Only `monthId` notifies,
 * because that is the one thing React has to mount and unmount on.
 *
 * GSAP owns the easing. Its ticker is already the page's only clock, so
 * tweening this object costs no new loop.
 */
import { useSyncExternalStore } from "react";
import gsap from "gsap";

interface FocusState {
  monthId: string | null;
  /**
   * RunnerPhoto.key of the card that was tapped. The run card itself flies
   * that one out — the same code that has always done it — and only hands
   * over to the deck once it has landed.
   */
  key: string | null;
  /**
   * False while the tapped run card is still flying; true from the moment it
   * lands until the month is closed. The deck draws nothing before it, and
   * everything after it — including the flight home, which by then may be a
   * different photograph's.
   */
  handed: boolean;
  /** Index within the month's photos of the card that was tapped. */
  origin: number;
  /**
   * Position around the deck. Deliberately *not* wrapped: it runs negative or
   * past the end and only the ring maths folds it back, which is what keeps a
   * tween across the seam from unwinding the long way round.
   */
  cursor: number;
  /** 0 in the run, 1 landed in front of the reader. */
  t: number;
  /** 0 stacked behind the front card, 1 fanned out into the pile. */
  spread: number;
  /** True between the end of the flight out and the start of the flight home. */
  landed: boolean;
}

const state: FocusState = {
  monthId: null,
  key: null,
  handed: false,
  origin: 0,
  cursor: 0,
  t: 0,
  spread: 0,
  landed: false,
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

export function focusCard(key: string, monthId: string, origin: number): void {
  if (state.monthId || closing) return;
  state.monthId = monthId;
  state.key = key;
  state.handed = false;
  state.origin = origin;
  state.cursor = origin;
  state.landed = false;
  notify();

  gsap.killTweensOf(state);
  gsap.to(state, {
    t: 1,
    duration: 0.55,
    ease: "power3.out",
    onComplete: () => {
      state.landed = true;
      // The deck takes over here and not a moment earlier. Its front card is
      // at exactly the pose the run card just reached — same texture, same
      // transform, `spread` still zero — so the swap cannot be seen.
      state.handed = true;
      notify();
      // Only now does the pile fan out from behind it.
      gsap.to(state, { spread: 1, duration: 0.45, ease: "power3.out" });
    },
  });
}

export function releaseFocus(): void {
  if (!state.monthId || closing) return;
  closing = true;
  state.landed = false;

  // Whichever card is at the front is the one that flies home, so the deck is
  // squared up first — closing mid-swipe should not send two cards back.
  gsap.killTweensOf(state, "cursor");
  state.cursor = Math.round(state.cursor);

  gsap.killTweensOf(state, "t,spread");
  gsap.to(state, { spread: 0, duration: 0.25, ease: "power2.in" });
  gsap.to(state, {
    t: 0,
    duration: 0.45,
    delay: 0.1,
    ease: "power2.inOut",
    onComplete: () => {
      // Only now does the month stop being open — its cards have to keep
      // reading their own flight all the way back into the run.
      state.monthId = null;
      state.key = null;
      state.handed = false;
      state.cursor = 0;
      state.origin = 0;
      closing = false;
      notify();
    },
  });
}

/** Under the finger: the cursor follows the drag directly. */
export function dragDeck(cursor: number): void {
  gsap.killTweensOf(state, "cursor");
  state.cursor = cursor;
}

/** On release: settle on a whole card — the nearest one, or the one asked for. */
export function settleDeck(to?: number): void {
  if (!state.monthId) return;
  const target = to ?? Math.round(state.cursor);
  gsap.killTweensOf(state, "cursor");
  gsap.to(state, { cursor: target, duration: 0.35, ease: "power2.out" });
}

/** Re-renders when a month opens and again once it is fully closed. */
export function useFocusedMonthId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => state.monthId,
    () => null,
  );
}
