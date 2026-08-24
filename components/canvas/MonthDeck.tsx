"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll-store";
import {
  dragDeck,
  focusState,
  releaseFocus,
  settleDeck,
  useFocusedEventId,
} from "@/lib/focus-store";
import { FOCUS_DISTANCE, focusPose } from "@/lib/focus-layout";
import { deckSeed, pilePose, ringOffset } from "@/lib/deck-layout";
import {
  CAMERA_Z,
  gateOpacity,
  holdScale,
  photosForEvent,
  planeScale,
  spreadScale,
  type RunnerPhoto,
} from "@/lib/runner-layout";
import { acquireCardTexture, releaseCardTexture } from "@/lib/card-texture";

/** Share of the screen a finger has to travel to turn the deck by one card. */
const SWIPE_SPAN = 0.55;
/** Below this a gesture is a tap, not a drag. */
const SLOP = 6;
/** A downward drag this far throws the deck back into the run. */
const DISMISS = 90;
/** Pixels per second that counts as a flick rather than a slow drag. */
const FLICK = 550;

/** Per-frame scratch — module-level so the deck allocates nothing while it moves. */
const FORWARD = new THREE.Vector3(0, 0, 1);
const rest = new THREE.Vector3();
const target = new THREE.Vector3();
const forward = new THREE.Vector3();
const up = new THREE.Vector3();
const right = new THREE.Vector3();
const camQ = new THREE.Quaternion();
const restQ = new THREE.Quaternion();
const focusQ = new THREE.Quaternion();
const leanQ = new THREE.Quaternion();

/**
 * The event whose card was tapped, held in front of the reader as a deck.
 *
 * A card is one event, and the deck is that event's own photographs — its
 * cover first, then pictures that appear nowhere else on the page. The card
 * next to it in the run is a different event with a different set entirely.
 *
 * The tapped card's flight out is *not* this component's — the run card flies
 * itself, exactly as it always has. The deck mounts as soon as the card opens
 * so its textures are ready, but draws nothing until that flight lands. At
 * that instant it takes over: its front card is at the identical pose, holding
 * the identical texture, with `spread` still at zero, so the swap cannot be
 * seen. From there the pile fans out and the deck owns everything, the flight
 * home included.
 *
 * It has to own the cycling, because after one swipe the card at the front is
 * a photograph the run never held at all — only the cover was ever out there.
 *
 * Every card in the deck flies home to the cover's slot in the run, because
 * that is the one place this event occupies; closing winds the deck back to
 * the cover first (see releaseFocus), so what lands is the card that was
 * tapped, at exactly the pose it left.
 */
export function MonthDeck() {
  const eventId = useFocusedEventId();
  const photos = useMemo(() => photosForEvent(eventId), [eventId]);
  const dragged = useDeckGestures(eventId, photos.length);

  if (!eventId || photos.length === 0) return null;

  return (
    <group
      // Fires for any click that misses this group — the empty space around
      // the deck, or the dimmed run behind it. A swipe that happens to end on
      // nothing is not a tap, so it does not count.
      onPointerMissed={() => {
        // `landed` is what keeps the very click that opened the month from
        // closing it again on the way past, and a swipe that happens to end
        // on nothing is not a tap.
        if (focusState.landed && !dragged.current) releaseFocus();
      }}
    >
      {photos.map((photo, index) => (
        <DeckCard
          key={photo.key}
          photo={photo}
          index={index}
          count={photos.length}
          dragged={dragged}
        />
      ))}
    </group>
  );
}

/**
 * Drag, flick, dismiss and arrow keys, bound to the canvas for as long as a
 * card is open. The listeners sit on the canvas element rather than on the
 * cards so a swipe works anywhere on screen, not only where a photograph
 * happens to be.
 *
 * The browser's own touch gestures are turned off through CSS rather than from
 * here — FocusMode marks <html> while a deck is open and app/globals.css takes
 * `touch-action` off the canvas from there.
 */
function useDeckGestures(eventId: string | null, count: number) {
  const canvas = useThree((state) => state.gl.domElement);
  const dragged = useRef(false);

  useEffect(() => {
    if (!eventId || count === 0) return;

    let drag: { x: number; y: number; cursor: number; time: number } | null = null;
    const span = () => Math.max(160, window.innerWidth * SWIPE_SPAN);

    function onDown(event: PointerEvent) {
      // Cleared first: a tap that lands before the deck has arrived must not
      // read the previous gesture's drag and swallow its own close.
      dragged.current = false;
      // Nothing to turn until the deck has arrived.
      if (!focusState.landed) return;
      drag = {
        x: event.clientX,
        y: event.clientY,
        cursor: focusState.cursor,
        time: event.timeStamp,
      };
    }

    function onMove(event: PointerEvent) {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!dragged.current && Math.hypot(dx, dy) < SLOP) return;
      dragged.current = true;
      // A downward drag is a dismissal; it is decided on release, and until
      // then the deck simply does not turn.
      if (Math.abs(dy) > Math.abs(dx)) return;
      dragDeck(drag.cursor - dx / span());
    }

    function onUp(event: PointerEvent) {
      const start = drag;
      drag = null;
      if (!start || !dragged.current) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy > DISMISS) releaseFocus();
        return;
      }

      const seconds = Math.max(0.016, (event.timeStamp - start.time) / 1000);
      const velocity = dx / seconds;
      const settled = Math.round(focusState.cursor);
      // A flick that never travelled far enough to turn a card still turns one.
      const flick =
        Math.abs(velocity) > FLICK && settled === Math.round(start.cursor)
          ? Math.sign(-velocity)
          : 0;
      settleDeck(settled + flick);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") settleDeck(Math.round(focusState.cursor) + 1);
      if (event.key === "ArrowLeft") settleDeck(Math.round(focusState.cursor) - 1);
    }

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [canvas, eventId, count]);

  return dragged;
}

