'use client';

import { useEffect, useSyncExternalStore } from 'react';

// Whether the move prompt after signing in (docs/specs/014-identity/auth-and-guest-access.md "Moving documents kept
// Offline after signing in") is up. A dialog that would open by itself on the same arrival (the Automations gate, back
// from a guest's sign-in) waits until it is answered, so the two never stack. One page, one prompt: a plain flag.

let showing = false;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (showing === next) return;
  showing = next;
  for (const l of [...listeners]) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Whether the move prompt is up now. */
export function useLocalMoveShowing(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => showing,
    () => false,
  );
}

/** The move prompt says whether it is up, and lets go as it goes. */
export function usePublishLocalMoveShowing(up: boolean): void {
  useEffect(() => {
    set(up);
    return () => set(false);
  }, [up]);
}
