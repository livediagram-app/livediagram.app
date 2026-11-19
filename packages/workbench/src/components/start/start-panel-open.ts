// Whether a template start panel is on screen (docs/specs/007-editor/start-diagramming.md "The tours wait"): a tour
// that waits holds its offer until it has gone, so the welcome card never lands over the panel. One panel shows at a
// time (the active tab's). liveplanner's tours never wait (start-panel.md there): its panel shows only on an empty
// tab, where no tour has a subject. Walking waits too (docs/specs/008-canvas/avatar-mode.md "Not over a start"): the
// character never moves behind a start. The toasts (the new version one among them) stand above its foot row where it
// is a phone sheet, so it tells them when it comes or goes; liveplanner's Start Planning says it is open too.
import { useSyncExternalStore } from 'react';
import { announceToastFloorChange } from '@liveworkspace/ui/toast';
import { createListeners } from '../../lib/listeners';

let open = false;
const listeners = createListeners();

export function setStartPanelOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.notify();
  announceToastFloorChange();
}

// The same, read once, for window-level listeners that run outside React (the walk's keys and clicks,
// @livehuddle/avatar/walk-guard).
export function startPanelIsOpen(): boolean {
  return open;
}

export function useStartPanelOpen(): boolean {
  return useSyncExternalStore(
    listeners.subscribe,
    () => open,
    () => false,
  );
}

// When a start panel last left the screen: one mounting within SWAP_MS of it is the same panel arriving again (on
// another empty tab, or in another mode), and turns in place rather than flying up again (StartPanel).
const SWAP_MS = 400;
let leftAt = -Infinity;

export function noteStartPanelLeft(): void {
  leftAt = performance.now();
}

export function startPanelJustLeft(): boolean {
  return performance.now() - leftAt < SWAP_MS;
}
