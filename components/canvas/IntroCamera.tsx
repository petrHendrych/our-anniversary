"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll-store";
import { bodyScale, CAMERA_Z, INTRO_CAMERA_DEPTH } from "@/lib/runner-layout";

/**
 * The camera the reader flies into.
 *
 * Built from primitives rather than loaded as a model: it is boxes, cylinders
 * and toroids, it costs nothing to download, and — the reason that actually
 * matters — the lens barrel can be shaped around the flight path, so the bore
 * really is where the reader passes through.
 *
 * The detail is worth its draw calls because this is the one object the reader
 * ever looks at head on, and because it is only in the scene for the length of
 * the intro. Every part shares one of the five module materials below, so the
 * fade sequence stays four lines rather than a per-mesh concern; a new part on
 * a new material would be left hanging in the air after the rest had gone.
 *
 * The sequence is all distance-driven, like everything else in the runner. The
 * glass goes first, as if the aperture opened; the body fades as it fills the
 * screen and would otherwise swallow the frame; the barrel survives longest so
 * that for a moment the reader is inside it, looking down a dark tube. Then it
 * is gone and the first month begins.
 */

/**
 * Distances from the viewer, in world units, at which each stage fades.
 *
 * The body holds solid until it is genuinely large — around 250px across on a
 * phone — and only then gives way. Fading it earlier is what used to leave the
 * reader with a bare ring of lens barrel and no camera around it: it was at
 * two-thirds opacity by the time it was big enough to recognise.
 */
const GLASS_FADE = [1600, 950] as const;
const SHELL_FADE = [1050, 520] as const;
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
  // The covering: near-black and completely matt, so it reads as leatherette
  // against the body's slight sheen rather than as more of the same plastic.
  grip: new THREE.MeshStandardMaterial({
    color: "#17141c",
    roughness: 0.95,
    metalness: 0.05,
    transparent: true,
  }),
};

