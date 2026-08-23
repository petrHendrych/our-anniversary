"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, type PanInfo } from "motion/react";
import type { MemoryPhoto, Month } from "@/data/timeline";

/** Past this much of a swipe, or this fast, the slide changes. */
const TRAVEL = 0.25;
const FLICK = 500;
const SPRING = { type: "spring", stiffness: 320, damping: 38 } as const;

/**
 * The month's photographs, full screen, one swipe apart.
 *
 * Only the current slide and its two neighbours are in the DOM. That is the
 * same discipline the texture window applies in the scene and for the same
 * reason: a seven-photo month should never have seven full-size images decoded
 * at once on a phone.
 *
 * The images are plain <img>, not next/image — every one of these files is
 * already decoded as a card texture, so the browser paints them from cache
 * immediately and there is nothing to fade in over.
 *
 * The track's X is a motion value rather than an `animate` prop: a swipe that
 * does not travel far enough has to spring back to exactly where it started,
 * and that is a case where the index — and so the prop — never changed.
 */
export function PhotoSlideshow({
  month,
  startSrc,
  onClose,
}: {
  month: Month;
  startSrc: string | null;
  onClose: () => void;
}) {
  const slides = useMemo<MemoryPhoto[]>(
    () => [
      { id: `${month.id}-cover`, src: month.coverImage, alt: month.title },
      ...month.gallery,
    ],
    [month],
  );

  const [index, setIndex] = useState(() => {
    const found = slides.findIndex((slide) => slide.src === startSrc);
    return found >= 0 ? found : 0;
  });
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );

  const x = useMotionValue(0);
  // The track animates from an event handler, so the current slide has to be
  // readable outside React's render — and a side effect inside a state updater
  // would run twice under StrictMode.
  const at = useRef(index);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const settle = useCallback(
    (to: number) => {
      animate(x, -to * width, SPRING);
    },
    [x, width],
  );

  // Opening on a photo other than the first should not look like a swipe.
  useEffect(() => {
    x.set(-index * width);
    // Only on mount and on a resize; a step animates itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const step = useCallback(
    (delta: number) => {
      const next = Math.min(slides.length - 1, Math.max(0, at.current + delta));
      at.current = next;
      setIndex(next);
      settle(next);
    },
    [slides.length, settle],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const past = Math.abs(info.offset.x) > width * TRAVEL;
    const flicked = Math.abs(info.velocity.x) > FLICK;
    // Anything short of that and the track springs back to where it was.
    if (past || flicked) step(info.offset.x < 0 ? 1 : -1);
    else settle(at.current);
  }

  const current = slides[index];

  return (
    <motion.div
      // Lenis runs with syncTouch, so it would otherwise swallow the horizontal
      // drag before motion ever sees it.
      data-lenis-prevent
      className="fixed inset-0 z-50 flex flex-col bg-[#17130f] text-[#f2ece3]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="eyebrow opacity-70">
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photos"
          className="-mr-2 flex h-10 w-10 items-center justify-center text-2xl leading-none opacity-70"
        >
          ×
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <motion.div
          className="flex h-full"
          style={{ x, width: width * slides.length }}
          drag="x"
          dragMomentum={false}
          onDragEnd={handleDragEnd}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              className="flex h-full shrink-0 items-center justify-center px-4"
              style={{ width }}
            >
              {Math.abs(i - index) <= 1 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.src}
                  alt={slide.alt}
                  draggable={false}
                  decoding="async"
                  fetchPriority={i === index ? "high" : "low"}
                  className="max-h-full max-w-full select-none object-contain"
                />
              )}
            </div>
          ))}
        </motion.div>
      </div>

      <div className="min-h-[5rem] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-center">
        {current.caption && (
          <p className="text-[0.9375rem] leading-6 opacity-80">{current.caption}</p>
        )}
        {slides.length <= 8 && (
          <div className="mt-3 flex justify-center gap-2">
            {slides.map((slide, i) => (
              <span
                key={slide.id}
                className={`h-1.5 w-1.5 rounded-full bg-current transition-opacity ${
                  i === index ? "opacity-90" : "opacity-30"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
