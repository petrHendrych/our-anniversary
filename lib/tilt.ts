"use client";

/**
 * "Look into the scene" tilt.
 *
 * The runner's camera leans towards wherever the reader is pointing — the
 * mouse on a desktop, the phone's own attitude on a device. It is what stops
 * the flight from feeling like a flat slideshow: the photos shift against each
 * other because the camera really has turned.
 *
 * Like lib/scroll-store, this is a plain mutable object rather than React
 * state — CameraTilt reads it inside a render loop, and a value that changes
 * with every pointer move has no business re-rendering anything.
 */
import { useSyncExternalStore } from "react";

/** Camera rotation the scene eases towards, in radians. */
export const tiltTarget = { x: 0, y: 0 };

/**
 * The eased rotation the camera is actually at, written by CameraTilt each
 * frame. The flying month titles are DOM, not scene objects, so they read this
 * to pan along with everything else.
 */
export const tiltCurrent = { x: 0, y: 0 };

/** Radians of camera rotation across the full width/height of the screen. */
const MOUSE_RANGE = 0.95;
/** Radians per degree of device tilt — a 30° lean turns the camera about 26°. */
const PER_DEGREE = Math.PI / 210;
/** Nobody should be able to spin the camera round by flipping the phone over. */
const LIMIT = 0.55;

const clamp = (value: number) => Math.max(-LIMIT, Math.min(LIMIT, value));

/** Device attitude when tilt started — everything is measured against it. */
let baseline: { beta: number; gamma: number } | null = null;
let listening = false;
/** True while a card is open: the camera holds still so the card lands centred. */
let suspended = false;
/**
 * False until the reader is through the lens.
 *
 * The intro is a single object viewed head on, and the reader arrives here with
 * their pointer wherever the Enter button happened to be — usually a corner. A
 * camera that leaned towards it would show the reader a lens they are looking
 * at from an angle, for no reason they could name. So the tilt only wakes up on
 * the other side, where panning becomes navigation rather than decoration.
 */
let armed = false;

type OrientationPermission = "granted" | "denied" | "default";
interface OrientationCtor {
  requestPermission?: () => Promise<OrientationPermission>;
}

/** iOS 13+ only hands out orientation events after an explicit user gesture. */
export function gyroNeedsPermission(): boolean {
  if (typeof window === "undefined") return false;
  const ctor = window.DeviceOrientationEvent as unknown as OrientationCtor | undefined;
  return typeof ctor?.requestPermission === "function";
}

let gyroGranted = !gyroNeedsPermission();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function handlePointer(event: PointerEvent) {
  if (suspended || !armed) return;
  // Touch drags are scrolling; only a real pointer aims the camera.
  if (event.pointerType !== "mouse") return;
  tiltTarget.y = -(event.clientX / window.innerWidth - 0.5) * MOUSE_RANGE;
  tiltTarget.x = -(event.clientY / window.innerHeight - 0.5) * MOUSE_RANGE;
}

function handleOrientation(event: DeviceOrientationEvent) {
  if (suspended || !armed) return;
  const beta = event.beta ?? 0;
  const gamma = event.gamma ?? 0;
  // First reading is however the phone happened to be held; that is level.
  if (!baseline) baseline = { beta, gamma };
  // Pull the top of the phone towards you and the camera looks up; lean it
  // right and the camera looks right — the same directions the mouse gives.
  tiltTarget.x = clamp((beta - baseline.beta) * PER_DEGREE);
  tiltTarget.y = clamp(-(gamma - baseline.gamma) * PER_DEGREE);
}

/** Starts whichever input this device has. Safe to call more than once. */
export function startTilt(): () => void {
  if (listening) return () => {};
  listening = true;

  window.addEventListener("pointermove", handlePointer, { passive: true });
  if (gyroGranted) window.addEventListener("deviceorientation", handleOrientation);

  return () => {
    listening = false;
    window.removeEventListener("pointermove", handlePointer);
    window.removeEventListener("deviceorientation", handleOrientation);
  };
}

/**
 * Asks iOS for orientation access. Must be called straight out of a tap
 * handler or Safari refuses without showing the reader anything.
 */
export async function requestGyro(): Promise<boolean> {
  const ctor = window.DeviceOrientationEvent as unknown as OrientationCtor | undefined;
  if (typeof ctor?.requestPermission !== "function") return false;

  const result = await ctor.requestPermission().catch(() => "denied" as const);
  if (result !== "granted") return false;

  gyroGranted = true;
  baseline = null;
  if (listening) window.addEventListener("deviceorientation", handleOrientation);
  notify();
  return true;
}

/**
 * Wakes the tilt up, or puts it back to sleep pointing straight ahead.
 *
 * Called with the reader's progress through the lens: before that the camera is
 * pinned dead centre whatever the pointer is doing, and the moment it wakes it
 * re-levels, so however the phone is being held at that instant becomes level.
 */
export function armTilt(on: boolean): void {
  if (armed === on) return;
  armed = on;
  if (on) {
    levelTilt();
  } else {
    tiltTarget.x = 0;
    tiltTarget.y = 0;
  }
}

/** Re-levels the tilt to however the phone is being held right now. */
export function levelTilt(): void {
  baseline = null;
}

/**
 * Holds the camera still while a card is open.
 *
 * It freezes rather than levels: a focused print is placed in camera space (see
 * lib/focus-layout), so it is centred whatever angle the camera was left at,
 * and swinging the whole scene back to level on every tap would be motion for
 * nothing. Releasing re-levels, because the phone has almost certainly moved
 * while the card was being looked at.
 */
export function suspendTilt(on: boolean): void {
  if (suspended === on) return;
  suspended = on;
  if (!on) levelTilt();
}

/** True while the reader could still turn tilt on — i.e. iOS, not yet asked. */
export function useGyroPending(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => !gyroGranted,
    () => false,
  );
}
