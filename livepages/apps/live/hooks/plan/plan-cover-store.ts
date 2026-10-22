'use client';

// Whether a Plan board or view covers the canvas (docs/specs/026-plan/plan-board.md "Maximised board", "Fill Tab"),
// kept out of PlanContext so the chrome that asks (the selection toolbars, the Map, the palette, the keyboard) and
// the boards re-render only when the answer changes, never on an element added or moved. A module store, like
// maximised-plan.ts: the open tab's board filling it, published by usePlanCoverWiring; the
// maximised element comes from maximised-plan.ts.
import { useSyncExternalStore } from 'react';
import type { PlanTabKind } from '@livepages/document';
import { getMaximisedPlanId, getMaximisedPlanKind, subscribeMaximisedPlan } from './maximised-plan';
import { createListeners } from '@/lib/listeners';

type PlanCover = {
  // The board or Sheet filling the open tab, or null, and which it is.
  fillTabId: string | null;
  fillTabKind: 'Board' | 'Sheet' | 'View' | null;
  // The open tab's Plan kind (docs/specs/026-plan/plan-tabs.md): on a Board or Sheet tab the element always fills it.
  planKind?: PlanTabKind | null;
};

let cover: PlanCover = { fillTabId: null, fillTabKind: null, planKind: null };
const listeners = createListeners();

// Publishes the open tab's cover; listeners hear only a real change.
export function setPlanCover(next: PlanCover): void {
  if (
    next.fillTabId === cover.fillTabId &&
    next.fillTabKind === cover.fillTabKind &&
    (next.planKind ?? null) === (cover.planKind ?? null)
  )
    return;
  cover = next;
  listeners.notify();
}

function subscribe(listener: () => void): () => void {
  const offCover = listeners.subscribe(listener);
  const off = subscribeMaximisedPlan(listener);
  return () => {
    offCover();
    off();
  };
}

// Anything covers the canvas: a board, view or Sheet maximised, a board or Sheet filling the tab, or a Dashboard tab's
// page (docs/specs/026-plan/plan-tabs.md), or a Form tab's (docs/specs/030-forms/forms.md). Read at a key press too.
export function isCanvasCovered(): boolean {
  return (
    getMaximisedPlanId() !== null ||
    cover.fillTabId !== null ||
    cover.planKind === 'dashboard' ||
    cover.planKind === 'form'
  );
}

// A board fills the tab (docs/specs/026-plan/plan-board.md "The palette follows what fills the screen"): the palette
// narrows to Cards, since cards land only on a board. A maximised board is the person's view for a moment and keeps
// the mode's palette.
export function isBoardFillingTab(): boolean {
  return cover.fillTabKind === 'Board';
}

// A Sheet covers the canvas (maximised or filling its tab): the zoom controls zoom its cells (sheet-zoom.ts), and the
// palette is hidden, since nothing it offers lands in a Sheet.
export function isSheetCovering(): boolean {
  return getMaximisedPlanKind() === 'Sheet' || cover.fillTabKind === 'Sheet';
}

// The board covering the canvas (maximised, or filling its tab), or null: the palette gives way to that board's cards
// (docs/specs/026-plan/plan-board.md "The palette follows what fills the screen").
function getCoveringBoardId(): string | null {
  if (getMaximisedPlanKind() === 'Board') return getMaximisedPlanId();
  return cover.fillTabKind === 'Board' ? cover.fillTabId : null;
}

const serverNull = () => null;
export function useCoveringBoardId(): string | null {
  return useSyncExternalStore(subscribe, getCoveringBoardId, serverNull);
}

const serverFalse = () => false;
const subscribeNone = () => () => {};

// The kinds that can cover the canvas: a board, a visualisation and a Sheet.
export const COVERING_SHAPES: ReadonlySet<string> = new Set([
  'plan-board',
  'plan-view',
  'plan-sheet',
]);
export function useCanvasCovered(): boolean {
  return useSyncExternalStore(subscribe, isCanvasCovered, serverFalse);
}

export function useBoardFillingTab(): boolean {
  return useSyncExternalStore(subscribe, isBoardFillingTab, serverFalse);
}

export function useSheetCovering(): boolean {
  return useSyncExternalStore(subscribe, isSheetCovering, serverFalse);
}

// `id` (a board, view or Sheet) covers the canvas: maximised, or filling the tab. Its layer, size, rotation and
// animation are the canvas's, which it hides, so they are not offered (plan-board.md "Maximised board").
// Null (an element that can never cover it) subscribes to nothing, so every element on the canvas may ask.
export function useCoversCanvas(id: string | null): boolean {
  return useSyncExternalStore(
    id === null ? subscribeNone : subscribe,
    () => id !== null && (getMaximisedPlanId() === id || cover.fillTabId === id),
    serverFalse,
  );
}

// The board or Sheet filling the open tab is `id`.
export function useFillsTab(id: string): boolean {
  return useSyncExternalStore(subscribe, () => cover.fillTabId === id, serverFalse);
}

// The open tab's Plan kind, or null for any other tab.
export function usePlanTabKind(): PlanTabKind | null {
  return useSyncExternalStore(subscribe, () => cover.planKind ?? null, serverNull);
}
