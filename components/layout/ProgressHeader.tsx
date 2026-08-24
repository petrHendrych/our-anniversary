"use client";

import { useEffect, useRef } from "react";
import { scrollState, subscribeScroll, useActiveMonthIndex, useEntered } from "@/lib/scroll-store";
import { useHasEntered } from "@/lib/preload-store";
import { useFocusedMonthId } from "@/lib/focus-store";
import { months } from "@/lib/timeline";

/**
 * The one persistent piece of chrome.
 *
 * Unlike the side nav it is not held back until the reader is through the lens:
 * the gate lifts on a big "Two years" and this catches it, so the title carries
 * across into the camera scene instead of vanishing and reappearing on the far
 * side. What *is* held back is the month readout on the right, which has
 * nothing to say until the months have started.
 */
export function ProgressHeader() {
  const started = useHasEntered();
  const entered = useEntered();
  const focused = Boolean(useFocusedMonthId());
  const activeIndex = useActiveMonthIndex();
  const barRef = useRef<HTMLDivElement>(null);
  const active = months[activeIndex];

  // The bar tracks a value that changes every frame, so it never goes through
  // React — subscribe once and write the transform straight to the node.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const paint = () => {
      bar.style.transform = `scaleX(${scrollState.progress})`;
    };
    paint();
    return subscribeScroll(paint);
  }, []);

  // An open card belongs to one month, not to the run the header measures.
  const shown = started && !focused;

  return (
    <header
      className={`pointer-events-none fixed inset-x-0 top-0 z-30 transition-opacity duration-700 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      aria-hidden={!shown}
    >
      <div className="h-px w-full bg-line">
        <div ref={barRef} className="h-px w-full origin-left scale-x-0 bg-lit" />
      </div>
      <div className="flex items-baseline justify-between px-5 py-4">
        <span className="eyebrow text-bone/70">Two years</span>
        <span
          className={`eyebrow text-lit transition-opacity duration-500 ${
            entered ? "opacity-100" : "opacity-0"
          }`}
        >
          {active.year} · {active.monthLabel}
        </span>
      </div>
    </header>
  );
}
