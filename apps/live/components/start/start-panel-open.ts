// Whether a template start panel (Start Diagramming, Start Facilitating) is on screen
// (docs/specs/007-editor/start-diagramming.md "The tours wait"): the Diagram and Facilitate tours hold their offer
// until it has gone, so the welcome card never lands over the panel. One panel shows at a time (the active tab's).
import { useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

let open = false;
const listeners = createListeners();

export function setStartPanelOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.notify();
}

export function useStartPanelOpen(): boolean {
  return useSyncExternalStore(
    listeners.subscribe,
    () => open,
    () => false,
  );
}

// When a start panel last left the screen: one mounting within SWAP_MS of it is the same panel in another mode (a
// mode change on an empty tab), and turns in place rather than flying up again (StartPanel).
const SWAP_MS = 400;
let leftAt = -Infinity;

export function noteStartPanelLeft(): void {
  leftAt = performance.now();
}

export function startPanelJustLeft(): boolean {
  return performance.now() - leftAt < SWAP_MS;
}
