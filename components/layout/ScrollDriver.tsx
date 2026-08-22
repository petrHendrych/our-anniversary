"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setScrollState } from "@/lib/scroll-store";
import { monthCount } from "@/lib/timeline";

// Idempotent, and not safe to rely on another module having run first.
gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The only place scroll position is read.
 *
 * Everything scroll-linked hangs off this: the header bar, the active tick in
 * the spine, the year ghost, and the 3D card transforms — which read `runner`
 * from the store rather than measuring scroll for themselves.
 */
export function ScrollDriver() {
  useGSAP(() => {
    const sections = gsap.utils.toArray<HTMLElement>("[data-month-index]");

    // Scroll offset at which month 0 sits dead centre, and the scroll distance
    // between consecutive months. Re-measured on every ScrollTrigger refresh,
    // since both move with viewport size and font loading.
    let centreOfFirst = 0;
    let monthSpan = 1;

    const measure = () => {
      if (!sections.length) return;
      const top = (el: HTMLElement) =>
        el.getBoundingClientRect().top + window.scrollY;
      centreOfFirst =
        top(sections[0]) + sections[0].offsetHeight / 2 - window.innerHeight / 2;
      monthSpan =
        sections.length > 1 ? top(sections[1]) - top(sections[0]) : sections[0].offsetHeight;
    };

    ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      onRefresh: measure,
      onUpdate: (self) => {
        // Linear in scroll distance and unclamped, so cards are already
        // approaching from the distance while the intro is still on screen.
        const runner = (self.scroll() - centreOfFirst) / monthSpan;
        setScrollState({
          progress: self.progress,
          runner,
          activeIndex: gsap.utils.clamp(0, monthCount - 1, Math.round(runner)),
        });
      },
    });

    // Decorative motion only — skipped wholesale when reduced motion is on.
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      for (const block of gsap.utils.toArray<HTMLElement>("[data-year-block]")) {
        const ghost = block.querySelector("[data-year-ghost]");
        if (!ghost) continue;
        gsap
          .timeline({
            scrollTrigger: {
              trigger: block,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          })
          .fromTo(ghost, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 })
          .to(ghost, { autoAlpha: 1, duration: 0.64 })
          .to(ghost, { autoAlpha: 0, duration: 0.18 });
      }

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
