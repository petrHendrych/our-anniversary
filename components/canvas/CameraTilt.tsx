"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { startTilt, tiltCurrent, tiltTarget } from "@/lib/tilt";

/**
 * Eases the camera towards the tilt target every frame.
 *
 * Panning is navigation now, not decoration — the photographs are spread wider
 * than the screen — so it follows a little more eagerly than the reference's
 * four-second drift, while still coasting after the reader stops.
 *
 * Deliberately slow to follow: the reference site tweens this over seconds, and
 * the laziness is the effect — the scene keeps drifting for a moment after the
 * reader stops moving, which is what sells the depth.
 */
const FOLLOW = 2.6;

export function CameraTilt() {
  useEffect(() => startTilt(), []);

  useFrame((state, delta) => {
    // Frame-rate independent easing: same settle time at 60 and 120Hz.
    const k = 1 - Math.exp(-FOLLOW * delta);
    state.camera.rotation.x += (tiltTarget.x - state.camera.rotation.x) * k;
    state.camera.rotation.y += (tiltTarget.y - state.camera.rotation.y) * k;
    tiltCurrent.x = state.camera.rotation.x;
    tiltCurrent.y = state.camera.rotation.y;
  });

  return null;
}
