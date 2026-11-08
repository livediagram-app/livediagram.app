'use client';

import { useSyncExternalStore } from 'react';

// Reset All Settings, told to every Settings panel on the page (liveworkspace/docs/specs/010-site/site.md "Settings",
// "Reset All Settings"). A panel signed in draws its rows from the scopes it read when it opened, so a reset that
// cleared them on the server has it draw itself again from the page's copy (set to the answer, resetAccountSettings);
// the row it was pressed in reads when, so it says Settings Reset across that redraw. Its own module, apart from the
// store, so the panel's first chunk carries only this.

let generation = 0;
let resetAt = 0;
const listeners = new Set<() => void>();

/** A reset landed: every panel draws itself again. */
export function announceSettingsReset(now = Date.now()): void {
  generation += 1;
  resetAt = now;
  for (const listener of listeners) listener();
}

/** When the last reset on this page landed (0: none yet). */
export function lastSettingsResetAt(): number {
  return resetAt;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const current = () => generation;
const none = () => 0;

/** How many resets the page has seen: a key that draws the panel again after each. */
export function useSettingsResetGeneration(): number {
  return useSyncExternalStore(subscribe, current, none);
}

/** Test seam. */
export function __forgetSettingsResets(): void {
  generation = 0;
  resetAt = 0;
}
