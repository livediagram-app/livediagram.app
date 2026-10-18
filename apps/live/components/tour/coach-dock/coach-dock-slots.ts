import { useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

// Where the coach dock and its tour chip draw (docs/specs/007-editor/coach-dock.md "Where it sits"): the dock slot
// between the canvas and the tab bar (EditorView), the chip slot in the tab bar before Search (TabBar). A module
// store, like the active-tour slot: one editor per page.
export type CoachSlot = 'dock' | 'chip';

const slots: Record<CoachSlot, HTMLElement | null> = { dock: null, chip: null };
const listeners = createListeners();

export function coachSlot(slot: CoachSlot): HTMLElement | null {
  return slots[slot];
}

// Publishes a slot's element as it mounts (null as it goes); only the element holding a slot can release it.
export function setCoachSlot(slot: CoachSlot, el: HTMLElement | null, owner?: HTMLElement): void {
  if (el === null && owner && slots[slot] !== owner) return;
  if (slots[slot] === el) return;
  slots[slot] = el;
  listeners.notify();
}

export function useCoachSlot(slot: CoachSlot): HTMLElement | null {
  return useSyncExternalStore(
    listeners.subscribe,
    () => slots[slot],
    () => null,
  );
}
