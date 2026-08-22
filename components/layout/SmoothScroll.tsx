"use client";

import "lenis/dist/lenis.css";

import { useEffect } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Hands scroll timing to a single loop: GSAP's ticker drives Lenis, Lenis
 * drives real page scroll, and every Lenis scroll event refreshes
 * ScrollTrigger. Two rAF loops racing each other is exactly the drift bug
 * REQUIREMENTS.md warns about, so `autoRaf` is off and gsap.ticker owns it.
 */
function LenisGsapBridge() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    const update = () => ScrollTrigger.update();
    const raf = (time: number) => lenis.raf(time * 1000); // gsap ticker is in seconds

    lenis.on("scroll", update);
    gsap.ticker.add(raf);
    // Lag smoothing skips frames to "catch up" after a stall; with scroll-linked
    // 3D that reads as a jump, so it stays off.
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", update);
      gsap.ticker.remove(raf);
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
        syncTouchLerp: 0.08,
        touchInertiaExponent: 1.7,
      }}
    >
      <LenisGsapBridge />
      {children}
    </ReactLenis>
  );
}
