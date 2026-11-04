// Item undo steps placed among the canvas's snapshots (docs/specs/026-plan/items.md "Undo",
// blueprint item-store.md "Undo"). Items live outside the tabs, so their changes cannot be tab
// snapshots; instead each step remembers the tab history's depth when it was made, and undo takes
// whichever came last: the item step when no canvas step has been made since it, else the canvas
// step. Redo mirrors it by the redo side's length, and a new branch of edits drops stale redos.
// Pure, so the interleaving is tested without React.

export type ItemUndoStep = {
  undo: () => void;
  redo: () => void;
  // Made together with the canvas step committed just before it (a field's filters taken off its boards and views,
  // docs/specs/026-plan/item-types.md "Edit Field"): undone and redone with that step, as one.
  canvas?: true;
};

// A write of many cards' values, as a type's save waits for it (docs/specs/026-plan/item-types.md "Edit Field":
// Saving the type, all or none): whether it all landed, and the undo of whatever did (null: nothing did).
export type ValuesWrite = { ok: boolean; step: ItemUndoStep | null };

// Several steps made as one (a field's type changed with its cards' values, docs/specs/026-plan/item-types.md "Edit
// Field"): undo takes them back last first, redo makes them again in order. `canvas` ties it to the canvas step made
// just before it.
export function combinedStep(steps: readonly ItemUndoStep[], canvas = false): ItemUndoStep {
  return {
    ...(canvas ? { canvas: true as const } : {}),
    undo: () => {
      for (let i = steps.length - 1; i >= 0; i -= 1) steps[i]!.undo();
    },
    redo: () => {
      for (const s of steps) s.redo();
    },
  };
}

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
  // A step tied to a canvas step sits after it: one deeper than the history read before that commit.
  const depth = at.depth + (step.canvas ? 1 : 0);
  return { undo: [...j.undo, { step, depth }].slice(-ITEM_UNDO_LIMIT), redo: [] };
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

// A step tied to a canvas step was filed before that step was undone too: its canvas step lies one further on.
export function journalRedoTarget(j: ItemUndoJournal, at: HistoryPosition): ItemUndoStep | null {
  const top = j.redo[j.redo.length - 1];
  const ahead = top?.step.canvas ? 1 : 0;
  return top && top.branch === at.branch && top.futureLength + ahead === at.futureLength
    ? top.step
    : null;
}

export function journalAfterRedo(j: ItemUndoJournal, at: HistoryPosition): ItemUndoJournal {
  const top = j.redo[j.redo.length - 1]!;
  // Its canvas step is made again first, so it sits one deeper than the history read before.
  const depth = at.depth + (top.step.canvas ? 1 : 0);
  return { undo: [...j.undo, { step: top.step, depth }], redo: j.redo.slice(0, -1) };
}
