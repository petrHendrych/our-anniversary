"use client";

import type { ReactNode } from "react";
import { useEntered } from "@/lib/scroll-store";
import { useFocusedMonthId } from "@/lib/focus-store";

/**
 * Holds back everything that belongs to the months — the header readout, the
 * side nav — until the reader has flown through the intro camera's lens.
 * Before that the page is only the title and the camera; nothing gives away
 * what is on the other side. It stands down again while a card is open, which
 * belongs to one month rather than to the run.
 */
export function AfterLens({ children }: { children: ReactNode }) {
  const entered = useEntered();
  const focused = Boolean(useFocusedMonthId());
  const shown = entered && !focused;

  return (
    <div
      className={`transition-opacity duration-700 ${shown ? "opacity-100" : "opacity-0"}`}
      // Fixed children are unaffected by this wrapper's own layout.
      style={{ pointerEvents: shown ? undefined : "none" }}
      aria-hidden={!shown}
    >
      {children}
    </div>
  );
}
