'use client';

// Whether a Plan board or view covers the canvas (docs/specs/026-plan/plan-board.md "Maximised board", "Fill Tab"),
// kept out of PlanContext so the chrome that asks (the selection toolbars, the Map, the palette, the keyboard) and
// the boards re-render only when the answer changes, never on an element added or moved. A module store, like
// maximised-plan.ts: the open tab's board filling it and its element count, published by usePlanCoverWiring; the
// maximised element comes from maximised-plan.ts.
import { useSyncExternalStore } from 'react';
import { getMaximisedPlanId, getMaximisedPlanKind, subscribeMaximisedPlan } from './maximised-plan';

export type PlanCover = {
  // The board filling the open tab, or null.
  fillTabBoardId: string | null;
  // How many elements the open tab holds (Setup Board's Fill Tab warning).
  tabElementCount: number;
};

let cover: PlanCover = { fillTabBoardId: null, tabElementCount: 0 };
const listeners = new Set<() => void>();

export function getPlanCover(): PlanCover {
  return cover;
}

// Publishes the open tab's cover; listeners hear only a real change.
export function setPlanCover(next: PlanCover): void {
  if (
    next.fillTabBoardId === cover.fillTabBoardId &&
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

// Anything covers the canvas: a board or view maximised, or a board filling the tab. Read at a key press too.
export function isCanvasCovered(): boolean {
  return getMaximisedPlanId() !== null || cover.fillTabBoardId !== null;
}

// A board covers it (maximised or filling the tab), not a view: what the palette narrows to Cards for, since cards
// land only on a board.
export function isBoardCovering(): boolean {
  return getMaximisedPlanKind() === 'Board' || cover.fillTabBoardId !== null;
}

const serverFalse = () => false;
export function useCanvasCovered(): boolean {
  return useSyncExternalStore(subscribe, isCanvasCovered, serverFalse);
}

export function useBoardCovering(): boolean {
  return useSyncExternalStore(subscribe, isBoardCovering, serverFalse);
}

// The board filling the open tab is `id`.
export function useFillsTab(id: string): boolean {
  return useSyncExternalStore(subscribe, () => cover.fillTabBoardId === id, serverFalse);
}

const zero = () => 0;
export function useTabElementCount(): number {
  return useSyncExternalStore(subscribe, () => cover.tabElementCount, zero);
}
