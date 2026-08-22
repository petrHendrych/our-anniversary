"use client";

import { spineTicks, type SpineTick } from "@/lib/timeline";

/**
 * The site's signature element: every month of both years as a tick, with only
 * the recorded ones lit. Drawn wide under the intro, then docked to the right
 * edge as the nav — same instrument, two postures, so its meaning is already
 * learned by the time it becomes navigation.
 */
export function CalendarSpine({
  orientation,
  activeIndex,
  onSelect,
}: {
  orientation: "horizontal" | "vertical";
  activeIndex?: number;
  onSelect?: (tick: SpineTick) => void;
}) {
  const interactive = Boolean(onSelect);

  if (orientation === "horizontal") {
    return (
      <div className="flex items-end gap-[3px]" aria-hidden>
        {spineTicks.map((tick, i) => (
          <span
            key={tick.key}
            className={[
              "w-px",
              tick.monthId ? "h-7 bg-lit" : "h-2 bg-line",
              i % 12 === 0 && i > 0 ? "ml-3" : "",
            ].join(" ")}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-[10px]">
      {spineTicks.map((tick, i) => {
        const isActive = tick.index !== null && tick.index === activeIndex;
        const yearGap = i % 12 === 0 && i > 0 ? "mt-4" : "";

        if (!tick.monthId || !interactive) {
          return (
            <span
              key={tick.key}
              aria-hidden
              className={`h-px ${tick.monthId ? "w-4 bg-bone/50" : "w-2 bg-line"} ${yearGap}`}
            />
          );
        }

        return (
          <button
            key={tick.key}
            type="button"
            onClick={() => onSelect?.(tick)}
            aria-label={`Jump to ${tick.label} ${tick.year}`}
            aria-current={isActive ? "true" : undefined}
            className={`relative flex justify-end py-2 ${yearGap}`}
          >
            {isActive && (
              <span className="eyebrow absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap text-lit">
                {tick.label}
              </span>
            )}
            <span
              className={`h-px transition-all duration-300 ${
                isActive ? "w-7 bg-lit" : "w-4 bg-bone/50"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
