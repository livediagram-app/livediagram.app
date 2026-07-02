// The undo-side memory of the activity log (spec/12 §"Client
// behaviour" 2): which log entry, if any, each undoable history step
// emitted. Undo must delete the entry for the step it reverts — and
// ONLY that step's entry.
//
// History snapshots (useDiagramHistory) and log entries are not 1:1:
// plenty of commits push history without emitting (add / delete /
// reorder tab, a checkpoint from a no-op drag), and the debounced
// slider emitters attach one entry to a burst of commits. So the two
// are kept aligned by construction: every history push (commit /
// markCheckpoint) pushes a `null` MARKER here, and an emit fills the
// top marker in. Undo then pops exactly one marker per history pop and
// acts only when it holds an entry — a tab-add undo can no longer
// delete the audit row of an edit that is still on the canvas (the
// drift bug this replaced).
//
// Pure transitions over a plain value, mirroring useDiagramHistory's
// exported kernel; the caller owns the ref. Caps must stay identical
// to the history stack's or the pairing skews.

import type { ChangeLogEntry } from '@livediagram/api-schema';
import { HISTORY_LIMIT } from '@/hooks/canvas/useDiagramHistory';

// One marker per history step: the entry that step emitted, or null.
export type EntryMarker = ChangeLogEntry | null;

export type EntryHistory = {
  past: EntryMarker[];
  future: EntryMarker[];
};

export const emptyEntryHistory = (): EntryHistory => ({ past: [], future: [] });

// Paired with historyCommit / historyMarkCheckpoint: a new step starts
// with no entry, and (like the snapshot stack) invalidates redo.
export function entryHistoryPush(h: EntryHistory): EntryHistory {
  return { past: [...h.past, null].slice(-HISTORY_LIMIT), future: [] };
}

// An emit fills the top marker. If the top step already carries an
// entry (a second emit against one commit) the stack is left alone:
// that entry simply never gets undo-deleted, which is the safe side —
// deleting a wrongly-paired entry destroys audit data, orphaning one
// leaves a stale row the panel can still clear.
export function entryHistoryFill(h: EntryHistory, entry: ChangeLogEntry): EntryHistory {
  if (h.past.length === 0 || h.past[h.past.length - 1] !== null) return h;
  return { ...h, past: [...h.past.slice(0, -1), entry] };
}

// Paired with historyUndo: pop one marker (the step being reverted)
// onto the redo side; `popped` is the entry to delete, if any.
export function entryHistoryUndo(h: EntryHistory): { next: EntryHistory; popped: EntryMarker } {
  if (h.past.length === 0) return { next: h, popped: null };
  const popped = h.past[h.past.length - 1]!;
  return {
    next: {
      past: h.past.slice(0, -1),
      future: [popped, ...h.future].slice(0, HISTORY_LIMIT),
    },
    popped,
  };
}

// Paired with historyRedo: move one marker back; `shifted` is the
// entry to re-append, if any.
export function entryHistoryRedo(h: EntryHistory): { next: EntryHistory; shifted: EntryMarker } {
  if (h.future.length === 0) return { next: h, shifted: null };
  const shifted = h.future[0]!;
  return {
    next: {
      past: [...h.past, shifted].slice(-HISTORY_LIMIT),
      future: h.future.slice(1),
    },
    shifted,
  };
}
