"use client";

import { useState } from "react";
import { requestGyro, useGyroPending } from "@/lib/tilt";

/**
 * iOS hands out device-orientation events only after an explicit tap, so the
 * tilt-to-look-around effect needs one button behind it. On anything else the
 * gyro is already live and this renders nothing.
 */
export function TiltPrompt() {
  const pending = useGyroPending();
  const [asked, setAsked] = useState(false);

  if (!pending || asked) return null;

  return (
    <button
      type="button"
      className="eyebrow pointer-events-auto self-start border-b border-line pb-1 text-dim"
      onClick={async () => {
        await requestGyro();
        setAsked(true);
      }}
    >
      Tilt to look around
    </button>
  );
}
