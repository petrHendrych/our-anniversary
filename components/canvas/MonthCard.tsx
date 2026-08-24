"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll-store";
import { focusCard, focusState } from "@/lib/focus-store";
import { FOCUS_DISTANCE, focusPose } from "@/lib/focus-layout";
import {
  CAMERA_Z,
  gateOpacity,
  holdScale,
  passOpacity,
  PASS_NEAR,
  photosForEvent,
  planeScale,
  spreadScale,
  type RunnerPhoto,
} from "@/lib/runner-layout";
import { acquireCardTexture, releaseCardTexture } from "@/lib/card-texture";

/** Only a photo this near the camera plane answers a tap. */
const TAP_RANGE = 700;
/** How far the rest of the run dims and falls back while a deck is open. */
const DIM = 0.72;
const RECEDE = 140;

/** Per-frame scratch — module-level so a card allocates nothing while flying. */
const FORWARD = new THREE.Vector3(0, 0, 1);
const rest = new THREE.Vector3();
const target = new THREE.Vector3();
const forward = new THREE.Vector3();
const up = new THREE.Vector3();
const camQ = new THREE.Quaternion();
const restQ = new THREE.Quaternion();

/**
 * One photograph as a printed card, in the run.
 *
 * The card reads `scrollState.depth` straight out of the store inside
 * useFrame — no React state, no re-renders while scrolling. Its Z is simply
 * `depth - photo.depth`: negative while the photo is still ahead in the haze,
 * zero as it passes the Z=0 plane, and on up to CAMERA_Z as it reaches the
 * reader. It is drawn the whole way, fading only as it crosses the camera.
 * Position, rotation and scale are all written per frame rather than passed as
 * props, so a React re-render can never fight the loop.
 *
 * Distance fade is the scene's fog, not per-card opacity, so photos surface
 * out of the background colour instead of cross-dissolving over it.
 *
 * One card is one event. Tapping it flies it out of the run and holds it in
 * front of the reader — and that flight is this card's own, not the deck's.
 * Only once it has landed does MonthDeck take over, at the identical pose, to
 * fan out that event's own photographs behind it. Those pictures are nowhere
 * in the run: the next card along is a different event entirely.
 */
export function MonthCard({ photo }: { photo: RunnerPhoto }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const pointerDown = useRef<{ x: number; y: number; time: number } | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  const scale = planeScale(size.width);
  const spread = spreadScale(size.width);
  // Planes are unit-sized and scaled, so one geometry serves every card.
  const image = texture?.image as { width: number; height: number } | undefined;
  const longest = image ? Math.max(image.width, image.height) : 1;
  const width = image ? (photo.size * image.width) / longest : 0;
  const height = image ? (photo.size * image.height) / longest : 0;

  useEffect(() => {
    let alive = true;
    acquireCardTexture(photo.src, photo.caption)
      .then((loaded) => {
        if (alive) setTexture(loaded);
      })
      // A photograph that will not load leaves a gap in the run, which is
      // better than an unhandled rejection taking the page with it.
      .catch(() => {});
    return () => {
      alive = false;
      releaseCardTexture(photo.src, photo.caption);
    };
  }, [photo.src, photo.caption]);

  useFrame(() => {
    const node = mesh.current;
    const surface = material.current;
    if (!node || !surface) return;

    const runZ = scrollState.depth - photo.depth;
    const distance = CAMERA_Z - runZ;
    const gate = gateOpacity(scrollState.depth) * passOpacity(distance);
    const w = width * scale;
    const h = height * scale;
    // This card flies only until the deck takes over; from then on the deck
    // draws this event's photographs, its own copy of this one included.
    const t =
      focusState.key === photo.key && !focusState.handed ? focusState.t : 0;

    // The held part of the offset grows with distance so that it holds a fixed
    // place on screen; the rest is a plain world offset that sweeps outward as
    // the photo arrives. See lib/runner-layout.
    const k = holdScale(runZ);
    rest.set(
      (photo.holdX * k + photo.x) * spread,
      (photo.holdY * k + photo.y) * spread,
      runZ,
    );

    if (t === 0) {
      // Whatever is open takes the run's attention with it: the rest of the
      // photographs fall back into the haze and dim, rather than the open card
      // having to be lit against them.
      const away = focusState.eventId ? focusState.t : 0;
      node.position.copy(rest);
      node.position.z -= RECEDE * away;
      node.rotation.z = photo.roll;
      node.scale.set(w, h, 1);
      node.visible =
        // Drawn all the way in: a photo is only gone once it has crossed the
        // camera, not while it is still large and mid-screen.
        distance > PASS_NEAR &&
        // Once handed over, the deck holds this event's own copy of it. Only
        // this card steps aside — the rest of the run stays out there, dimmed.
        !(focusState.handed && focusState.eventId === photo.eventId);
      if (node.renderOrder !== 0) {
        node.renderOrder = 0;
        surface.depthTest = true;
      }
      // Fog handles distance; this only covers the first moments past the lens,
      // where the run is being revealed rather than flown through.
      surface.opacity = gate * (1 - DIM * away);
      return;
    }

    // Placed in camera space — a fixed distance down the camera's own axis,
    // turned to face it — so it lands centred and square however the camera has
    // been left leaning. See lib/focus-layout.
    camera.getWorldQuaternion(camQ);
    forward.set(0, 0, -1).applyQuaternion(camQ);
    up.set(0, 1, 0).applyQuaternion(camQ);

    const pose = focusPose(size.width, size.height, w, h);
    target
      .copy(camera.position)
      .addScaledVector(forward, FOCUS_DISTANCE)
      .addScaledVector(up, pose.rise);

    node.position.lerpVectors(rest, target, t);
    restQ.setFromAxisAngle(FORWARD, photo.roll);
    node.quaternion.slerpQuaternions(restQ, camQ, t);
    const grown = 1 + (pose.zoom - 1) * t;
    node.scale.set(w * grown, h * grown, 1);
    // The open card is never culled and never dimmed by the gate.
    node.visible = true;
    node.renderOrder = 1;
    surface.depthTest = false;
    surface.opacity = gate + (1 - gate) * t;
  });

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    pointerDown.current = {
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
    };
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    const start = pointerDown.current;
    pointerDown.current = null;
    if (!start || !mesh.current) return;
    // One deck at a time; while one is open, a tap out here closes it instead.
    if (focusState.eventId) return;

    // A drag that happened to start on a photo is a scroll, not a tap.
    const travel = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (travel > 10 || event.timeStamp - start.time > 500) return;
    // Only a photo the reader is actually looking at opens.
    if (Math.abs(scrollState.depth - photo.depth) > TAP_RANGE) return;

    event.stopPropagation();
    focusCard(
      photo.key,
      photo.eventId,
      photo.monthId,
      photosForEvent(photo.eventId).length,
    );
  }

  if (!texture || !image) return null;

  return (
    <mesh
      ref={mesh}
      visible={false}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={material}
        map={texture}
        transparent
        // Photos overlap as they pass; letting them write depth would punch
        // holes in whatever is behind them.
        depthWrite={false}
        toneMapped={false}
        // Fog is what makes them emerge from the distance.
        fog
      />
    </mesh>
  );
}
