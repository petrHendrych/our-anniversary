"use client";

import "lenis/dist/lenis.css";

import { useEffect } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// A phone fires `resize` every time the URL bar slides in or out. Sections are
// sized in svh, which deliberately does not change with it, so those resizes
// have nothing to say — and letting them refresh every trigger mid-scroll
// re-measures the whole page while the reader is moving through it.
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * Hands scroll timing to a single loop: GSAP's ticker drives Lenis, Lenis
 * drives real page scroll, and ScrollTrigger is read off the result. Two rAF
 * loops racing each other is exactly the drift bug REQUIREMENTS.md warns
 * about, so `autoRaf` is off and gsap.ticker owns it.
 *
 * ScrollTrigger is updated from the ticker rather than from Lenis's `scroll`
 * event, which is the arrangement most write-ups suggest. The difference only
 * shows on a phone: `scroll` fires when *Lenis* moves the page, and there are
 * ways for a touch device to scroll without Lenis having done it — Lenis is
 * stopped, a gesture it declined to take, an in-app browser handling the drag
 * itself. When that happens the page moves, the sticky month copy moves with
 * it because that is pure CSS, and nothing scroll-linked moves at all: the run
 * freezes with the intro camera still sitting in front of the reader. Reading
 * the scroll position every frame cannot get into that state, and costs one
 * cheap call per frame.
 */
function LenisGsapBridge() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    const frame = (time: number) => {
      lenis.raf(time * 1000); // gsap ticker is in seconds
      ScrollTrigger.update();
    };

    gsap.ticker.add(frame);
    // Lag smoothing skips frames to "catch up" after a stall; with scroll-linked
    // 3D that reads as a jump, so it stays off.
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(frame);
      gsap.ticker.lagSmoothing(500, 33);
    };
  }, [lenis]);

  return null;
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        autoRaf: false,
        lerp: 0.1,
        // Without syncTouch, Lenis does nothing on a touch device — and this
        // site is only ever opened on phones. It is on so the runner tracks
        // the finger through one smoothed value instead of raw momentum.
        syncTouch: true,
        // Was 0.08, which is a lot of smoothing to put between a finger and
        // the run: a fast flick moved the target most of a month away and the
        // scene then crawled after it, which reads as lag rather than as
        // smoothness. Enough to take the steps out of a touch scroll, not
        // enough to feel detached from the finger.
        syncTouchLerp: 0.12,
        touchInertiaExponent: 1.7,
      }}
    >
      <LenisGsapBridge />
      {children}
    </ReactLenis>
  );
}
