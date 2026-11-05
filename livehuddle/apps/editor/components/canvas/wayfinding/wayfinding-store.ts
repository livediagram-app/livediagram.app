import { useSyncExternalStore } from 'react';
import type { WayPerson, WayPoint, WayTab } from '@/lib/wayfinding';

// The Directory's and the Elevator's view of the space (docs/specs/009-elements/blueprints/wayfinding.md "Store"):
// one store per canvas, filled by useWayfinding and read by the faces through selectors, so a face re-renders only
// when what it shows changes, and a walk inside one room re-renders nothing.

export type WayfindingState = {
  tabs: readonly WayTab[];
  activeTabId: string;
  people: readonly WayPerson[];
  /** The Elevator whose floor panel a walk-in opened, or null. */
  openElevatorId: string | null;
  /** The Elevator a ride just arrived at, and a fresh number per ride, for its doors. */
  arrivalElevatorId: string | null;
  arrivalSeq: number;
};

export type WayfindingStore = {
  get: () => WayfindingState;
  set: (patch: Partial<WayfindingState>) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createWayfindingStore(): WayfindingStore {
  let state: WayfindingState = {
    tabs: [],
    activeTabId: '',
    people: [],
    openElevatorId: null,
    arrivalElevatorId: null,
    arrivalSeq: 0,
  };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      const keys = Object.keys(patch) as (keyof WayfindingState)[];
      if (keys.every((k) => Object.is(state[k], patch[k]))) return;
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** One value out of the store; the face re-renders when it changes (by Object.is). */
export function useWayfindingSelect<T>(
  store: WayfindingStore,
  select: (s: WayfindingState) => T,
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}

/** What a place row or a floor row does: the actions the hook owns, stable for the canvas's life. */
export type WayfindingActions = {
  /** Walk your character to a place on this tab (entering Avatar mode first when needed). */
  walkThere: (place: { approach: WayPoint | null; arrival: WayPoint }) => void;
  /** Jump to a point on a tab, like a Portal; `ignoreId` is an Elevator to step out of without calling it. */
  go: (to: { tabId: string; point: WayPoint; ignoreId?: string }) => void;
  /** Close a panel a walk-in opened. */
  closeElevator: () => void;
};

export type Wayfinding = { store: WayfindingStore; actions: WayfindingActions };
