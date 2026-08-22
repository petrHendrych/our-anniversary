"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "lenis/react";
import type { Month } from "@/data/timeline";
import { PhotoGrid } from "@/components/drawer/PhotoGrid";
import {
  collapseMonth,
  expandedState,
  useExpandedMonthId,
  type CardRect,
} from "@/lib/expanded-store";
import { getMonth } from "@/lib/timeline";

/** Matches vaul's own open/close curve so the two arrivals agree. */
const FLIGHT = { duration: 0.5, ease: [0.32, 0.72, 0, 1] } as const;
/** If vaul's animation callback never lands, hand off anyway. */
const HANDOFF_FALLBACK_MS = 900;

/**
 * Reads an element's rect as if the drawer were already settled.
 *
 * The header image lives inside a sheet that is still sliding up when we need
 * to know where the flight should end, so its live rect is a moving target.
 * Subtracting the sheet's current transform gives the resting position without
 * having to duplicate the sheet's geometry in JS.
 */
function settledRect(element: HTMLElement, sheet: HTMLElement): CardRect {
  const rect = element.getBoundingClientRect();
  const transform = getComputedStyle(sheet).transform;
  const matrix =
    transform === "none"
      ? new DOMMatrixReadOnly()
      : new DOMMatrixReadOnly(transform);
  return {
    left: rect.left - matrix.m41,
    top: rect.top - matrix.m42,
    width: rect.width,
    height: rect.height,
  };
}

export function MonthDrawer() {
  const expandedId = useExpandedMonthId();
  const lenis = useLenis();

  const [open, setOpen] = useState(false);
  // The month outlives `expandedId` so the sheet has something to render while
  // it animates closed.
  const [displayed, setDisplayed] = useState<Month | null>(null);
  const [origin, setOrigin] = useState<CardRect | null>(null);
  const [target, setTarget] = useState<CardRect | null>(null);
  const [landed, setLanded] = useState(false);
  const [settled, setSettled] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // The flight overlay covers the header image until both the flight and the
  // sheet have finished; swapping earlier shows the header mid-slide.
  const handedOff = landed && settled;
  const flying = Boolean(origin) && !handedOff;

  // Adjusting state during render rather than in an effect: this is a
  // derivation from the store, not a synchronisation with an outside system,
  // and doing it here avoids a wasted pass where the sheet is open but empty.
  const [syncedId, setSyncedId] = useState<string | null>(null);
  if (expandedId !== syncedId) {
    setSyncedId(expandedId);
    if (expandedId) {
      setDisplayed(getMonth(expandedId));
      setOrigin(expandedState.rect);
      setTarget(null);
      setLanded(false);
      setSettled(false);
      setOpen(true);
    }
  }

  // Measure the flight's destination once the sheet exists in the DOM.
  useEffect(() => {
    if (!open || !displayed) return;
    const frame = requestAnimationFrame(() => {
      if (headerRef.current && sheetRef.current) {
        setTarget(settledRect(headerRef.current, sheetRef.current));
      }
    });
    const fallback = window.setTimeout(() => {
      setLanded(true);
      setSettled(true);
    }, HANDOFF_FALLBACK_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [open, displayed]);

  // Pause the page underneath, and pick it up exactly where it was on close.
  useEffect(() => {
    if (!lenis) return;
    if (open) lenis.stop();
    else lenis.start();
    return () => lenis.start();
  }, [lenis, open]);

  function handleAnimationEnd(isOpen: boolean) {
    if (isOpen) {
      setSettled(true);
      return;
    }
    // Only now release the 3D card — it sits behind the sheet until it is gone.
    collapseMonth();
    setDisplayed(null);
    setOrigin(null);
    setTarget(null);
    setLanded(false);
    setSettled(false);
  }

  const meta = displayed
    ? [displayed.date, displayed.location].filter(Boolean).join(" · ")
    : "";

  return (
    <>
      <Drawer.Root
        open={open}
        onOpenChange={setOpen}
        onAnimationEnd={handleAnimationEnd}
        repositionInputs={false}
      >
        {displayed && (
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-40 bg-black/75" />
            <Drawer.Content
              ref={sheetRef}
              className="fixed inset-x-0 bottom-0 top-[4svh] z-50 flex flex-col overflow-hidden rounded-t-[20px] bg-ink-raised outline-none"
            >
              <div className="relative shrink-0">
                <div
                  ref={headerRef}
                  className="aspect-square w-full overflow-hidden"
                  style={{ opacity: handedOff ? 1 : 0 }}
                >
                  {/* Raw <img> on purpose: the browser already has this exact
                      file decoded from the WebGL texture load, so it paints
                      instantly. next/image would request a different,
                      optimised URL and flash. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayed.coverImage}
                    alt={displayed.title}
                    className="h-full w-full object-cover"
                  />
                </div>

                <Drawer.Handle className="absolute left-1/2 top-3 !w-12 -translate-x-1/2 !bg-bone/50" />

                <Drawer.Close
                  className="eyebrow absolute right-4 top-4 rounded-full bg-ink/70 px-3 py-2 text-bone/80 backdrop-blur"
                  aria-label="Close"
                >
                  Close
                </Drawer.Close>
              </div>

              <div
                // Lenis intercepts touch globally while syncTouch is on; this
                // opts the drawer's own scrolling back out to the browser.
                data-lenis-prevent
                className="flex-1 overflow-y-auto px-5 pb-16 pt-6"
              >
                <p className="eyebrow text-dim">
                  {displayed.monthLabel} {displayed.year}
                </p>
                <Drawer.Title className="display mt-2 text-[2rem]">
                  {displayed.title}
                </Drawer.Title>
                <Drawer.Description className="mt-3 text-[0.9375rem] leading-6 text-dim">
                  {displayed.summary}
                </Drawer.Description>
                {meta && <p className="eyebrow mt-4 text-bone/40">{meta}</p>}

                {displayed.notes && (
                  <p className="mt-8 border-t border-line pt-8 text-[0.9375rem] leading-7">
                    {displayed.notes}
                  </p>
                )}

                <div className="mt-8">
                  <PhotoGrid photos={displayed.gallery} />
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        )}
      </Drawer.Root>

      <AnimatePresence>
        {flying && origin && displayed && (
          <motion.div
            key={displayed.id}
            className="pointer-events-none fixed z-[60] overflow-hidden"
            initial={{
              left: origin.left,
              top: origin.top,
              width: origin.width,
              height: origin.height,
            }}
            animate={{
              left: (target ?? origin).left,
              top: (target ?? origin).top,
              width: (target ?? origin).width,
              height: (target ?? origin).height,
            }}
            exit={{ opacity: 0 }}
            transition={FLIGHT}
            onAnimationComplete={() => {
              if (target) setLanded(true);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayed.coverImage}
              alt=""
              className="h-full w-full object-cover"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
