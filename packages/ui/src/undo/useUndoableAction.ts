'use client';

import { useCallback } from 'react';
import { useToast } from '../toast/ToastProvider';

// Undo, not confirm (liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md): an action that can be taken
// back runs at once, and a toast says what it did with Undo. One helper for every app, so each says it the same way.

export type UndoableAction = {
  // What happened, as the toast says it: "Deleted “Layer 2” and its 4 elements."
  message: string;
  // Does it. `false` (or a promise of it): it did nothing, so there is nothing to undo and no toast.
  act: () => boolean | void | Promise<boolean | void>;
  // Takes it back, through the same path as any edit. `false` (or a promise of it, or a throw): it couldn't.
  undo: () => boolean | void | Promise<boolean | void>;
  // The Undo button's accessible name, saying what it undoes: "Undo deleting Layer 2".
  undoLabel?: string;
  // Said in an error toast when the undo couldn't run.
  undoFailed?: string;
};

export const UNDO_FAILED_MESSAGE = 'Couldn’t undo that. Try Undo (Cmd/Ctrl-Z) instead.';

let next = 0;

/** Run a restorable action now and offer its Undo in a toast; resolves whether the action did something. */
export function useUndoableAction(): (action: UndoableAction) => Promise<boolean> {
  const toast = useToast();
  return useCallback(
    async (action: UndoableAction) => {
      const done = await action.act();
      if (done === false) return false;
      next += 1;
      // Its own key: a second action's toast never takes this one's Undo away.
      const key = `undo:${next}`;
      let used = false;
      const failed = () => toast.error(action.undoFailed ?? UNDO_FAILED_MESSAGE);
      toast.action({
        key,
        message: action.message,
        // It stands in for the confirm the action no longer asks, so In-Editor Notifications off never hides it.
        important: true,
        actions: [
          {
            label: 'Undo',
            ...(action.undoLabel ? { ariaLabel: action.undoLabel } : {}),
            onSelect: () => {
              if (used) return;
              used = true;
              toast.dismissAction(key);
              try {
                void Promise.resolve(action.undo()).then((ok) => {
                  if (ok === false) failed();
                }, failed);
              } catch {
                failed();
              }
            },
          },
        ],
      });
      return true;
    },
    [toast],
  );
}
