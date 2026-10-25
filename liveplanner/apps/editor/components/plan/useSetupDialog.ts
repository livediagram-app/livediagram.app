'use client';

// The setup dialog's life for one board or Sheet (docs/specs/026-plan/plan-board.md "Setup Board"): open by itself for
// the person who placed it, from its placeholder, or asked for again; closed, with a toast, when someone else sets it
// up while it is open. For this person only (lib/setup-dialog-store.ts).
import { useEffect, useRef } from 'react';
import { closeSetup, openSetup, usePlacedHere, useSetupOpen } from '@/lib/setup-dialog-store';

export function useSetupDialog({
  key,
  unset,
  canEdit,
  setUpElsewhere,
  notify,
}: {
  // The board's element id, or the Sheet's sheet id.
  key: string;
  // Not set up yet: a board with no columns, a Sheet awaiting setup with no cells.
  unset: boolean;
  // May set it up (an Editor, in Plan mode).
  canEdit: boolean;
  // The toast when someone else sets it up while it is open.
  setUpElsewhere: string;
  notify: ((message: string) => void) | undefined;
}) {
  const mode = useSetupOpen(key);
  const placed = usePlacedHere(key);
  // This person's own finish is under way: its write ends the unset state, which is no news to them.
  const finishing = useRef(false);

  // Placed here and still unset: it opens by itself (once; closing it forgets the mark).
  useEffect(() => {
    if (!unset || !canEdit || !placed) return;
    finishing.current = false;
    openSetup(key);
  }, [key, unset, canEdit, placed]);

  // Set up while open (not run again on a set-up board): by this person, it just closes; by someone else, a toast says so.
  useEffect(() => {
    if (mode !== 'new' || unset) return;
    closeSetup(key);
    if (!finishing.current) notify?.(setUpElsewhere);
    finishing.current = false;
  }, [mode, unset, key, notify, setUpElsewhere]);

  // Someone who may no longer edit (their share changed) loses the dialog.
  useEffect(() => {
    if (mode && !canEdit) closeSetup(key);
  }, [mode, canEdit, key]);

  return {
    mode: canEdit ? mode : null,
    open: () => {
      finishing.current = false;
      openSetup(key);
    },
    close: () => closeSetup(key),
    // Called just before this person's own write that sets it up; the dialog closes with it.
    finish: () => {
      finishing.current = true;
      closeSetup(key);
    },
  };
}
