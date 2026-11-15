// Whether Prototype mode is open, and the screen it starts on (docs/specs/007-editor/wireframe-pages.md "Prototype
// mode"): opened from the header's Prototype or a link's `prototype`, played by the canvas host. One per browser tab,
// as the page someone is on is (current-page-kind.ts).
import { useSyncExternalStore } from 'react';
import { track } from '@/lib/telemetry';

export type PrototypePlayerState = { open: boolean; startId: string | null };

const CLOSED: PrototypePlayerState = { open: false, startId: null };
let state: PrototypePlayerState = CLOSED;
const listeners = new Set<() => void>();

function set(next: PrototypePlayerState): void {
  state = next;
  for (const l of listeners) l();
}

/** Opens the player on `startId` (the screen in view; the first when null or not a screen). */
export function openPrototype(startId: string | null): void {
  if (state.open) return;
  set({ open: true, startId });
  track('Canvas', 'Used', 'Prototype');
}

export function closePrototype(): void {
  if (state.open) set(CLOSED);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePrototypePlayer(): PrototypePlayerState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => CLOSED,
  );
}
