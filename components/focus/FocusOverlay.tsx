"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "lenis/react";
import { PhotoSlideshow } from "@/components/gallery/PhotoSlideshow";
import { FOCUS_GAP } from "@/lib/focus-layout";
import {
  closeSlideshow,
  focusState,
  openSlideshow,
  releaseFocus,
  useFocusBottom,
  useFocusLanded,
  useFocusedMonthId,
  useSlideshowOpen,
} from "@/lib/focus-store";
import { getMonth } from "@/lib/timeline";
import { suspendTilt } from "@/lib/tilt";

const longDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Everything that belongs to an open card except the card itself.
 *
 * The card stays a mesh in the scene — it flies out of the run and holds
 * itself in front of the reader — and this is the layer of real text that
 * arrives underneath it once it has landed. It sits where the card publishes
 * its own resting edge (see lib/focus-store), so nothing here has to project
 * the mesh frame by frame.
 *
 * The page's text layer is pointer-events-none so that taps reach the cards.
 * This layer turns them back on, which is also what makes tapping anywhere
 * outside the card close it.
 */
export function FocusOverlay() {
  const monthId = useFocusedMonthId();
  const landed = useFocusLanded();
  const bottom = useFocusBottom();
  const slideshow = useSlideshowOpen();
  const lenis = useLenis();
  const [viewport, setViewport] = useState(0);

  useEffect(() => {
    const measure = () => setViewport(window.innerHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Pause the page underneath, and pick it up exactly where it was on close.
  useEffect(() => {
    if (!lenis) return;
    if (monthId) lenis.stop();
    else lenis.start();
    return () => lenis.start();
  }, [lenis, monthId]);

  // A card lands on the camera axis, so the camera has to stop leaning first.
  useEffect(() => {
    suspendTilt(Boolean(monthId));
  }, [monthId]);

  // The month copy, the flying titles and the header all belong to the run,
  // not to the card that has been lifted out of it.
  useEffect(() => {
    const root = document.documentElement;
    if (monthId) root.dataset.focused = "";
    else delete root.dataset.focused;
    return () => {
      delete root.dataset.focused;
    };
  }, [monthId]);

  useEffect(() => {
    if (!monthId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (focusState.slideshow) closeSlideshow();
      else releaseFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [monthId]);

  if (!monthId) return null;

  const month = getMonth(monthId);
  const meta = [
    month.date ? longDate.format(new Date(month.date)) : null,
    month.location,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div
        // Transparent on purpose: the run dims in WebGL, where the open card
        // can be left out of it. A DOM scrim would darken the print too.
        // Taps only count once the card has landed, so a second tap during the
        // flight out cannot immediately close it again.
        className="fixed inset-0 z-40"
        style={{ pointerEvents: landed ? "auto" : "none" }}
        onClick={() => releaseFocus()}
      >
        <motion.div
          className="absolute inset-x-0 px-7 text-center"
          // In landscape the print can reach far enough down that the copy
          // would start below the fold; it stops short instead and overlaps.
          style={{ top: Math.min(bottom + FOCUS_GAP, Math.max(0, viewport - 220)) }}
          initial={{ opacity: 0, y: 8 }}
          animate={landed ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          // The copy belongs to the card; a tap on it should not close it.
          onClick={(event) => event.stopPropagation()}
        >
          {meta && <p className="eyebrow text-dim">{meta}</p>}
          <p className="display mt-2 text-[1.6rem] text-bone">{month.summary}</p>
          {month.notes && (
            <p className="mx-auto mt-3 max-w-[34ch] text-[0.875rem] leading-6 text-dim line-clamp-4">
              {month.notes}
            </p>
          )}
          {month.gallery.length > 0 && (
            <button
              type="button"
              onClick={() => openSlideshow()}
              className="eyebrow mt-6 rounded-full border border-line bg-ink-raised px-6 py-3 text-bone"
            >
              Show more
            </button>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {slideshow && (
          <PhotoSlideshow
            key={month.id}
            month={month}
            startSrc={focusState.key}
            onClose={() => closeSlideshow()}
          />
        )}
      </AnimatePresence>
    </>
  );
}
