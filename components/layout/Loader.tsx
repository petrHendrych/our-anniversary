"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import {
  beginPreload,
  enterSite,
  preloadState,
  useHasEntered,
} from "@/lib/preload-store";
import { gyroNeedsPermission, requestGyro } from "@/lib/tilt";
import { monthCount, rangeLabel } from "@/lib/timeline";

/** How fast the shown number chases the real one. Higher is snappier. */
const CHASE = 2.4;

/**
 * The gate the page opens behind.
 *
 * The number is not a re-render — it is written straight to its own text node
 * from a gsap.ticker callback, the same trick ProgressHeader and the flying
 * titles use. A counter that ticked through React would re-render this
 * component sixty times a second for the sake of two digits.
 *
 * It chases the true figure rather than snapping to it, so the count always
 * climbs smoothly even though the work behind it lands in lumps, and it holds
 * at 99 until everything is genuinely done — a loader that shows 100 and then
 * keeps you waiting is worse than one that never got there.
 */
export function Loader() {
  const entered = useHasEntered();
  const lenis = useLenis();
  // globals.css flattens CSS transitions for reduced motion, but a JS-driven
  // loop like the breathing ring has to opt out for itself.
  const reduce = useReducedMotion();
  const count = useRef<HTMLSpanElement>(null);
  const rule = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  // Not the same thing as `ready`: the counter eases towards the truth, so the
  // work can be finished a beat before the line has visibly filled. The way in
  // only appears once the reader has seen it reach the end.
  const [arrived, setArrived] = useState(false);
  const announced = useRef(false);

  useEffect(() => beginPreload(), []);

  // Nothing moves behind the gate, and a reload starts at the top rather than
  // wherever the browser remembers.
  useEffect(() => {
    if (entered) return;
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, [entered]);

  useEffect(() => {
    if (!lenis) return;
    if (entered) lenis.start();
    else lenis.stop();
  }, [lenis, entered]);

  useEffect(() => {
    if (entered) return;

    const tick = (_time: number, delta: number) => {
      const target = preloadState.done / preloadState.total;
      const k = 1 - Math.exp((-CHASE * delta) / 1000);
      shown.current += (target - shown.current) * k;
      if (preloadState.ready && shown.current > 0.995) {
        shown.current = 1;
        // Once, not on every frame from here to the tap.
        if (!announced.current) {
          announced.current = true;
          setArrived(true);
        }
      }

      const percent = Math.min(
        preloadState.ready ? 100 : 99,
        Math.floor(shown.current * 100),
      );
      if (count.current) count.current.textContent = String(percent);
      if (rule.current)
        rule.current.style.transform = `scaleX(${shown.current})`;
    };

    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [entered]);

  async function handleEnter() {
    // iOS hands out device orientation only from inside a tap, and this is the
    // only tap the page is guaranteed to get.
    if (gyroNeedsPermission()) await requestGyro();
    enterSite();
  }

  return (
    <AnimatePresence>
      {!entered && (
        <motion.div
          // The title is deliberately huge and unclamped, so on a short or very
          // wide viewport it can outgrow the gate. Scrolling is the safety net:
          // it never engages on a phone, and it means the way in can never end
          // up clipped off the bottom. Lenis is stopped but still listening, so
          // it has to be told to keep its hands off this one.
          data-lenis-prevent
          className="fixed inset-0 z-[100] flex flex-col justify-between overflow-y-auto overscroll-contain bg-ink px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-16"
          // Lifted away like a curtain rather than dissolved: the gate is a
          // screen in front of the scene, and pulling it up is what puts the
          // reader behind it.
          initial={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.95, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="flex flex-1 flex-col justify-center text-center">
            {/* The eyebrow's own letter-spacing hangs off its last letter, so
                a centred line sits a hair left of true. The indent puts it back. */}
            <p className="eyebrow text-dim [text-indent:0.22em]">
              {rangeLabel}
            </p>
            <h1 className="display mt-4 text-[22vw] text-bone">Two years</h1>
          </div>

          <div className="flex flex-col gap-5">
            {/* Both sit on the loading line: the copy at the left margin, the
                way in at the right-hand end of it. The circle's place is held
                whether or not it is filled, so the copy never reflows — it
                rises into a space already made for it. */}
            <div className="flex items-end justify-between gap-5">
              <p className="max-w-[22rem] text-[0.9375rem] leading-6 text-dim">
                {monthCount} months we wrote down, in the order they happened.
                Give it a moment to gather them up.
              </p>

              <div className="h-20 w-20 shrink-0">
                <AnimatePresence>
                  {arrived && (
                    <motion.button
                      type="button"
                      onClick={handleEnter}
                      aria-label="Enter"
                      initial={{ opacity: 0, y: 26 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.65,
                        ease: [0.22, 0.61, 0.36, 1],
                      }}
                      className="relative cursor-pointer flex h-20 w-20 items-center justify-center rounded-full border border-lit text-lit"
                    >
                      {/* Barely-there breathing, so it still reads as waiting for
                        a tap a minute after it arrived. */}
                      {!reduce && (
                        <motion.span
                          aria-hidden
                          className="absolute inset-0 rounded-full border border-lit"
                          animate={{ opacity: [0, 0.7, 0] }}
                          transition={{
                            duration: 3.2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                      )}
                      <span className="eyebrow [text-indent:0.22em]">
                        Enter
                      </span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <span className="block h-px w-full overflow-hidden bg-line">
              <span
                ref={rule}
                className="block h-px w-full origin-left bg-bone"
                style={{ transform: "scaleX(0)" }}
              />
            </span>

            <span className="eyebrow text-dim">
              <span ref={count}>0</span>%
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
