"use client";

import { useEffect } from "react";
import { useLenis } from "lenis/react";
import { releaseFocus, useFocusedMonthId } from "@/lib/focus-store";
import { suspendTilt } from "@/lib/tilt";

/**
 * What has to be true of the page while a deck is open.
 *
 * It draws nothing — the deck is entirely in the scene now, captions and all.
 * This is only the housekeeping around it: the page underneath stops, the
 * camera stops leaning, and the run's own text stands down.
 */
export function FocusMode() {
  const monthId = useFocusedMonthId();
  const lenis = useLenis();

  // Pause the page underneath, and pick it up exactly where it was on close.
  useEffect(() => {
    if (!lenis) return;
    if (monthId) lenis.stop();
    else lenis.start();
    return () => lenis.start();
  }, [lenis, monthId]);

  // A deck is placed on the camera axis, so the camera holds still while it
  // is up — and re-levels to however the phone is being held on the way out.
  useEffect(() => {
    suspendTilt(Boolean(monthId));
  }, [monthId]);

  // The month copy, the flying titles and the header all belong to the run,
  // not to the month that has been lifted out of it.
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
      if (event.key === "Escape") releaseFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [monthId]);

  return null;
}
