"use client";

/**
 * Which card the reader has tapped open, and where its deck has been spun to.
 *
 * A card is one event, and an event carries its own photographs — so what is
 * open is an event, not a month. `monthId` is kept alongside it because the
 * page around the run still asks which month it is looking at.
 *
 * Same shape as lib/scroll-store, and for the same reason: `t`, `spread` and
 * `cursor` all change every frame — the first two while the deck flies in and
 * out, the third under the reader's finger — and are only ever read from
 * inside the render loop, so they update silently. Only `eventId` and
 * `monthId` notify, because those are the things React has to mount on.
 *
 * GSAP owns the easing. Its ticker is already the page's only clock, so
 * tweening this object costs no new loop.
 */
import { useSyncExternalStore } from "react";
import gsap from "gsap";

interface FocusState {
  /** The event whose card was tapped — the deck is its photographs. */
  eventId: string | null;
  /** The month that event belongs to. */
  monthId: string | null;
  /**
   * RunnerPhoto.key of the card that was tapped. The run card itself flies
   * that one out — the same code that has always done it — and only hands
   * over to the deck once it has landed.
   */
  key: string | null;
  /**
   * False while the tapped run card is still flying; true from the moment it
   * lands until the card is closed. The deck draws nothing before it, and
   * everything after it.
   */
  handed: boolean;
  /** How many photographs the open deck has, cover included. */
  count: number;
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
  eventId: null,
  monthId: null,
  key: null,
  handed: false,
  count: 0,
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

export function focusCard(
  key: string,
  eventId: string,
  monthId: string,
  count: number,
): void {
  if (state.eventId || closing) return;
  state.eventId = eventId;
  state.monthId = monthId;
  state.key = key;
  state.handed = false;
  state.count = count;
  // A deck always opens on its own cover: that is the card that was tapped,
  // and the only one of the event's photographs that was ever in the run.
  state.cursor = 0;
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
  if (!state.eventId || closing) return;
  closing = true;
  state.landed = false;

  // The card flies home to the slot it came out of, so the card that flies is
  // the cover — the only photograph of this event that has a slot at all. The
  // deck is wound back to it first, by the shortest way round: `cursor` is
  // unwrapped, so any whole lap is the cover again.
  gsap.killTweensOf(state, "cursor");
  const count = Math.max(1, state.count);
  const cover = Math.round(state.cursor / count) * count;
  const spin = cover === state.cursor ? 0 : 0.26;
  if (spin) gsap.to(state, { cursor: cover, duration: spin, ease: "power2.inOut" });
  else state.cursor = cover;

  gsap.killTweensOf(state, "t,spread");
  gsap.to(state, { spread: 0, duration: 0.25, ease: "power2.in" });
  gsap.to(state, {
    t: 0,
    duration: 0.45,
    // Never before the deck is square again: a card halfway round the ring has
    // no run pose of its own to fly back to.
    delay: 0.1 + spin,
    ease: "power2.inOut",
    onComplete: () => {
      // Only now does the card stop being open — it has to keep reading its
      // own flight all the way back into the run.
      state.eventId = null;
      state.monthId = null;
      state.key = null;
      state.handed = false;
      state.count = 0;
      state.cursor = 0;
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
  if (!state.eventId) return;
  const target = to ?? Math.round(state.cursor);
  gsap.killTweensOf(state, "cursor");
  gsap.to(state, { cursor: target, duration: 0.35, ease: "power2.out" });
}

/** Re-renders when a card opens and again once it is fully closed. */
export function useFocusedEventId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => state.eventId,
    () => null,
  );
}

/** The month the open card belongs to — what the page around the run asks for. */
export function useFocusedMonthId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => state.monthId,
    () => null,
  );
}
