'use client';

// Whether a Plan board or view covers the canvas (docs/specs/026-plan/plan-board.md "Maximised board", "Fill Tab"),
// kept out of PlanContext so the chrome that asks (the selection toolbars, the Map, the palette, the keyboard) and
// the boards re-render only when the answer changes, never on an element added or moved. A module store, like
// maximised-plan.ts: the open tab's board filling it and its element count, published by usePlanCoverWiring; the
// maximised element comes from maximised-plan.ts.
import { useSyncExternalStore } from 'react';
import { getMaximisedPlanId, getMaximisedPlanKind, subscribeMaximisedPlan } from './maximised-plan';

export type PlanCover = {
  // The board or Sheet filling the open tab, or null, and which it is.
  fillTabId: string | null;
  fillTabKind: 'Board' | 'Sheet' | null;
  // How many elements the open tab holds (Setup Board's Fill Tab warning).
  tabElementCount: number;
};

let cover: PlanCover = { fillTabId: null, fillTabKind: null, tabElementCount: 0 };
const listeners = new Set<() => void>();

// Publishes the open tab's cover; listeners hear only a real change.
export function setPlanCover(next: PlanCover): void {
  if (
    next.fillTabId === cover.fillTabId &&
    next.fillTabKind === cover.fillTabKind &&
    next.tabElementCount === cover.tabElementCount
  )
    return;
  cover = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const off = subscribeMaximisedPlan(listener);
  return () => {
    listeners.delete(listener);
    off();
  };
}

// Anything covers the canvas: a board, view or Sheet maximised, or a board or Sheet filling the tab. Read at a key press too.
export function isCanvasCovered(): boolean {
  return getMaximisedPlanId() !== null || cover.fillTabId !== null;
}

// A board covers it (maximised or filling the tab), not a view: what the palette narrows to Cards for, since cards
// land only on a board.
export function isBoardCovering(): boolean {
  return getMaximisedPlanKind() === 'Board' || cover.fillTabKind === 'Board';
}

const serverFalse = () => false;
export function useCanvasCovered(): boolean {
  return useSyncExternalStore(subscribe, isCanvasCovered, serverFalse);
}

export function useBoardCovering(): boolean {
  return useSyncExternalStore(subscribe, isBoardCovering, serverFalse);
}

// The board or Sheet filling the open tab is `id`.
export function useFillsTab(id: string): boolean {
  return useSyncExternalStore(subscribe, () => cover.fillTabId === id, serverFalse);
}

const zero = () => 0;
export function useTabElementCount(): number {
  return useSyncExternalStore(subscribe, () => cover.tabElementCount, zero);
}
