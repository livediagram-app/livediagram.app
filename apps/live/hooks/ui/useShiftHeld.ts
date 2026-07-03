'use client';

import { useSyncExternalStore } from 'react';

// Singleton subscription that exposes "is the user currently holding
// Shift" — useModKeyHeld's pattern (one window listener, re-render only
// on the down/up transitions) for the Shift key. Drives the shift hint
// banner (spec/09): while Shift is down the editor names what the
// modifier is doing right now.
//
// A Shift press while typing (an input / textarea / contentEditable has
// focus) is just capitalisation, so it does NOT count as held — the
// banner must not flash on every capital letter. `blur` resets so a
// user who tabs away mid-hold doesn't come back to a stuck banner.

let shiftHeld = false;
const listeners = new Set<() => void>();
let attached = false;

function fan(): void {
  for (const fn of listeners) fn();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest('input, textarea, [contenteditable="true"]') !== null;
}

function set(next: boolean): void {
  if (next !== shiftHeld) {
    shiftHeld = next;
    fan();
  }
}

function ensureAttached(): void {
  if (attached || typeof window === 'undefined') return;
  attached = true;
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Shift') return;
    if (isTypingTarget(e.target)) return;
    set(true);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') set(false);
  });
  window.addEventListener('blur', () => set(false));
}

function subscribe(cb: () => void): () => void {
  ensureAttached();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  return shiftHeld;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useShiftHeld(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
