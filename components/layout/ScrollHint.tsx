"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePassedCamera } from "@/lib/scroll-store";
import { useHasEntered } from "@/lib/preload-store";

/**
 * The one instruction the page gives.
 *
 * It stays for the whole approach — the gate lifting, the camera coming up out
 * of the fog, the flight into the bore — and goes only once the reader is past
 * it. An earlier version dismissed itself on the first wheel tick, which meant
 * it was gone before the camera had arrived: by the time there was a scene to
 * look at, the hint that got you there had already left.
 */
export function ScrollHint() {
  const started = useHasEntered();
  const passed = usePassedCamera();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {started && !passed && (
        <motion.p
          className="eyebrow pointer-events-none fixed inset-x-0 bottom-[max(2.5rem,env(safe-area-inset-bottom))] z-20 text-center text-dim [text-indent:0.22em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, delay: 0 } }}
          // Waits for the gate to finish lifting rather than riding up with it.
          transition={{ duration: 0.6, delay: 0.9, ease: "easeOut" }}
        >
          <motion.span
            className="inline-block"
            animate={reduce ? undefined : { y: [0, 5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            Scroll
          </motion.span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
