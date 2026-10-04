'use client';

// The canvas gesture in progress (docs/specs/008-canvas/canvas-performance.md): what the Map, the
// selection chrome and the long-task log ask before doing per-frame work. One singleton store, as
// held-key-store: gesture sources open and close gestures, readers re-render only when the reported
// gesture changes.

import { useSyncExternalStore } from 'react';
import { debugLog } from './debug-log';

export type CanvasGesture =
  'pan' | 'zoom' | 'move' | 'resize' | 'reshape' | 'marquee' | 'stroke' | 'erase';

export type CanvasGestureState = CanvasGesture | 'idle';

// The gestures that change elements on every frame.
export const ELEMENT_GESTURES: ReadonlySet<CanvasGesture> = new Set([
  'move',
  'resize',
  'reshape',
  'stroke',
  'erase',
]);

// A wheel has no end event: a wheel pan or zoom ends this long after its last wheel event
// (docs/specs/008-canvas/blueprints/DEFAULTS.md D62).
export const WHEEL_SETTLE_MS = 150;

export function selectionMoving(gesture: CanvasGestureState): boolean {
  return gesture === 'move' || gesture === 'resize' || gesture === 'reshape';
}

type OpenGesture = { token: number; kind: CanvasGesture };

let open: OpenGesture[] = [];
let nextToken = 1;
let reported: CanvasGestureState = 'idle';
const listeners = new Set<() => void>();

function refresh(): void {
  const now = open.at(-1)?.kind ?? 'idle';
  if (now === reported) return;
  reported = now;
  for (const fn of listeners) fn();
}

// Opens a gesture; the returned end() closes it and is safe to call more than once.
export function beginCanvasGesture(kind: CanvasGesture): () => void {
  const token = nextToken++;
  open = [...open, { token, kind }];
  debugLog('[canvas-gesture] begin', { kind, open: open.length });
  refresh();
  return () => {
    if (!open.some((g) => g.token === token)) return;
    open = open.filter((g) => g.token !== token);
    debugLog('[canvas-gesture] end', { kind, open: open.length });
    refresh();
  };
}

export function canvasGestureNow(): CanvasGestureState {
  return reported;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Called whenever the reported gesture changes (a gesture opening or closing). */
export const subscribeCanvasGesture = subscribe;

const serverSnapshot = (): CanvasGestureState => 'idle';

export function useCanvasGesture(): CanvasGestureState {
  return useSyncExternalStore(subscribe, canvasGestureNow, serverSnapshot);
}

export function resetCanvasGesturesForTests(): void {
  open = [];
  reported = 'idle';
  listeners.clear();
}
