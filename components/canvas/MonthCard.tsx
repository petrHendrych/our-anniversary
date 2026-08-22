"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Month } from "@/data/timeline";
import { scrollState } from "@/lib/scroll-store";
import { expandMonth, useExpandedMonthId, type CardRect } from "@/lib/expanded-store";
import { acquireTexture, releaseTexture } from "@/lib/texture-window";

/** World-space distance between consecutive months along the run. */
const SPACING = 5;
/** How far a card swings off-axis once it is no longer the current month. */
const LATERAL = 0.95;
/** Only a card this close to centre answers a tap. */
const TAP_RANGE = 0.35;

const corner = new THREE.Vector3();

/**
 * One month as a textured plane.
 *
 * The card reads `scrollState.runner` straight out of the store inside
 * useFrame — no React state, no re-renders while scrolling. `offset` is the
 * card's distance from the camera in months: 0 is centred and square-on,
 * positive is still ahead, negative has already gone by.
 */
export function MonthCard({
  month,
  index,
  width,
  height,
  lift,
}: {
  month: Month;
  index: number;
  width: number;
  height: number;
  lift: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const pointerDown = useRef<{ x: number; y: number; time: number } | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const expandedId = useExpandedMonthId();
  const lane = index % 2 === 0 ? -1 : 1;
  const hidden = expandedId === month.id;

  useEffect(() => {
    let alive = true;
    acquireTexture(month.coverImage).then((loaded) => {
      if (alive) setTexture(loaded);
    });
    return () => {
      alive = false;
      releaseTexture(month.coverImage);
    };
  }, [month.coverImage]);

  useFrame(() => {
    const node = mesh.current;
    const mat = material.current;
    if (!node || !mat) return;

    const offset = index - scrollState.runner;
    const distance = Math.abs(offset);
    // Square-on and centred while it owns the screen, swinging out either side
    // of that.
    const swing = THREE.MathUtils.smoothstep(distance, 0.2, 1.3);

    node.position.set(lane * LATERAL * swing, lift + offset * 0.22, -offset * SPACING);
    node.rotation.y = -lane * 0.5 * swing;
    node.rotation.z = lane * 0.06 * swing;

    const appear = 1 - THREE.MathUtils.smoothstep(offset, 2.2, 3.4);
    const passed = 1 - THREE.MathUtils.smoothstep(-offset, 0.55, 1.3);
    const opacity = appear * passed;

    mat.opacity = opacity;
    // Hidden while its own drawer is open — the flight overlay stands in for it.
    node.visible = opacity > 0.01 && !hidden;
  });

  /**
   * Where this card currently sits on screen, in CSS pixels. The canvas is
   * fixed at the viewport origin, so canvas coordinates are viewport
   * coordinates and the drawer can fly straight from this rect.
   */
  function screenRect(node: THREE.Mesh): CardRect {
    const half = [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [-width / 2, height / 2],
      [width / 2, height / 2],
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

    // A drag that happened to start on a card is a scroll, not a tap.
    const travel = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (travel > 10 || event.timeStamp - start.time > 500) return;
    // Only the card the reader is actually looking at opens.
    if (Math.abs(index - scrollState.runner) > TAP_RANGE) return;

    event.stopPropagation();
    expandMonth(month.id, screenRect(mesh.current));
  }

  if (!texture) return null;

  return (
    <mesh
      ref={mesh}
      visible={false}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        ref={material}
        map={texture}
        transparent
        // Cards overlap as they pass; letting them write depth would punch
        // holes in whatever is behind them.
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
