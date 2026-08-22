"use client";

import { useEffect, useRef } from "react";
import { scrollState, subscribeScroll, useActiveMonthIndex } from "@/lib/scroll-store";
import { months } from "@/lib/timeline";

export function ProgressHeader() {
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

  return (
    <header
      className="fixed inset-x-0 top-0 z-30 pointer-events-none"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="h-px w-full bg-line">
        <div
          ref={barRef}
          className="h-px w-full origin-left scale-x-0 bg-lit"
        />
      </div>
      <div className="flex items-baseline justify-between px-5 py-4">
        <span className="eyebrow text-bone/70">Two years</span>
        <span className="eyebrow text-lit">
          {active.year} · {active.monthLabel}
        </span>
      </div>
    </header>
  );
}
