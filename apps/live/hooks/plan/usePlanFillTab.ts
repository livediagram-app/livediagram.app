'use client';

// Fill Tab's part of the Plan context (docs/specs/026-plan/plan-board.md "Fill Tab"): what turning it on would delete,
// and the change itself (the board's set-up and the rest of the canvas deleted as one commit, so one undo step). Both
// are stable callbacks; which board fills the tab, and the tab's element count, live in plan-cover-store.ts, so the
// context never changes as elements come and go.
import { useCallback, useMemo } from 'react';
import type { Element } from '@livediagram/document';
import type { PlanBoardSetup } from '@livediagram/items';
import {
  fillTabElements,
  fillTabOthers,
  fillTabSheetElements,
  unfillSheetElements,
} from '@/components/plan/fill-tab';
import { useLatest } from '@/hooks/ui/useLatest';

export type PlanFillTab = {
  // The other elements on the open tab, and how many are locked: what turning Fill Tab on for the board deletes.
  // Read when acted on (a press), never during render.
  tabOthers: (boardId: string) => { count: number; locked: number };
  // Fill Tab on for the board, its set-up `update`d from the one it holds at the commit: everything else on the tab
  // is deleted in the same change.
  fillTab: (boardId: string, update: (current: PlanBoardSetup) => PlanBoardSetup) => void;
  // A Sheet filling its tab (docs/specs/029-sheets/sheet.md "Fill Tab"), everything else deleted in the same change;
  // or back on the canvas.
  fillTabSheet: (sheetElementId: string, on: boolean) => void;
};

export function usePlanFillTab({
  readElements,
  commit,
}: {
  // The open tab's live elements.
  readElements: () => readonly Element[];
  commit: (mapElements: (els: Element[]) => Element[]) => void;
}): PlanFillTab {
  const readRef = useLatest(readElements);
  const tabOthers = useCallback(
    (boardId: string) => fillTabOthers(readRef.current(), boardId),
    [readRef],
  );
  const fillTab = useCallback(
    (boardId: string, update: (current: PlanBoardSetup) => PlanBoardSetup) =>
      commit((els) => fillTabElements(els, boardId, update)),
    [commit],
  );
  const fillTabSheet = useCallback(
    (id: string, on: boolean) =>
      commit((els) => (on ? fillTabSheetElements(els, id) : unfillSheetElements(els, id))),
    [commit],
  );
  return useMemo(() => ({ tabOthers, fillTab, fillTabSheet }), [tabOthers, fillTab, fillTabSheet]);
}
