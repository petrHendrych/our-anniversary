"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll-store";
import { CAMERA_Z, INTRO_CAMERA_DEPTH, planeScale } from "@/lib/runner-layout";

/**
 * The camera the reader flies into.
 *
 * Built from primitives rather than loaded as a model: it is a handful of
 * boxes and cylinders, it costs nothing to download, and — the reason that
 * actually matters — the lens barrel can be shaped around the flight path, so
 * the bore really is where the reader passes through.
 *
 * The sequence is all distance-driven, like everything else in the runner. The
 * glass goes first, as if the aperture opened; the body fades as it fills the
 * screen and would otherwise swallow the frame; the barrel survives longest so
 * that for a moment the reader is inside it, looking down a dark tube. Then it
 * is gone and the first month begins.
 */

/** Distances from the viewer, in world units, at which each stage fades. */
const GLASS_FADE = [1900, 1150] as const;
const SHELL_FADE = [1700, 820] as const;
const BARREL_FADE = [420, -220] as const;

/** The glass is never fully opaque — the bore has to read as somewhere to go. */
const GLASS_MAX = 0.42;

/** Range outside which the whole rig stops drawing. */
const DRAW_NEAR = -520;
const DRAW_FAR = 4200;

const fade = (d: number, [from, to]: readonly [number, number]) =>
  THREE.MathUtils.clamp((d - to) / (from - to), 0, 1);

/**
 * There is exactly one intro camera and it lives as long as the page does, so
 * its materials are module-level singletons. That also keeps them out of
 * React's hands: their opacity is written every frame from useFrame.
 */
const materials = {
  body: new THREE.MeshStandardMaterial({
    color: "#2a2630",
    roughness: 0.55,
    metalness: 0.25,
    transparent: true,
  }),
  metal: new THREE.MeshStandardMaterial({
    color: "#c3bcae",
    roughness: 0.3,
    metalness: 0.8,
    transparent: true,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: "#16283c",
    roughness: 0.08,
    metalness: 0.9,
    transparent: true,
  }),
  barrel: new THREE.MeshStandardMaterial({
    color: "#1a1620",
    roughness: 0.9,
    metalness: 0.1,
    transparent: true,
    side: THREE.DoubleSide,
  }),
};

export function IntroCamera() {
  const group = useRef<THREE.Group>(null);
  const width = useThree((state) => state.size.width);
  const scale = planeScale(width);

  useFrame(() => {
    const node = group.current;
    if (!node) return;

    const z = scrollState.depth - INTRO_CAMERA_DEPTH;
    const distance = CAMERA_Z - z;

    node.visible = distance > DRAW_NEAR && distance < DRAW_FAR;
    if (!node.visible) return;

    node.position.z = z;
    // Barely-there drift, so the camera reads as an object in space rather
    // than a decal pinned to the middle of the screen.
    node.rotation.y = Math.sin(scrollState.depth * 0.0004) * 0.16;
    node.rotation.x = Math.cos(scrollState.depth * 0.0003) * 0.06;

    materials.glass.opacity = fade(distance, GLASS_FADE) * GLASS_MAX;
    const shell = fade(distance, SHELL_FADE);
    materials.body.opacity = shell;
    materials.metal.opacity = shell;
    materials.barrel.opacity = fade(distance, BARREL_FADE);
  });

  return (
    <group ref={group} scale={scale} visible={false}>
      {/* Lights exist only for this model — the photographs are unlit planes. */}
      <ambientLight intensity={1.15} />
      <directionalLight position={[700, 900, 1400]} intensity={2.1} />
      <directionalLight position={[-900, -300, 600]} intensity={0.6} />

      <RoundedBox args={[1150, 720, 420]} radius={38} smoothness={4} material={materials.body} />

      {/* Prism hump and eyepiece. */}
      <mesh position={[0, 400, -20]} material={materials.body}>
        <boxGeometry args={[420, 170, 300]} />
      </mesh>
      <mesh position={[0, 395, -200]} material={materials.body}>
        <boxGeometry args={[150, 110, 70]} />
      </mesh>

      {/* Shutter release. */}
      <mesh position={[430, 400, 90]} material={materials.metal}>
        <cylinderGeometry args={[52, 52, 46, 24]} />
      </mesh>

      {/* The barrel the reader flies down. Open-ended and double-sided, so it
          is a tube from the outside and a tunnel from the inside. */}
      <mesh position={[0, 0, 590]} rotation={[Math.PI / 2, 0, 0]} material={materials.barrel}>
        <cylinderGeometry args={[300, 300, 760, 48, 1, true]} />
      </mesh>

      {/* Focus ring and glass at the front lip. */}
      <mesh position={[0, 0, 950]} material={materials.metal}>
        <torusGeometry args={[318, 30, 16, 48]} />
      </mesh>
      <mesh position={[0, 0, 930]} material={materials.glass}>
        <circleGeometry args={[290, 48]} />
      </mesh>
    </group>
  );
}
