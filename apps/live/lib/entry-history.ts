// The undo-side memory of the activity log (spec/12 §"Client
// behaviour" 2): which log entry, if any, each undoable history step
// emitted. Undo must delete the entry for the step it reverts — and
// ONLY that step's entry.
//
// History snapshots (useDiagramHistory) and log entries are not 1:1:
// plenty of commits push history without emitting (add / delete /
// reorder tab, a checkpoint from a no-op drag), and the debounced
// emitters attach one entry to a whole gesture up to 500ms after it
// settled. So the two are kept aligned by construction: every history
// push (commit / markCheckpoint) pushes a token-stamped `null` MARKER
// here, and an emit fills its own step's marker in — by token for the
// debounced emitters (whose flush can land after OTHER steps were
// pushed; filling the top blindly glued the entry onto an unrelated
// step, whose undo then deleted the wrong audit row), or the newest
// marker for the immediate commit-then-emit path. Undo then pops
// exactly one marker per history pop and acts only when it holds an
// entry.
//
// Pure transitions over a plain value, mirroring useDiagramHistory's
// exported kernel; the caller owns the ref AND mints the tokens (a
// monotonic counter — uniqueness within the session is all that
// matters). Caps must stay identical to the history stack's or the
// pairing skews; an evicted or undone marker simply makes a late fill
// a no-op, which is the safe side (an orphaned log row beats deleting
// a wrongly-paired one).

import type { ChangeLogEntry } from '@livediagram/api-schema';
import { HISTORY_LIMIT } from '@/hooks/canvas/useDiagramHistory';

// One marker per history step: the entry that step emitted (or null),
// stamped with the caller-minted token that names the step.
export type EntryMarker = ChangeLogEntry | null;
type MarkerSlot = { token: number; entry: EntryMarker };

export type EntryHistory = {
  past: MarkerSlot[];
  future: MarkerSlot[];
};

export const emptyEntryHistory = (): EntryHistory => ({ past: [], future: [] });

// Paired with historyCommit / historyMarkCheckpoint: a new step starts
// with no entry, and (like the snapshot stack) invalidates redo.
export function entryHistoryPush(h: EntryHistory, token: number): EntryHistory {
  return { past: [...h.past, { token, entry: null }].slice(-HISTORY_LIMIT), future: [] };
}

// An emit fills its step's marker. With a `token`, the target is that
// exact step wherever it sits in `past` (the debounced-flush case);
// without one, the newest step (the immediate commit-then-emit case).
// A target that already carries an entry, was undone (moved to
// `future`), or was evicted by the cap is left alone: that entry simply
// never gets undo-deleted, which is the safe side — deleting a
// wrongly-paired entry destroys audit data, orphaning one leaves a
// stale row the panel can still clear.
export function entryHistoryFill(
  h: EntryHistory,
  entry: ChangeLogEntry,
  token?: number,
): EntryHistory {
  const index =
    token === undefined ? h.past.length - 1 : h.past.findIndex((s) => s.token === token);
  if (index < 0 || h.past[index]!.entry !== null) return h;
  const past = [...h.past];
  past[index] = { token: past[index]!.token, entry };
  return { ...h, past };
}

// Paired with historyUndo: pop one marker (the step being reverted)
// onto the redo side; `popped` is the entry to delete, if any.
export function entryHistoryUndo(h: EntryHistory): { next: EntryHistory; popped: EntryMarker } {
  if (h.past.length === 0) return { next: h, popped: null };
  const slot = h.past[h.past.length - 1]!;
  return {
    next: {
      past: h.past.slice(0, -1),
      future: [slot, ...h.future].slice(0, HISTORY_LIMIT),
    },
    popped: slot.entry,
  };
}

// Paired with historyCancel (Escape aborts an in-flight gesture):
// drop the newest marker outright — the cancelled step never happened,
// so nothing moves to the redo side. The marker is null in practice
// (the gesture's debounced log entry hasn't flushed yet, and after the
// restore its diff is empty so it never will).
export function entryHistoryCancel(h: EntryHistory): EntryHistory {
  if (h.past.length === 0) return h;
  return { ...h, past: h.past.slice(0, -1) };
}

// Paired with historyRedo: move one marker back; `shifted` is the
// entry to re-append, if any.
export function entryHistoryRedo(h: EntryHistory): { next: EntryHistory; shifted: EntryMarker } {
  if (h.future.length === 0) return { next: h, shifted: null };
  const slot = h.future[0]!;
  return {
    next: {
      past: [...h.past, slot].slice(-HISTORY_LIMIT),
      future: h.future.slice(1),
    },
    shifted: slot.entry,
  };
}
