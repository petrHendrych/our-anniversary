"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { CameraTilt } from "@/components/canvas/CameraTilt";
import { IntroCamera } from "@/components/canvas/IntroCamera";
import { MonthCard } from "@/components/canvas/MonthCard";
import { MonthDeck } from "@/components/canvas/MonthDeck";
import {
  useActiveMonthIndex,
  useEntered,
  useNearestPhotoIndex,
} from "@/lib/scroll-store";
import { markSceneReady } from "@/lib/preload-store";
import { warmPhoto } from "@/lib/card-texture";
import { openingPalette, paletteFor } from "@/lib/palette";
import { CAMERA_Z, FOG_FAR, FOG_NEAR, runnerPhotos } from "@/lib/runner-layout";

/**
 * Photos kept mounted — and therefore textured — either side of the nearest.
 *
 * AHEAD is the fog rather than a guess: at EVENT_STEP apart, the fourth card
 * ahead is already at FOG_FAR, which is the page's own colour, so a fifth was
 * a print baked, uploaded and drawn to make no difference. SLACK on top of it
 * is the texture lead — those are mounted, and baking, before they are ever
 * anything to look at.
 */
const AHEAD = 4;
const BEHIND = 2;
/**
 * How far the nearest card may move before the mount window is recut.
 *
 * Without this the window slid by one on every index change, and a fast flick
 * changes the nearest card several times a second: React re-rendered, meshes
 * unmounted and remounted, and prints were released and re-acquired while the
 * reader was still moving. The window is deliberately wider than it needs to
 * be, so it can be recut in steps and still always contain everything visible.
 */
const SLACK = 2;

/**
 * Covers whose *bytes* are fetched past each end of the mount window.
 *
 * A warm is a fetch and nothing else — no decode, no canvas, no texture — so
 * it is cheap enough to reach further than the mount window ever should, and
 * it is the only part of a bake that has to wait on a network. See warmPhoto.
 * TRAIL is small because a reader who turns round is already looking at cards
 * whose prints are still in the retained cache.
 */
const LEAD = 5;
const TRAIL = 2;

/**
 * Fog is the page's own background colour, so a photo in the distance dissolves
 * into the page instead of into a grey that does not belong to it. It follows
 * the month palette, crossfading at roughly the same rate the DOM does.
 *
 * The same colour is the canvas's clear colour, which is why the canvas can be
 * opaque: nothing on the page sits behind it, and an opaque canvas spares the
 * compositor a full-screen alpha blend of every frame against the document —
 * which on a phone, at dpr 2, is the single largest thing it was being asked
 * to do outside the scene itself.
 */
function SceneColour() {
  const activeIndex = useActiveMonthIndex();
  const gl = useThree((state) => state.gl);
  const fog = useRef<THREE.Fog>(null);
  const target = useMemo(() => new THREE.Color(paletteFor(activeIndex).bg), [activeIndex]);

  useFrame((_, delta) => {
    if (!fog.current) return;
    fog.current.color.lerp(target, 1 - Math.exp(-3 * delta));
    gl.setClearColor(fog.current.color, 1);
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
  // The window only moves when the nearest card has left the middle of it, so
  // scrolling fast costs a recut every few cards rather than one per card.
  const [range, setWindow] = useState(() => cut(nearest));
  // Recut only once the window no longer covers everything it has to — the ends
  // of the run are already at the edge of the list and cannot be moved further.
  if (
    (range.from > 0 && nearest < range.from + BEHIND) ||
    (range.to < runnerPhotos.length && nearest > range.to - AHEAD - 1)
  ) {
    setWindow(cut(nearest));
  }

  // Fetch the covers just past each end of the window, so the bake queue never
  // waits on a network. Forward first: that is where the reader is going, and
  // the order these are called in is the order the requests go out.
  useEffect(() => {
    if (!entered) return;
    for (let i = range.to; i < Math.min(runnerPhotos.length, range.to + LEAD); i++) {
      warmPhoto(runnerPhotos[i].src);
    }
    for (let i = Math.max(0, range.from - TRAIL); i < range.from; i++) {
      warmPhoto(runnerPhotos[i].src);
    }
  }, [entered, range]);

  // No month exists until the reader is through the lens.
  if (!entered) return null;

  return runnerPhotos
    .slice(range.from, range.to)
    .map((photo) => <MonthCard key={photo.key} photo={photo} />);
}

function cut(nearest: number) {
  return {
    from: Math.max(0, nearest - BEHIND - SLACK),
    to: Math.min(runnerPhotos.length, nearest + AHEAD + SLACK + 1),
  };
}

export function MonthRunnerScene() {
  return (
    // Pointer events stay on so photos can be tapped; the DOM text layer above
    // is pointer-events-none so taps reach them.
    <div className="fixed inset-0 z-0">
      <Canvas
        // 2x is plenty on a phone; 3x triples fill cost for nothing visible.
        dpr={[1, 2]}
        gl={{
          // Nothing in this scene has an edge that multisampling would help:
          // every card is a quad whose outline is the transparent margin of
          // its own texture. It was costing a 4x resolve on every frame of a
          // full-screen buffer for a difference no reader could point at.
          antialias: false,
          // Opaque, with the clear colour tracking the fog — see SceneColour.
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={(state) => {
          // The renderer's own default clear colour is black, and with an
          // opaque canvas that is what the first frame would be cleared to.
          state.gl.setClearColor(openingPalette.bg, 1);
          // The loading gate waits on this: no point opening the page before
          // the scene it is hiding actually exists.
          markSceneReady();
        }}
      >
        {/* Photos surface out of the page colour instead of popping in. */}
        <SceneColour />
        <PixelCamera />
        <CameraTilt />
        <IntroCamera />
        <Photos />
        <MonthDeck />
      </Canvas>
    </div>
  );
}
