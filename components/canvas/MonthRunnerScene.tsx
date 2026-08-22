"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { MonthCard } from "@/components/canvas/MonthCard";
import { useActiveMonthIndex } from "@/lib/scroll-store";
import { months } from "@/lib/timeline";

/** Months either side of the current one that stay mounted (and textured). */
const WINDOW = 2;

/** Fraction of the card's width, matching the 68vw DOM design. */
const CARD_WIDTH = 0.68;
const CARD_ASPECT = 3 / 4;

function Cards() {
  const activeIndex = useActiveMonthIndex();
  const viewport = useThree((state) => state.viewport);

  const width = viewport.width * CARD_WIDTH;
  const height = width / CARD_ASPECT;
  // Sit the run slightly above centre; the month's copy lives below it.
  const lift = viewport.height * 0.08;

  return months.map((month, index) =>
    Math.abs(index - activeIndex) <= WINDOW ? (
      <MonthCard
        key={month.id}
        month={month}
        index={index}
        width={width}
        height={height}
        lift={lift}
      />
    ) : null,
  );
}

export function MonthRunnerScene() {
  return (
    // Pointer events stay on so cards can be tapped; the DOM text layer above
    // is pointer-events-none so taps reach them.
    <div className="fixed inset-0 z-0">
      <Canvas
        // 2x is plenty on a phone; 3x triples fill cost for nothing visible.
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 35, position: [0, 0, 6], near: 0.1, far: 60 }}
      >
        <Cards />
      </Canvas>
    </div>
  );
}