export function IntroCamera() {
  const group = useRef<THREE.Group>(null);
  const width = useThree((state) => state.size.width);
  const scale = bodyScale(width);

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
    materials.grip.opacity = shell;
    materials.barrel.opacity = fade(distance, BARREL_FADE);
  });

  return (
    <group ref={group} scale={scale} visible={false}>
      {/* Lights exist only for this model — the photographs are unlit planes. */}
      <ambientLight intensity={1.05} />
      <directionalLight position={[700, 900, 1400]} intensity={2.1} />
      <directionalLight position={[-900, -300, 600]} intensity={0.6} />
      {/* A rim from behind, so the top plate and the barrel rings separate
          from the body instead of reading as one silhouette. */}
      <directionalLight position={[-400, 700, -900]} intensity={0.9} />

      <RoundedBox args={[1150, 720, 420]} radius={38} smoothness={4} material={materials.body} />

      {/* Leatherette front panels, inset either side of the mount. */}
      <RoundedBox
        args={[190, 520, 40]}
        radius={16}
        smoothness={3}
        position={[-465, -20, 200]}
        material={materials.grip}
      />
      {/* The right-hand grip stands proud of the body. */}
      <RoundedBox
        args={[240, 660, 300]}
        radius={40}
        smoothness={4}
        position={[520, -20, 120]}
        material={materials.grip}
      />

      {/* Pentaprism, chamfered rather than a plain block. */}
      <mesh position={[0, 400, -20]} material={materials.body}>
        <boxGeometry args={[420, 170, 300]} />
      </mesh>
      <mesh position={[0, 500, -20]} material={materials.body}>
        <boxGeometry args={[300, 60, 230]} />
      </mesh>

      {/* Hot shoe: a channel, not a lump. */}
      <mesh position={[0, 540, -20]} material={materials.metal}>
        <boxGeometry args={[190, 14, 120]} />
      </mesh>
      <mesh position={[0, 556, -78]} material={materials.metal}>
        <boxGeometry args={[190, 22, 16]} />
      </mesh>
      <mesh position={[0, 556, 38]} material={materials.metal}>
        <boxGeometry args={[190, 22, 16]} />
      </mesh>

      {/* Eyepiece, with a rim around the glass. */}
      <mesh position={[0, 395, -200]} material={materials.body}>
        <boxGeometry args={[150, 110, 70]} />
      </mesh>
      <mesh position={[0, 395, -238]} material={materials.metal}>
        <torusGeometry args={[62, 10, 10, 24]} />
      </mesh>

      {/* Shutter speed dial, with the release sunk into the top of it. */}
      <mesh position={[430, 415, -40]} material={materials.metal}>
        <cylinderGeometry args={[86, 86, 60, 28]} />
      </mesh>
      <mesh position={[430, 452, -40]} material={materials.body}>
        <cylinderGeometry args={[52, 52, 22, 24]} />
      </mesh>
      <mesh position={[430, 400, 120]} material={materials.metal}>
        <cylinderGeometry args={[46, 46, 52, 24]} />
      </mesh>

      {/* Film advance lever, swung out of the body. */}
      <mesh position={[560, 398, -150]} rotation={[0, 0.22, 0]} material={materials.metal}>
        <boxGeometry args={[250, 18, 62]} />
      </mesh>

      {/* Rewind knob on the left shoulder. */}
      <mesh position={[-430, 420, -40]} material={materials.metal}>
        <cylinderGeometry args={[72, 72, 66, 24]} />
      </mesh>
      <mesh position={[-430, 462, -40]} material={materials.body}>
        <cylinderGeometry args={[26, 26, 30, 16]} />
      </mesh>

      {/* Nameplate, frame counter, self-timer, lens release — the small print
          that stops the front from reading as a blank slab. */}
      <mesh position={[-370, 290, 214]} material={materials.metal}>
        <boxGeometry args={[230, 44, 10]} />
      </mesh>
      <mesh position={[300, 358, 130]} material={materials.glass}>
        <cylinderGeometry args={[34, 34, 10, 20]} />
      </mesh>
      <mesh position={[-420, -170, 214]} rotation={[0, 0, 0.5]} material={materials.metal}>
        <boxGeometry args={[130, 26, 12]} />
      </mesh>
      <mesh position={[-430, 90, 214]} material={materials.metal}>
        <cylinderGeometry args={[30, 30, 26, 18]} />
      </mesh>

      {/* Strap lugs. */}
      <mesh position={[-575, 250, 40]} rotation={[0, Math.PI / 2, 0]} material={materials.metal}>
        <torusGeometry args={[36, 9, 8, 20]} />
      </mesh>
      <mesh position={[575, 250, 40]} rotation={[0, Math.PI / 2, 0]} material={materials.metal}>
        <torusGeometry args={[36, 9, 8, 20]} />
      </mesh>

      {/* Lens mount, where the barrel meets the body. */}
      <mesh position={[0, 0, 220]} material={materials.metal}>
        <torusGeometry args={[336, 26, 14, 48]} />
      </mesh>

      {/* The barrel the reader flies down, in two steps. Open-ended and
          double-sided, so it is a tube from the outside and a tunnel from the
          inside — and the rings around it are what give the flight a sense of
          speed as they pass. */}
      <mesh position={[0, 0, 360]} rotation={[Math.PI / 2, 0, 0]} material={materials.barrel}>
        <cylinderGeometry args={[326, 326, 300, 48, 1, true]} />
      </mesh>
      <mesh position={[0, 0, 700]} rotation={[Math.PI / 2, 0, 0]} material={materials.barrel}>
        <cylinderGeometry args={[300, 300, 420, 48, 1, true]} />
      </mesh>

      {/* Zoom and focus rings — knurled bands around the barrel. */}
      <mesh position={[0, 0, 470]} rotation={[Math.PI / 2, 0, 0]} material={materials.grip}>
        <cylinderGeometry args={[344, 344, 120, 40, 1, true]} />
      </mesh>
      <mesh position={[0, 0, 790]} rotation={[Math.PI / 2, 0, 0]} material={materials.grip}>
        <cylinderGeometry args={[318, 318, 90, 40, 1, true]} />
      </mesh>

      {/* Aperture ring, seen down the bore on the way in. */}
      <mesh position={[0, 0, 560]} material={materials.metal}>
        <torusGeometry args={[262, 16, 10, 40]} />
      </mesh>

      {/* Front lip, inner reflection, and the glass itself. */}
      <mesh position={[0, 0, 950]} material={materials.metal}>
        <torusGeometry args={[318, 30, 16, 48]} />
      </mesh>
      <mesh position={[0, 0, 918]} material={materials.metal}>
        <torusGeometry args={[214, 9, 10, 40]} />
      </mesh>
      <mesh position={[0, 0, 930]} material={materials.glass}>
        <circleGeometry args={[290, 48]} />
      </mesh>
    </group>
  );
}
