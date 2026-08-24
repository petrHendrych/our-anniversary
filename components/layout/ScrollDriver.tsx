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
 * the spine, the flying month titles, and the 3D photos — which read `depth`
 * from the store rather than measuring scroll for themselves.
 *
 * The reading is taken on the gsap ticker rather than from inside a
 * ScrollTrigger's own onUpdate. Lenis is still the only thing that moves the
 * page and ScrollTrigger still owns everything else on it — this is the same
 * scroll, read one step later. The reason is that a ScrollTrigger only calls
 * onUpdate while the scroll is between its start and end, and those two are
 * measured off an element's box; get that measurement wrong by any means and
 * the callback simply stops being called, which does not look like a broken
 * measurement, it looks like the entire run failing to exist. A phone found
 * one of those ways and a desktop did not: the page scrolled, the sticky month
 * copy went with it because that is pure CSS, and the reader sat looking at
 * the intro camera for the length of two years. Scroll position is one number
 * and reading it needs no range to be inside of.
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

    /** Scroll at the very bottom of the page — the denominator for progress. */
    let maxScroll = 1;

    const measure = () => {
      anchors = [
        0,
        ...sections.map((el) => el.getBoundingClientRect().top + window.scrollY),
      ];
      depths = [0, ...monthStartDepths];
      maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
    };

    /** Piecewise-linear scroll -> depth, extrapolated past both ends. */
    const depthAt = (scroll: number): number => {
      // If measure() has somehow not run, every reader gets the same symptom:
      // the page scrolls and the run sits at depth zero with the intro camera
      // parked in front of them. One layout read, once, is cheap insurance.
      if (anchors.length === 0) measure();
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
      // Two sections measured to the same offset would make this Infinity, and
      // a NaN depth hides the whole run rather than just misplacing it.
      const span = anchors[last] - anchors[last - 1];
      if (span <= 0) return depths[last];
      const rate = (depths[last] - depths[last - 1]) / span;
      return depths[last] + (scroll - anchors[last]) * rate;
    };

    const read = () => {
      const scroll = window.scrollY;
      const depth = depthAt(scroll);
      // The month whose section the reader is actually in — the copy, the
      // spine and the header all follow the DOM, not the depth.
      let activeIndex = 0;
      for (let i = 0; i < sections.length; i++) {
        if (scroll >= anchors[i + 1] - window.innerHeight * 0.5) activeIndex = i;
      }

      setScrollState({
        progress: gsap.utils.clamp(0, 1, scroll / maxScroll),
        depth,
        activeIndex: gsap.utils.clamp(0, monthCount - 1, activeIndex),
        photoIndex: nearestPhotoIndex(gsap.utils.clamp(0, runnerDepth, depth)),
        entered: depth >= LENS_DEPTH,
        passed: depth >= CAMERA_PASS_DEPTH,
      });
    };

    measure();
    read();
    gsap.ticker.add(read);
    // Anything that re-measures the page has moved the anchors with it.
    ScrollTrigger.addEventListener("refresh", measure);

    // A month's copy is sticky for the whole section and then lets go for the
    // last screenful, riding up through the next month's title. Taking it down
    // over that stretch is legibility rather than decoration, so unlike the
    // entrance below it is not behind a reduced-motion query — it is scrubbed,
    // which means it tracks the scroll instead of playing an animation.
    for (const section of sections) {
      const frame = section.querySelector<HTMLElement>("[data-month-copy-frame]");
      if (!frame) continue;
      gsap.to(frame, {
        autoAlpha: 0,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "bottom bottom",
          end: "bottom 55%",
          scrub: true,
        },
      });
    }

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
    // So does a rotation — and with ignoreMobileResize on, a plain resize no
    // longer refreshes, so the one resize that genuinely changes the layout
    // has to say so itself.
    const onOrient = () => ScrollTrigger.refresh();
    window.addEventListener("orientationchange", onOrient);

    return () => {
      gsap.ticker.remove(read);
      ScrollTrigger.removeEventListener("refresh", measure);
      window.removeEventListener("orientationchange", onOrient);
    };
  });

  return null;
}
