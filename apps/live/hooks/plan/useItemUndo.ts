'use client';

import { useCallback, useState } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import {
  EMPTY_JOURNAL,
  journalAfterRedo,
  journalAfterUndo,
  journalLiveRedo,
  journalPush,
  journalRedoTarget,
  journalUndoTarget,
  type HistoryPosition,
  type ItemUndoStep,
} from './item-undo-journal';

// Wraps the tab history's undo and redo so item changes take their turn in one timeline with
// canvas edits (docs/specs/025-plan/items.md "Undo"; ./item-undo-journal.ts says how).
export function useItemUndo(history: {
  depth: number;
  branch: number;
  futureLength: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  clearRedo: () => void;
}) {
  const [journal, setJournal] = useState(EMPTY_JOURNAL);
  const journalRef = useLatest(journal);
  const at: HistoryPosition = {
    depth: history.depth,
    branch: history.branch,
    futureLength: history.futureLength,
  };
  const atRef = useLatest(at);
  const { clearRedo } = history;

  // Records an item change made by this person. Its redo side is gone, the canvas's too.
  const push = useCallback(
    (step: ItemUndoStep) => {
      clearRedo();
      // The push lands on the branch clearRedo opens.
      const now = atRef.current;
      setJournal((j) => journalPush(j, step, { ...now, branch: now.branch + 1, futureLength: 0 }));
    },
    [clearRedo, atRef],
  );

  const live = journalLiveRedo(journal, at);
  const itemUndo = journalUndoTarget(journal, at);
  const itemRedo = journalRedoTarget(live, at);

  const undo = () => {
    const j = journalRef.current;
    const step = journalUndoTarget(j, atRef.current);
    if (step) {
      step.undo();
      setJournal(journalAfterUndo(j, atRef.current));
      return;
    }
    if (history.canUndo) history.undo();
  };

  const redo = () => {
    const j = journalLiveRedo(journalRef.current, atRef.current);
    const step = journalRedoTarget(j, atRef.current);
    if (step) {
      step.redo();
      setJournal(journalAfterRedo(j, atRef.current));
      return;
    }
    if (history.canRedo) history.redo();
  };

  return {
    push,
    undo,
    redo,
    canUndo: history.canUndo || itemUndo !== null,
    canRedo: history.canRedo || itemRedo !== null,
  };
}
