import { useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

// Which guided tour is on screen (docs/specs/026-plan/plan-tour.md "Where it appears"): the welcome, Plan and
// Draw tours never run at
// once, so each host publishes itself here while it is active and waits for the others to clear. A module
// store, like the modal guard: one editor per page.
type ActiveTour =
  | 'welcome'
  | 'plan'
  | 'dashboard'
  | 'draw'
  | 'pages'
  | 'form'
  | 'element'
  // Any Show Me running (ShowMeStage): an offer never comes up beside one.
  | 'show-me';

let current: ActiveTour | null = null;
const listeners = createListeners();

export function activeTour(): ActiveTour | null {
  return current;
}

// Claims the slot for a tour, or releases it (only the tour holding it can release it).
export function setActiveTour(tour: ActiveTour, on: boolean): void {
  const next = on ? tour : current === tour ? null : current;
  if (next === current) return;
  current = next;
  listeners.notify();
}

export function useActiveTour(): ActiveTour | null {
  return useSyncExternalStore(listeners.subscribe, activeTour, () => null);
}
