// Item undo steps placed among the canvas's snapshots (docs/specs/026-plan/items.md "Undo",
// blueprint item-store.md "Undo"). Items live outside the tabs, so their changes cannot be tab
// snapshots; instead each step remembers the tab history's depth when it was made, and undo takes
// whichever came last: the item step when no canvas step has been made since it, else the canvas
// step. Redo mirrors it by the redo side's length, and a new branch of edits drops stale redos.
// Pure, so the interleaving is tested without React.

export type ItemUndoStep = {
  undo: () => void;
  redo: () => void;
};

export type HistoryPosition = { depth: number; branch: number; futureLength: number };

export type ItemUndoJournal = {
  undo: { step: ItemUndoStep; depth: number }[];
  redo: { step: ItemUndoStep; futureLength: number; branch: number }[];
};

export const EMPTY_JOURNAL: ItemUndoJournal = { undo: [], redo: [] };

// Steps kept, as the tab history keeps 500.
export const ITEM_UNDO_LIMIT = 500;

export function journalPush(
  j: ItemUndoJournal,
  step: ItemUndoStep,
  at: HistoryPosition,
): ItemUndoJournal {
  return { undo: [...j.undo, { step, depth: at.depth }].slice(-ITEM_UNDO_LIMIT), redo: [] };
}

// The item step undo takes now, or null when the canvas's step is the later one.
export function journalUndoTarget(j: ItemUndoJournal, at: HistoryPosition): ItemUndoStep | null {
  const top = j.undo[j.undo.length - 1];
  return top && top.depth === at.depth ? top.step : null;
}

export function journalAfterUndo(j: ItemUndoJournal, at: HistoryPosition): ItemUndoJournal {
  const top = j.undo[j.undo.length - 1]!;
  return {
    undo: j.undo.slice(0, -1),
    redo: [...j.redo, { step: top.step, futureLength: at.futureLength, branch: at.branch }],
  };
}

// Redo entries made on another branch are gone, as the canvas's own redo side is.
export function journalLiveRedo(j: ItemUndoJournal, at: HistoryPosition): ItemUndoJournal {
  const redo = j.redo.filter((r) => r.branch === at.branch);
  return redo.length === j.redo.length ? j : { ...j, redo };
}

export function journalRedoTarget(j: ItemUndoJournal, at: HistoryPosition): ItemUndoStep | null {
  const top = j.redo[j.redo.length - 1];
  return top && top.branch === at.branch && top.futureLength === at.futureLength ? top.step : null;
}

export function journalAfterRedo(j: ItemUndoJournal, at: HistoryPosition): ItemUndoJournal {
  const top = j.redo[j.redo.length - 1]!;
  return { undo: [...j.undo, { step: top.step, depth: at.depth }], redo: j.redo.slice(0, -1) };
}
