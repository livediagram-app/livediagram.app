'use client';

import { createHeldKeyStore, useHeldKey } from './held-key-store';

// Singleton subscription that exposes "is the user currently holding
// Shift". The store machinery is shared (see held-key-store); what
// follows is only this key's policy. Drives the shift hint banner
// (spec/09): while Shift is down the editor names what the modifier is
// doing right now.
//
// A Shift press while typing (an input / textarea / contentEditable has
// focus) is just capitalisation, so it does NOT count as held — the
// banner must not flash on every capital letter. The guard is on keydown
// only: a keyup must always release, or focusing an input mid-hold would
// strand the banner open. `blur` resets for the same reason.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest('input, textarea, [contenteditable="true"]') !== null;
}

const SHIFT_STORE = createHeldKeyStore((set) => {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Shift') return;
    if (isTypingTarget(e.target)) return;
    set(true);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') set(false);
  });
  window.addEventListener('blur', () => set(false));
});

export function useShiftHeld(): boolean {
  return useHeldKey(SHIFT_STORE);
}
