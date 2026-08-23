"use client";

import type { ReactNode } from "react";
import { useEntered } from "@/lib/scroll-store";

/**
 * Holds back everything that belongs to the months — the header readout, the
 * side nav — until the reader has flown through the intro camera's lens.
 * Before that the page is only the title and the camera; nothing gives away
 * what is on the other side.
 */
export function AfterLens({ children }: { children: ReactNode }) {
  const entered = useEntered();

  return (
    <div
      className={`transition-opacity duration-700 ${entered ? "opacity-100" : "opacity-0"}`}
      // Fixed children are unaffected by this wrapper's own layout.
      style={{ pointerEvents: entered ? undefined : "none" }}
      aria-hidden={!entered}
    >
      {children}
    </div>
  );
}
