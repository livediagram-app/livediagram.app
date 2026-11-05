'use client';

// What the Timer and Stopwatch faces need from the editor (docs/specs/009-elements/timer-and-stopwatch.md "The
// controls"): whether this session may run them (`can.takePart`), and the delta path a press goes through. A tiny
// module store the editor host writes once (`useTimerPieceControls`), so the faces on the canvas never read the
// editor's context and never re-render with it: a face subscribes to one boolean, and a press reads the sender at the
// moment it is made.

import { useEffect, useSyncExternalStore } from 'react';
import type { ElementDelta, PieceTimer } from '@livehuddle/document';

type Send = (elementId: string, delta: ElementDelta) => void;

let takePart = false;
let send: Send | null = null;
const listeners = new Set<() => void>();

/** Write the session's controls (the editor host, and tests); null when no editor is mounted. */
export function setTimerPieceControls(next: { takePart: boolean; send: Send } | null): void {
  const nextTakePart = next?.takePart ?? false;
  send = next?.send ?? null;
  if (nextTakePart === takePart) return;
  takePart = nextTakePart;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether this session may run a Timer or Stopwatch: re-renders only when that changes. */
export function useTimerTakePart(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => takePart,
    () => false,
  );
}

/** Send one press: the whole new clock as a `piece-timer` delta. A no-op when the session may not run it. */
export function pressTimerPiece(elementId: string, state: PieceTimer): void {
  if (!takePart || !send) return;
  send(elementId, { kind: 'piece-timer', state });
}

/** Mount once in the editor host: the session's `can.takePart` and its delta path. */
export function useTimerPieceControls(allowed: boolean, applyElementDelta: Send): void {
  useEffect(() => {
    setTimerPieceControls({ takePart: allowed, send: applyElementDelta });
  }, [allowed, applyElementDelta]);
  useEffect(() => () => setTimerPieceControls(null), []);
}
