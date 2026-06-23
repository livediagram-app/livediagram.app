'use client';

import { useSyncExternalStore } from 'react';

// Singleton subscription that exposes "is the user currently holding
// Cmd or Ctrl". Subscribers get re-rendered only on the transitions
// (down -> up, up -> down), not on every key the user types while
// the modifier is held. One window listener serves the whole app,
// the alternative (every IconButton attaching its own keydown / keyup
// pair) would be N listeners for a feature that only flips at human
// speed.
//
// Used by the CommandPalette's IconButton to surface the per-element
// shortcut letter as a corner badge whenever the modifier is down,
// turning the palette into a self-documenting cheat sheet without
// adding any persistent chrome.
//
// `blur` resets to false so a user who Cmd-tabs away mid-hold doesn't
// come back to badges that never clear (the OS swallows the keyup
// that fires in the other window).

let modHeld = false;
const listeners = new Set<() => void>();
let attached = false;

function fan(): void {
  for (const fn of listeners) fn();
}

function ensureAttached(): void {
  if (attached || typeof window === 'undefined') return;
  attached = true;
  window.addEventListener('keydown', (e) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod !== modHeld) {
      modHeld = isMod;
      fan();
    }
  });
  window.addEventListener('keyup', (e) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod !== modHeld) {
      modHeld = isMod;
      fan();
    }
  });
  window.addEventListener('blur', () => {
    if (modHeld) {
      modHeld = false;
      fan();
    }
  });
}

function subscribe(cb: () => void): () => void {
  ensureAttached();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  return modHeld;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useModKeyHeld(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
