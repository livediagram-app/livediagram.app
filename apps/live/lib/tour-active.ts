import { useSyncExternalStore } from 'react';

// Which guided tour is on screen (docs/specs/026-plan/plan-tour.md "Where it appears",
// docs/specs/012-collaboration/facilitate-tour.md): the welcome, Plan and Facilitate tours never run at
// once, so each host publishes itself here while it is active and waits for the others to clear. A module
// store, like the modal guard: one editor per page.
export type ActiveTour = 'welcome' | 'plan' | 'facilitate';

let current: ActiveTour | null = null;
const listeners = new Set<() => void>();

export function activeTour(): ActiveTour | null {
  return current;
}

// Claims the slot for a tour, or releases it (only the tour holding it can release it).
export function setActiveTour(tour: ActiveTour, on: boolean): void {
  const next = on ? tour : current === tour ? null : current;
  if (next === current) return;
  current = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useActiveTour(): ActiveTour | null {
  return useSyncExternalStore(subscribe, activeTour, () => null);
}
