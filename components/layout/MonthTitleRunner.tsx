"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { scrollState } from "@/lib/scroll-store";
import {
  CAMERA_Z,
  gateOpacity,
  monthStartDepths,
  TITLE_APPEAR_FAR,
  TITLE_APPEAR_NEAR,
  TITLE_PASS_FAR,
  TITLE_PASS_NEAR,
} from "@/lib/runner-layout";
import { paletteFor } from "@/lib/palette";
import { tiltCurrent } from "@/lib/tilt";
import { months, years } from "@/lib/timeline";

/**
 * The month's name, flying through the scene ahead of its photographs.
 *
 * It is real DOM text, not 3D geometry — the type stays crisp and selectable,
 * and the perspective is faked exactly the way the camera does it: apparent
 * size is CAMERA_Z / distance, so the title scales along the same curve as a
 * photo at the same depth would. Each title crosses the camera at its month's
 * start depth: it holds full strength all the way in, grows past the edges of
 * the screen, and the reader passes straight through the letters. It is gone
 * while its month's first card is still back in the haze — TITLE_PASS_NEAR
 * against EVENT_LEAD, both in lib/runner-layout, which is also where the
 * spacing that stops two titles ever sharing the screen is set.
 *
 * A title is painted in its *own* month's ink, written as a literal rather
 * than read from --bone. That is not a style choice, it is why the type does
 * not flicker: --bone is a registered custom property that crossfades for
 * 900ms every time the month changes, and an element whose colour animates has
 * to be repainted — which for a will-change-transform layer means re-rastering
 * a word thousands of pixels wide mid-flight, and the browser drops the tiles
 * it cannot fit. Fixed colours mean the layer is rastered once and thereafter
 * only transformed. It reads better too: October's name is October's colour,
 * not a blend of October's and November's.
 */
export function MonthTitleRunner() {
  const nodes = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    // What each node was last told. A title is on screen for a second or two
    // out of the whole page, so almost every frame has nothing to say to
    // almost every node — and a style write it cannot skip is a style write
    // the browser has to consider.
    const drawn: Array<boolean> = months.map(() => false);

    const hide = (i: number) => {
      if (!drawn[i]) return;
      drawn[i] = false;
      const node = nodes.current[i];
      if (!node) return;
      node.style.visibility = "hidden";
      // Only a title that is actually flying is worth a compositor layer of
      // its own. Twenty-four permanently promoted layers, each holding a word
      // set at a quarter of the screen's width, is a lot of texture memory to
      // keep for one of them at a time.
      node.style.willChange = "auto";
    };

    const update = () => {
      // Before the lens there are no months at all — see IntroCamera.
      if (!scrollState.entered) {
        for (let i = 0; i < months.length; i++) hide(i);
        return;
      }

      // A camera rotation shifts everything on screen by roughly focal ×
      // tan(angle), whatever its depth — so the titles pan with the photos
      // instead of staying pinned to the middle while the scene moves.
      const panX = CAMERA_Z * Math.tan(tiltCurrent.y);
      const panY = CAMERA_Z * Math.tan(tiltCurrent.x);

      for (let i = 0; i < months.length; i++) {
        const distance = CAMERA_Z + monthStartDepths[i] - scrollState.depth;
        if (distance > TITLE_APPEAR_FAR || distance < TITLE_PASS_NEAR) {
          hide(i);
          continue;
        }

        const node = nodes.current[i];
        if (!node) continue;

        const scale = CAMERA_Z / distance;
        const arriving = gsap.utils.mapRange(TITLE_APPEAR_FAR, TITLE_APPEAR_NEAR, 0, 1, distance);
        const leaving = gsap.utils.mapRange(TITLE_PASS_NEAR, TITLE_PASS_FAR, 0, 1, distance);
        const opacity =
          Math.min(1, Math.max(0, Math.min(arriving, leaving))) *
          gateOpacity(scrollState.depth);

        if (!drawn[i]) {
          drawn[i] = true;
          node.style.willChange = "transform";
          node.style.visibility = "visible";
        }
        node.style.opacity = opacity.toFixed(3);
        node.style.transform = `translate3d(calc(-50% + ${panX.toFixed(1)}px), calc(-50% + ${panY.toFixed(1)}px), 0) scale(${scale.toFixed(4)})`;
      }
    };

    gsap.ticker.add(update);
    return () => gsap.ticker.remove(update);
  }, []);

  return (
    <div
      aria-hidden
      data-title-runner
      className="pointer-events-none fixed inset-0 z-[3] overflow-hidden"
    >
      {months.map((month, i) => {
        const year = years.find((block) => block.year === month.year);
        const palette = paletteFor(i);
        return (
          <div
            key={month.id}
            ref={(node) => {
              nodes.current[i] = node;
            }}
            // Positioned at the centre of the screen and scaled from there,
            // which is where the camera axis passes through.
            className="absolute left-1/2 top-1/2 flex w-[92vw] flex-col items-center"
            style={{ visibility: "hidden" }}
          >
            <span className="eyebrow" style={{ color: palette.dim }}>
              {year?.label ?? month.year} · {month.year}
            </span>
            <span
              className="display mt-2 whitespace-nowrap text-[26vw] leading-none"
              style={{ color: palette.text }}
            >
              {month.monthLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
