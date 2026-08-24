"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setScrollState } from "@/lib/scroll-store";
import {
  CAMERA_PASS_DEPTH,
  LENS_DEPTH,
  monthStartDepths,
  nearestPhotoIndex,
  runnerDepth,
} from "@/lib/runner-layout";
import { monthCount } from "@/lib/timeline";

// Idempotent, and not safe to rely on another module having run first.
gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The only place scroll position is read.
 *
 * Its job is to turn page scroll into a depth along the run (see
 * lib/runner-layout): each month's DOM section is anchored to that month's
 * depth, and scroll between two anchors interpolates linearly between their
 * depths. Because a month's depth grows with the number of photos in it, and
 * MonthSection sizes its section to match, the flight speed stays even
 * whether a month has four photos or seven.
 *
 * Everything scroll-linked hangs off this: the header bar, the active tick in
 * the spine, the flying month titles, and the 3D photos — which read `depth` from the
 * store rather than measuring scroll for themselves.
 */
export function ScrollDriver() {
  useGSAP(() => {
    const sections = gsap.utils.toArray<HTMLElement>("[data-month-index]");

    /**
     * Scroll offsets and the depths they map to. The first pair is the top of
     * the page at depth zero — the intro flight up to the camera — and the
     * rest are each month's section start at that month's depth.
     */
    let anchors: number[] = [];
    let depths: number[] = [0, ...monthStartDepths];

    const measure = () => {
      anchors = [
        0,
        ...sections.map((el) => el.getBoundingClientRect().top + window.scrollY),
      ];
      depths = [0, ...monthStartDepths];
    };

    /** Piecewise-linear scroll -> depth, extrapolated past both ends. */
    const depthAt = (scroll: number): number => {
      if (anchors.length === 0) return 0;
      if (anchors.length === 1) return scroll - anchors[0];

      // Before the first month and after the last, carry on at the
      // neighbouring month's rate so photos are already approaching during the
      // intro and still receding through the outro.
      if (scroll <= anchors[0]) {
        const rate = (depths[1] - depths[0]) / (anchors[1] - anchors[0]);
        return depths[0] + (scroll - anchors[0]) * rate;
      }

      for (let i = 1; i < anchors.length; i++) {
        if (scroll < anchors[i]) {
          const t = (scroll - anchors[i - 1]) / (anchors[i] - anchors[i - 1]);
          return gsap.utils.interpolate(depths[i - 1], depths[i], t);
        }
      }

      const last = anchors.length - 1;
      const rate =
        (depths[last] - depths[last - 1]) / (anchors[last] - anchors[last - 1]);
      return depths[last] + (scroll - anchors[last]) * rate;
    };

    ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      onRefresh: measure,
      onUpdate: (self) => {
        const scroll = self.scroll();
        const depth = depthAt(scroll);
        // The month whose section the reader is actually in — the copy, the
        // spine and the header all follow the DOM, not the depth.
        let activeIndex = 0;
        for (let i = 0; i < sections.length; i++) {
          if (scroll >= anchors[i + 1] - window.innerHeight * 0.5) activeIndex = i;
        }

        setScrollState({
          progress: self.progress,
          depth,
          activeIndex: gsap.utils.clamp(0, monthCount - 1, activeIndex),
          photoIndex: nearestPhotoIndex(gsap.utils.clamp(0, runnerDepth, depth)),
          entered: depth >= LENS_DEPTH,
          passed: depth >= CAMERA_PASS_DEPTH,
        });
      },
    });

    // Decorative motion only — skipped wholesale when reduced motion is on.
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      for (const copy of gsap.utils.toArray<HTMLElement>("[data-month-copy]")) {
        gsap.from(copy, {
          autoAlpha: 0,
          y: 20,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: {
            trigger: copy,
            start: "top 88%",
            toggleActions: "play none none reverse",
          },
        });
      }
    });

    // Web fonts land after first paint and shift every trigger's measurements.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  });

  return null;
}
