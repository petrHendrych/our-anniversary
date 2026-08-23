"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll-store";
import { expandMonth, useExpandedMonthId, type CardRect } from "@/lib/expanded-store";
import {
  gateOpacity,
  planeScale,
  spreadScale,
  type RunnerPhoto,
} from "@/lib/runner-layout";
import { acquireTexture, releaseTexture } from "@/lib/texture-window";

/** A photo this far past the camera plane is behind the reader — stop drawing it. */
const PASSED = 240;
/** Only a photo this near the camera plane answers a tap. */
const TAP_RANGE = 700;

const corner = new THREE.Vector3();

/**
 * One photo as a textured plane.
 *
 * The card reads `scrollState.depth` straight out of the store inside
 * useFrame — no React state, no re-renders while scrolling. Its Z is simply
 * `depth - photo.depth`: negative while the photo is still ahead in the haze,
 * zero as it passes the camera plane, positive once it is behind the reader.
 *
 * Distance fade is the scene's fog, not per-card opacity, so photos surface
 * out of the background colour instead of cross-dissolving over it.
 */
export function MonthCard({ photo }: { photo: RunnerPhoto }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const pointerDown = useRef<{ x: number; y: number; time: number } | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const expandedId = useExpandedMonthId();
  const hidden = expandedId === photo.monthId;

  const scale = planeScale(size.width);
  const spread = spreadScale(size.width);
  // Planes are unit-sized and scaled, so one geometry serves every photo.
  const image = texture?.image as { width: number; height: number } | undefined;
  const longest = image ? Math.max(image.width, image.height) : 1;
  const width = image ? (photo.size * image.width) / longest : 0;
  const height = image ? (photo.size * image.height) / longest : 0;

  useEffect(() => {
    let alive = true;
    acquireTexture(photo.src).then((loaded) => {
      if (alive) setTexture(loaded);
    });
    return () => {
      alive = false;
      releaseTexture(photo.src);
    };
  }, [photo.src]);

  useFrame(() => {
    const node = mesh.current;
    if (!node) return;

    const z = scrollState.depth - photo.depth;
    node.position.set(photo.x * spread, photo.y * spread, z);
    node.visible = z < PASSED && !hidden;
    // Fog handles distance; this only covers the first moments past the lens,
    // where the run is being revealed rather than flown through.
    if (material.current) material.current.opacity = gateOpacity(scrollState.depth);
  });

  /**
   * Where this card currently sits on screen, in CSS pixels. The canvas is
   * fixed at the viewport origin, so canvas coordinates are viewport
   * coordinates and the drawer can fly straight from this rect.
   */
  function screenRect(node: THREE.Mesh): CardRect {
    const half = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ] as const;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [x, y] of half) {
      corner.set(x, y, 0).applyMatrix4(node.matrixWorld).project(camera);
      const px = (corner.x * 0.5 + 0.5) * size.width;
      const py = (-corner.y * 0.5 + 0.5) * size.height;
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }

    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  }

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

    // A drag that happened to start on a photo is a scroll, not a tap.
    const travel = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (travel > 10 || event.timeStamp - start.time > 500) return;
    // Only a photo the reader is actually looking at opens.
    if (Math.abs(scrollState.depth - photo.depth) > TAP_RANGE) return;

    event.stopPropagation();
    expandMonth(photo.monthId, screenRect(mesh.current));
  }

  if (!texture || !image) return null;

  return (
    <mesh
      ref={mesh}
      visible={false}
      scale={[width * scale, height * scale, 1]}
      rotation={[0, 0, photo.roll]}
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