function DeckCard({
  photo,
  index,
  count,
  dragged,
}: {
  photo: RunnerPhoto;
  index: number;
  count: number;
  dragged: React.RefObject<boolean>;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const seed = useMemo(() => deckSeed(photo.src), [photo.src]);

  const scale = planeScale(size.width);
  const spread = spreadScale(size.width);
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
      .catch(() => {});
    return () => {
      alive = false;
      releaseCardTexture(photo.src, photo.caption);
    };
  }, [photo.src, photo.caption]);

  useFrame(() => {
    const node = mesh.current;
    const surface = material.current;
    if (!node || !surface || !image) return;

    // Until the tapped run card has landed, it is still drawing itself and
    // this deck is only here to have its textures ready.
    if (!focusState.handed) {
      node.visible = false;
      return;
    }

    const t = focusState.t;
    const fan = focusState.spread;
    const gate = gateOpacity(scrollState.depth);
    const w = width * scale;
    const h = height * scale;

    const offset = ringOffset(index, focusState.cursor, count);
    const pile = pilePose(offset, count, size.width, seed);
    // 1 for the card at the front of the deck, 0 for anything a whole place
    // away — only the front card has a run pose to fly back to.
    const front = Math.max(0, 1 - Math.abs(offset));
    const home = (1 - t) * front;

    // Where this photograph sits in the run — the same expression MonthCard
    // uses, so the two agree to the pixel at the moments they hand over.
    // Scroll is stopped while the deck is open, so this is frozen.
    const runZ = scrollState.depth - photo.depth;
    const k = holdScale(runZ);
    rest.set(
      photo.holdX * k + photo.x * spread,
      photo.holdY * k + photo.y * spread,
      runZ,
    );

    // Camera space, so the deck is square to the reader however the tilt has
    // left the camera looking. See lib/focus-layout.
    camera.getWorldQuaternion(camQ);
    forward.set(0, 0, -1).applyQuaternion(camQ);
    up.set(0, 1, 0).applyQuaternion(camQ);
    right.set(1, 0, 0).applyQuaternion(camQ);

    const pose = focusPose(size.width, size.height, w, h);
    const distance = FOCUS_DISTANCE + pile.back * fan;
    // Screen offsets into world units at this card's own distance — a pixel is
    // a world unit at the Z=0 plane, and scales with distance from there.
    const perPixel = distance / CAMERA_Z;

    target
      .copy(camera.position)
      .addScaledVector(forward, distance)
      .addScaledVector(up, pose.rise * (distance / FOCUS_DISTANCE))
      .addScaledVector(right, pile.peek * fan * perPixel);

    node.position.lerpVectors(target, rest, home);

    leanQ.setFromAxisAngle(FORWARD, pile.lean * fan);
    focusQ.copy(camQ).multiply(leanQ);
    restQ.setFromAxisAngle(FORWARD, photo.roll);
    node.quaternion.slerpQuaternions(focusQ, restQ, home);

    const grown = pose.zoom + (1 - pose.zoom) * home;
    node.scale.set(w * grown, h * grown, 1);

    // Only the front card exists before the pile fans out; the rest arrive
    // from behind it, and on the way home they collapse into it again.
    const shown = pile.alpha * (front + (1 - front) * fan);
    node.visible = shown > 0.002;
    node.renderOrder = pile.order;
    surface.depthTest = false;
    surface.opacity = (gate + (1 - gate) * t) * shown;
  });

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    if (dragged.current || !focusState.landed) return;
    event.stopPropagation();
    // Tapping a photograph peeking out of the pile brings it to the front.
    const offset = ringOffset(index, focusState.cursor, count);
    if (Math.abs(offset) > 0.5) settleDeck(Math.round(focusState.cursor + offset));
  }

  if (!texture || !image) return null;

  return (
    <mesh ref={mesh} visible={false} onPointerUp={handlePointerUp}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={material}
        map={texture}
        transparent
        depthWrite={false}
        toneMapped={false}
        fog
      />
    </mesh>
  );
}
