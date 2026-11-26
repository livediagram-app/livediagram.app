// The Start a Call popover's state (liveworkspace/docs/specs/004-index/item-calls.md "The Start a Call popover"):
// whether it is open, the control it opened from, and whether a start it made is on its way. Module-level, as the
// calls' store is: the corner card's Call and the phone's Apps drawer tile open the one popover ItemCallHost mounts, and
// both show "Starting" while a start runs.
import { useSyncExternalStore } from 'react';

export type CallChooserState = {
  open: boolean;
  // The Call button it opened under; null from the Apps drawer's tile (a phone sheet then).
  anchor: HTMLElement | null;
  starting: boolean;
};

const CLOSED: CallChooserState = { open: false, anchor: null, starting: false };

let state: CallChooserState = CLOSED;
const listeners = new Set<() => void>();

const set = (next: Partial<CallChooserState>) => {
  state = { ...state, ...next };
  for (const l of [...listeners]) l();
};

/** Opens the popover under `anchor` (a phone sheet with none). A start on its way keeps it shut. */
export function openCallChooser(anchor: HTMLElement | null): void {
  if (state.starting) return;
  set({ open: true, anchor });
}

/** Closes it, starting nothing. */
export function closeCallChooser(): void {
  if (state.open) set({ open: false, anchor: null });
}

/** A start from the popover is on its way (true) or has answered (false). */
export function setCallStarting(starting: boolean): void {
  if (state.starting !== starting) set({ starting });
}

/** Back to closed and idle: the item closed. */
export function resetCallChooser(): void {
  if (!state.open && !state.starting) return;
  state = CLOSED;
  for (const l of [...listeners]) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useCallChooser(): CallChooserState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => CLOSED,
  );
}
