'use client';

// The Plan slice's board, chart and card element writes (usePlanSlice.ts): a board's or a chart's set-up changed on
// whichever tab holds it (its tab renamed with it), a deleted status's columns taken off every board, and a Plan card
// placed, changed or removed on the canvas. Split from the slice, which composes them into PlanContext.
import { useCallback } from 'react';
import {
  createShape,
  type Element,
  type Tab,
  type PlanCardRef,
  type PlanViewRef,
} from '@liveplanner/project';
import { normaliseBoardSetup, settleDoneColumns, type PlanBoardSetup } from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import { tabNamedForBoard, tabNamedForView } from '@/lib/tab-named-plan';

type ElementsCommit = (mapElements: (els: Element[]) => Element[]) => void;

export function usePlanElementWrites(w: {
  commit: ElementsCommit;
  // A change to one element on whichever tab holds it (usePlanSlice's commitOn).
  commitOn: (
    elementId: string,
    mapElements: (els: Element[]) => Element[],
    retab?: (tab: Tab) => Tab,
  ) => void;
  commitRef: { readonly current: ElementsCommit };
  commitTabsRef: { readonly current: ((mapTabs: (tabs: Tab[]) => Tab[]) => void) | undefined };
  select: (elementId: string | null) => void;
}) {
  const { commit, commitOn, commitRef, commitTabsRef, select } = w;
  const updateBoard = useCallback(
    (boardId: string, setup: PlanBoardSetup) => {
      // The board's title before this change: only a change of title renames the tab, so any other setting (a column,
      // a card type) never takes a tab that has drifted from its board, such as a Duplicate's copy, back.
      let before: string | undefined;
      commitOn(
        boardId,
        (els) =>
          els.map((el) => {
            if (el.id !== boardId || el.type !== 'shape' || el.shape !== 'plan-board') return el;
            before = el.planBoard?.title;
            // Each column flagged as it counts (docs/specs/026-plan/plan-board.md "Done columns"): a column it had
            // counts as it did, a new one by its name.
            return { ...el, planBoard: settleDoneColumns(el.planBoard, setup) };
          }),
        // A Board tab and its board share one name (docs/specs/026-plan/plan-tabs.md "Names"): renamed, the tab follows.
        (tab) => (before === setup.title ? tab : tabNamedForBoard(tab, setup.title)),
      );
    },
    [commitOn],
  );

  // Delete Status (docs/specs/026-plan/plan-board.md "Column settings"): the state's columns come off every other
  // board in the project too, so no board keeps an empty column for a state that is gone.
  const removeStatusColumns = useCallback(
    (status: string, exceptBoardId: string) => {
      const drop = (els: Element[]) => {
        let changed = false;
        const next = els.map((el) => {
          if (el.id === exceptBoardId || el.type !== 'shape' || el.shape !== 'plan-board')
            return el;
          const setup = normaliseBoardSetup(el.planBoard);
          if (!setup || !setup.columns.some((c) => c.status === status)) return el;
          changed = true;
          return {
            ...el,
            planBoard: settleDoneColumns(setup, {
              ...setup,
              columns: setup.columns.filter((c) => c.status !== status),
            }),
          };
        });
        return changed ? next : els;
      };
      const commitTabs = commitTabsRef.current;
      if (commitTabs)
        commitTabs((ts) =>
          ts.map((t) => {
            const elements = drop(t.elements);
            return elements === t.elements ? t : { ...t, elements };
          }),
        );
      else commitRef.current(drop);
    },
    [commitRef, commitTabsRef],
  );

  const updateView = useCallback(
    (viewId: string, settings: PlanViewRef) => {
      // The chart's title before this change: only a new title renames the tab (as updateBoard).
      let before: string | undefined;
      commitOn(
        viewId,
        (els) =>
          els.map((el) => {
            if (el.id !== viewId || el.type !== 'shape' || el.shape !== 'plan-view') return el;
            before = el.planView?.title;
            return { ...el, planView: settings };
          }),
        // A Visualisation tab and its chart share one name (plan-tabs.md "Names"): titled, the tab follows.
        (tab) => (before === settings.title ? tab : tabNamedForView(tab, viewId, settings.title)),
      );
    },
    [commitOn],
  );

  const placeCardOut = useCallback(
    (itemId: string, x: number, y: number) => {
      const card = createShape('plan-card', 0, 0);
      const placed = {
        ...card,
        x: x - card.width / 2,
        y: y - card.height / 2,
        planCard: { itemId },
      };
      commit((els) => [...els, placed]);
      select(placed.id);
      track('Plan', 'Added', 'Card');
    },
    [commit, select],
  );

  const removeCard = useCallback(
    (cardElementId: string) => commit((els) => els.filter((el) => el.id !== cardElementId)),
    [commit],
  );

  const updateCard = useCallback(
    (cardElementId: string, ref: PlanCardRef) =>
      commit((els) =>
        els.map((el) =>
          el.id === cardElementId && el.type === 'shape' && el.shape === 'plan-card'
            ? { ...el, planCard: ref }
            : el,
        ),
      ),
    [commit],
  );

  return { updateBoard, removeStatusColumns, updateView, placeCardOut, removeCard, updateCard };
}
