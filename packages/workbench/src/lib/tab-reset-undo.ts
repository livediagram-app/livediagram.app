// Reset canvas, in every editor's tab menu (liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md): it
// empties the tab at once, with no question, and a toast offers Undo, which puts back every element the reset took,
// in its old order, as a new step through the editor's commit (so the room carries it, and anything a collaborator
// added since stays). One module for every editor's useTabActions.
import { revertStep, type UndoableAction } from '@liveworkspace/ui/undo';

type Keyed = { readonly id: string };
type TabOf<E extends Keyed> = { readonly id: string; readonly elements: readonly E[] };

/** The reset's words: the toast and its Undo's accessible name. */
export const RESET_TAB_WORDS = {
  canvas: { message: 'Reset the canvas.', undoLabel: 'Undo resetting the canvas' },
  page: { message: 'Cleared the page.', undoLabel: 'Undo clearing the page' },
} as const;

/** Empty `tabId` now and offer its Undo; resolves whether anything was removed. */
export function resetTabUndoable<E extends Keyed, T extends TabOf<E>>(opts: {
  tabId: string;
  tabs: readonly T[];
  commitTabs: (mapTabs: (ts: T[]) => T[]) => void;
  offerUndo: (action: UndoableAction) => Promise<boolean>;
  words?: { message: string; undoLabel: string };
  // After the reset: drop the selection, count it.
  onReset: () => void;
}): Promise<boolean> {
  const { tabId, commitTabs, offerUndo, onReset } = opts;
  const words = opts.words ?? RESET_TAB_WORDS.canvas;
  // What the reset takes, read at the click, before the commit (never from inside its updater).
  let step: { before: readonly E[] } | null = null;
  return offerUndo({
    ...words,
    act: () => {
      const tab = opts.tabs.find((t) => t.id === tabId);
      if (!tab || tab.elements.length === 0) return false;
      step = { before: tab.elements };
      commitTabs((ts) => ts.map((t) => (t.id === tabId ? { ...t, elements: [] as E[] } : t)));
      onReset();
      return true;
    },
    undo: () => {
      const taken = step;
      if (!taken) return false;
      step = null;
      commitTabs((ts) =>
        ts.map((t) =>
          t.id === tabId ? { ...t, elements: revertStep(taken.before, [], t.elements) } : t,
        ),
      );
      return true;
    },
  });
}
