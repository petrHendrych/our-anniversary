"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { scrollState } from "@/lib/scroll-store";
import { CAMERA_Z, gateOpacity, monthStartDepths } from "@/lib/runner-layout";
import { tiltCurrent } from "@/lib/tilt";
import { months, years } from "@/lib/timeline";

/** Distances from the camera, in the same world units as the runner. */
const APPEAR_FAR = 4200;
const APPEAR_NEAR = 3000;
/** Only the last moment fades, and only enough to hide the cut — the reader
    flies through the letters rather than watching them dissolve. */
const PASS_FAR = 150;
const PASS_NEAR = 65;

/**
 * The month's name, flying through the scene ahead of its photographs.
 *
 * It is real DOM text, not 3D geometry — the type stays crisp and selectable,
 * and the perspective is faked exactly the way the camera does it: apparent
 * size is CAMERA_Z / distance, so the title scales along the same curve as a
 * photo at the same depth would. Each title crosses the camera at its month's
 * start depth: it holds full strength all the way in, grows past the edges of
 * the screen, and the reader passes straight through the letters. It is gone
 * before the first photo arrives (PHOTO_LEAD).
 */
export function MonthTitleRunner() {
  const nodes = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const update = () => {
      // A camera rotation shifts everything on screen by roughly focal ×
      // tan(angle), whatever its depth — so the titles pan with the photos
      // instead of staying pinned to the middle while the scene moves.
      const panX = CAMERA_Z * Math.tan(tiltCurrent.y);
      const panY = CAMERA_Z * Math.tan(tiltCurrent.x);

      for (let i = 0; i < months.length; i++) {
        // Before the lens there are no months at all — see IntroCamera.
        if (!scrollState.entered) {
          const node = nodes.current[i];
          if (node) node.style.visibility = "hidden";
          continue;
        }

        const node = nodes.current[i];
        if (!node) continue;

        const distance = CAMERA_Z + monthStartDepths[i] - scrollState.depth;
        if (distance > APPEAR_FAR || distance < PASS_NEAR) {
          if (node.style.visibility !== "hidden") node.style.visibility = "hidden";
          continue;
        }

        const scale = CAMERA_Z / distance;
        const arriving = gsap.utils.mapRange(APPEAR_FAR, APPEAR_NEAR, 0, 1, distance);
        const leaving = gsap.utils.mapRange(PASS_NEAR, PASS_FAR, 0, 1, distance);
        const opacity =
          Math.min(1, Math.max(0, Math.min(arriving, leaving))) *
          gateOpacity(scrollState.depth);

        node.style.visibility = "visible";
        node.style.opacity = String(opacity);
        node.style.transform = `translate3d(calc(-50% + ${panX.toFixed(1)}px), calc(-50% + ${panY.toFixed(1)}px), 0) scale(${scale.toFixed(4)})`;
      }
    };

    gsap.ticker.add(update);
    return () => gsap.ticker.remove(update);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[3] overflow-hidden">
      {months.map((month, i) => {
        const year = years.find((block) => block.year === month.year);
        return (
          <div
            key={month.id}
            ref={(node) => {
              nodes.current[i] = node;
            }}
            // Positioned at the centre of the screen and scaled from there,
            // which is where the camera axis passes through.
            className="absolute left-1/2 top-1/2 flex w-[92vw] flex-col items-center will-change-transform"
            style={{ visibility: "hidden" }}
          >
            <span className="eyebrow text-dim">
              {year?.label ?? month.year} · {month.year}
            </span>
            <span className="display mt-2 whitespace-nowrap text-[26vw] leading-none text-bone">
              {month.monthLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
