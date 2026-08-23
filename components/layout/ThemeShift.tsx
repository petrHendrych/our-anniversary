"use client";

import { useEffect } from "react";
import { useActiveMonthIndex } from "@/lib/scroll-store";
import { paletteFor } from "@/lib/palette";

/**
 * Repaints the page in the current month's pastel.
 *
 * All it does is write the four colour variables onto <html>; the crossfade
 * itself is a CSS transition on those custom properties (see globals.css), so
 * every element that reads them — copy, spine, gradient scrim — moves together
 * with no JS per frame. The WebGL fog is tweened separately in the scene, at a
 * matching duration.
 */
export function ThemeShift() {
  const activeIndex = useActiveMonthIndex();

  useEffect(() => {
    const palette = paletteFor(activeIndex);
    const root = document.documentElement;
    root.style.setProperty("--ink", palette.bg);
    root.style.setProperty("--bone", palette.text);
    root.style.setProperty("--dim", palette.dim);
    root.style.setProperty("--lit", palette.lit);
  }, [activeIndex]);

  return null;
}
