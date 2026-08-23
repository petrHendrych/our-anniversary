"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { CameraTilt } from "@/components/canvas/CameraTilt";
import { IntroCamera } from "@/components/canvas/IntroCamera";
import { MonthCard } from "@/components/canvas/MonthCard";
import {
  useActiveMonthIndex,
  useEntered,
  useNearestPhotoIndex,
} from "@/lib/scroll-store";
import { useSlideshowOpen } from "@/lib/focus-store";
import { openingPalette, paletteFor } from "@/lib/palette";
import { CAMERA_Z, FOG_FAR, FOG_NEAR, runnerPhotos } from "@/lib/runner-layout";

/** Photos kept mounted — and therefore textured — either side of the nearest one. */
const AHEAD = 5;
const BEHIND = 2;

/**
 * Fog is the page's own background colour, so a photo in the distance dissolves
 * into the page instead of into a grey that does not belong to it. It follows
 * the month palette, crossfading at roughly the same rate the DOM does.
 */
function MonthFog() {
  const activeIndex = useActiveMonthIndex();
  const fog = useRef<THREE.Fog>(null);
  const target = useMemo(() => new THREE.Color(paletteFor(activeIndex).bg), [activeIndex]);

  useFrame((_, delta) => {
    if (fog.current) fog.current.color.lerp(target, 1 - Math.exp(-3 * delta));
  });

  return <fog ref={fog} attach="fog" args={[openingPalette.bg, FOG_NEAR, FOG_FAR]} />;
}

/**
 * Puts the camera where one world unit is one CSS pixel at the Z=0 plane, so
 * every layout constant in lib/runner-layout reads as a pixel measurement, and
 * a photo authored at 760px is 760px tall as it passes.
 */
function PixelCamera() {
  const height = useThree((state) => state.size.height);
  const fov = (180 * (2 * Math.atan(height / 2 / CAMERA_Z))) / Math.PI;

  return (
    <PerspectiveCamera
      makeDefault
      fov={fov}
      position={[0, 0, CAMERA_Z]}
      near={1}
      far={FOG_FAR}
    />
  );
}

function Photos() {
  const entered = useEntered();
  const nearest = useNearestPhotoIndex();

  // No month exists until the reader is through the lens.
  if (!entered) return null;

  const from = Math.max(0, nearest - BEHIND);
  const to = Math.min(runnerPhotos.length, nearest + AHEAD + 1);

  return runnerPhotos
    .slice(from, to)
    .map((photo) => <MonthCard key={photo.key} photo={photo} />);
}

/**
 * Stops the render loop while the slideshow is up.
 *
 * Nothing in the scene is moving by then — scroll is stopped and the open card
 * has landed — and the phone is busy decoding full-screen photographs, which is
 * exactly the budget the texture window exists to protect. Done from inside the
 * Canvas rather than through its `frameloop` prop so the whole scene does not
 * re-render, and by pausing rather than unmounting so no texture is disposed
 * and re-baked on the way back.
 */
function FrameloopGate() {
  const setFrameloop = useThree((state) => state.setFrameloop);
  const paused = useSlideshowOpen();

  useEffect(() => {
    setFrameloop(paused ? "never" : "always");
  }, [paused, setFrameloop]);

  return null;
}

export function MonthRunnerScene() {
  return (
    // Pointer events stay on so photos can be tapped; the DOM text layer above
    // is pointer-events-none so taps reach them.
    <div className="fixed inset-0 z-0">
      <Canvas
        // 2x is plenty on a phone; 3x triples fill cost for nothing visible.
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Photos surface out of the page colour instead of popping in. */}
        <MonthFog />
        <FrameloopGate />
        <PixelCamera />
        <CameraTilt />
        <IntroCamera />
        <Photos />
      </Canvas>
    </div>
  );
}
