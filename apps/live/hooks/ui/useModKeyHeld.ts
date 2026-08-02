'use client';

import { createHeldKeyStore, useHeldKey } from './held-key-store';

// Singleton subscription that exposes "is the user currently holding
// Cmd or Ctrl". The store machinery is shared (see held-key-store);
// what follows is only this key's policy.
//
// Used by the CommandPalette's IconButton to surface the per-element
// shortcut letter as a corner badge whenever the modifier is down,
// turning the palette into a self-documenting cheat sheet without
// adding any persistent chrome.
//
// The modifier is read off the EVENT rather than tracked as a key in its
// own right: `metaKey` / `ctrlKey` ride every keyboard event, so one
// handler serves both directions and a chord like Cmd-Shift-K still
// reports the modifier as held.
//
// `blur` resets to false so a user who Cmd-tabs away mid-hold doesn't
// come back to badges that never clear (the OS swallows the keyup
// that fires in the other window).
const MOD_KEY_STORE = createHeldKeyStore((set) => {
  const sync = (e: KeyboardEvent) => set(e.metaKey || e.ctrlKey);
  window.addEventListener('keydown', sync);
  window.addEventListener('keyup', sync);
  window.addEventListener('blur', () => set(false));
});

export function useModKeyHeld(): boolean {
  return useHeldKey(MOD_KEY_STORE);
}
