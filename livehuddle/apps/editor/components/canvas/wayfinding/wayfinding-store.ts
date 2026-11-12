import { useSyncExternalStore } from 'react';
import type {
  StairsBox,
  StairsFlight,
  WayBox,
  WayPerson,
  WayPoint,
  WayTab,
} from '@/lib/wayfinding';

// The Directory's, the Elevator's and the Stairs' view of the space (docs/specs/009-elements/blueprints/wayfinding.md "Store"):
// one store per canvas, filled by useWayfinding and read by the faces through selectors, so a face re-renders only
// when what it shows changes, and a walk inside one room re-renders nothing.

export type WayfindingState = {
  tabs: readonly WayTab[];
  activeTabId: string;
  people: readonly WayPerson[];
  /** The Elevator or Stairs whose panel a walk-in opened, or null. */
  openPanelId: string | null;
  /** The Elevator a ride just arrived at, and a fresh number per ride, for its doors. */
  arrivalId: string | null;
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
    openPanelId: null,
    arrivalId: null,
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

// A store nothing fills, for a face drawn without wayfinding (a preview): its selectors read the empty state.
export const NO_WAYFINDING_STORE = createWayfindingStore();

/**
 * Whether a walk-in opened this Elevator's or Stairs' panel (`openPanelId`); false without wayfinding. Read by the face
 * itself, so its hover card hides while the panel is open (blueprints/wayfinding.md "Hover card").
 */
export function useWalkedInPanel(wayfinding: Wayfinding | undefined, elementId: string): boolean {
  return useWayfindingSelect(
    wayfinding?.store ?? NO_WAYFINDING_STORE,
    (s) => s.openPanelId === elementId,
  );
}

/** Where a Walk There goes: a place's approach and arrival, and the box its own walls stand in (walkThereRoute). */
export type WalkTarget = {
  approach: WayPoint | null;
  arrival: WayPoint;
  bounds?: WayBox | null;
};

/** What a place row or a floor row does: the actions the hook owns, stable for the canvas's life. */
export type WayfindingActions = {
  /** Walk your character to a place on this tab (entering Avatar mode first when needed). */
  walkThere: (place: WalkTarget) => void;
  /**
   * Jump to a point on a tab, like a Portal; `ignoreId` is a piece to step out of without calling it, and `then` a
   * point the character walks to once it stands on that tab (off the Stairs it landed on).
   */
  go: (to: { tabId: string; point: WayPoint; ignoreId?: string; then?: WayPoint }) => void;
  /** Take a flight of Stairs (docs/specs/009-elements/stairs.md "Taking them"): climb `from`, travel, walk off. */
  climb: (to: { from: StairsBox & { id: string }; flight: StairsFlight }) => void;
  /** Fetch the floors (tabs) not loaded yet, so the Elevator panel knows their Elevators (elevator.md "The panel"). */
  loadFloors: () => void;
  /** Close a panel a walk-in opened. */
  closePanel: () => void;
};

export type Wayfinding = { store: WayfindingStore; actions: WayfindingActions };
