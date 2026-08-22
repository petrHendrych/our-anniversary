"use client";

/**
 * Which month is expanded into the drawer, and where its card was on screen
 * when it was tapped.
 *
 * This is a module store rather than context for the same reason as
 * lib/scroll-store: the tap originates inside the <Canvas>, which R3F renders
 * with its own reconciler, so React context does not reach it without a
 * bridge. A plain store crosses the boundary with nothing in between.
 */
import { useSyncExternalStore } from "react";

/** CSS pixels, viewport-relative — the geometry the drawer flight starts from. */
export interface CardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ExpandedState {
  monthId: string | null;
  rect: CardRect | null;
}

const state: ExpandedState = { monthId: null, rect: null };
const listeners = new Set<() => void>();

export const expandedState: Readonly<ExpandedState> = state;

function notify() {
  for (const listener of listeners) listener();
}

export function expandMonth(monthId: string, rect: CardRect): void {
  if (state.monthId === monthId) return;
  state.monthId = monthId;
  state.rect = rect;
  notify();
}

export function collapseMonth(): void {
  if (state.monthId === null) return;
  state.monthId = null;
  state.rect = null;
  notify();
}

export function useExpandedMonthId(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state.monthId,
    () => null,
  );
}
