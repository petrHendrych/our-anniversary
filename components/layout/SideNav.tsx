"use client";

import { useLenis } from "lenis/react";
import { CalendarSpine } from "@/components/layout/CalendarSpine";
import { useActiveMonthIndex } from "@/lib/scroll-store";
import { sectionId, type SpineTick } from "@/lib/timeline";

export function SideNav() {
  const activeIndex = useActiveMonthIndex();
  const lenis = useLenis();

  // Jumps go through Lenis, not scrollIntoView — same scroll source as
  // everything else, so ScrollTrigger stays in sync during the travel.
  function jumpTo(tick: SpineTick) {
    if (!tick.monthId) return;
    lenis?.scrollTo(`#${sectionId(tick.monthId)}`, {
      duration: 1.1,
      lock: true,
    });
  }

  return (
    <nav
      aria-label="Timeline"
      className="fixed right-4 top-1/2 z-30 -translate-y-1/2"
      style={{ paddingRight: "env(safe-area-inset-right)" }}
    >
      <CalendarSpine
        orientation="vertical"
        activeIndex={activeIndex}
        onSelect={jumpTo}
      />
    </nav>
  );
}
