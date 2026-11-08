'use client';

import { useCallback, useState } from 'react';
import { graftLiveTabState, type Tab } from '@livehuddle/document';
import {
  clearedStacks,
  stacksAfterStep,
  stepBack,
  stepForward,
  withRemoteOp,
  type RebasingHistory,
} from '@liveworkspace/workbench/lib/remote-op-log';

// Bounded undo/redo over the tabs array. See docs/specs/008-canvas/canvas-and-palette.md ("Undo / Redo").
//
// Three primitives:
//   commit(mapTabs)         — push current to past, replace present, clear future
//   tick(mapTabs)            — update present only (no history change; for drags)
//   markCheckpoint()         — push current to past without changing present
//                              (use at drag start so undo returns to pre-drag state)
//
// All keep the past stack capped to HISTORY_LIMIT.

// Steps kept in each direction, on every device. Snapshots share unchanged tabs and elements, so a
// step costs about one pointer per element of the changed tab: 500 steps on a 2,000-element board
// measured ~8 MB of heap. Safe range: 1 to ~2,000.
export const HISTORY_LIMIT = 500;

// The stacks take a peer's op lazily (RebasingHistory): logged with the position each snapshot was taken at, and
// applied to a snapshot only when undo, redo or a cancel restores it.
export type History = RebasingHistory<Tab[]> & {};

// Pure transitions on a History value — exported for unit tests.
// The hook wraps them with `setHistory((h) => transition(h, ...))`.

/** True when two objects hold the same values one level down: what a setter that rebuilt an object without
 *  changing anything leaves behind. */
function sameFields(a: object, b: object): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

/** True when `next` changes nothing in `prev`: every tab is the same one, or holds the same fields and the same
 *  elements. A setter maps a fresh array and object even when it writes the value already there (a size box
 *  committed on Enter and again on blur), and that must not become an undo step. Linear in the elements of a
 *  tab the setter touched; untouched tabs and elements match by reference. */
export function sameTabs(prev: Tab[], next: Tab[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  return prev.every((tab, i) => {
    const other = next[i]!;
    if (tab === other) return true;
    const { elements, ...rest } = tab;
    const { elements: otherElements, ...otherRest } = other;
    if (!sameFields(rest, otherRest)) return false;
    if (elements === otherElements) return true;
    if (elements.length !== otherElements.length) return false;
    return elements.every((el, j) => el === otherElements[j] || sameFields(el, otherElements[j]!));
  });
}

export function historyCommit(h: History, mapTabs: (tabs: Tab[]) => Tab[]): History {
  const present = mapTabs(h.present);
  // A commit that changes nothing is not a step (docs/specs/008-canvas/canvas-and-palette.md "Undo / Redo"):
  // pushing it made Undo appear to do nothing and cleared the redo stack.
  if (sameTabs(h.present, present)) return h;
  return {
    ...h,
    ...stacksAfterStep(h, HISTORY_LIMIT),
    present,
  };
}

export function historyTick(h: History, mapTabs: (tabs: Tab[]) => Tab[]): History {
  return { ...h, present: mapTabs(h.present) };
}

export function historyMarkCheckpoint(h: History): History {
  return {
    ...h,
    ...stacksAfterStep(h, HISTORY_LIMIT),
  };
}

// Undo / redo re-graft the LIVE non-undoable state onto the restored
// snapshot: comment threads (docs/specs/008-canvas/canvas-and-palette.md — typing a comment then Ctrl+Z
// mustn't wipe it) AND each Timer and Stopwatch's live clock, `pieceTimer`
// (docs/specs/009-elements/timer-and-stopwatch.md: not undoable, changed by a delta so no snapshot is current on
// it). Restoring a snapshot verbatim silently dropped both (then
// autosave persisted + broadcast the stripped tab to every peer).

export function historyUndo(h: History): History {
  if (h.past.length === 0) return h;
  const { snapshot, stacks } = stepBack(h, HISTORY_LIMIT, true);
  return {
    ...h,
    ...stacks,
    present: graftLiveTabState(h.present, snapshot),
  };
}

// Abort an in-flight gesture: restore the newest snapshot (the
// checkpoint its first mutation pushed) into the present and DISCARD
// that step — unlike undo, nothing lands on the redo side, because a
// cancelled drag never happened. Live comment/session state grafts on
// exactly as undo does.
export function historyCancel(h: History): History {
  if (h.past.length === 0) return h;
  const { snapshot, stacks } = stepBack(h, HISTORY_LIMIT, false);
  return {
    ...h,
    ...stacks,
    present: graftLiveTabState(h.present, snapshot),
  };
}

export function historyRedo(h: History): History {
  if (h.future.length === 0) return h;
  const { snapshot, stacks } = stepForward(h, HISTORY_LIMIT);
  return {
    ...h,
    ...stacks,
    present: graftLiveTabState(h.present, snapshot),
  };
}

export function historyReset(h: History, tabs: Tab[] | ((prev: Tab[]) => Tab[])): History {
  const next = typeof tabs === 'function' ? tabs(h.present) : tabs;
  return { ...clearedStacks<Tab[]>(), present: next };
}

// Replace the present with content from elsewhere (a resync's fetched tabs, a Q&A board's own
// write) WITHOUT touching the undo / redo stacks. A peer's op goes through historyApplyRemoteOp
// instead, so undo never brings back what a peer changed.
export function historyApplyRemote(h: History, tabs: Tab[] | ((prev: Tab[]) => Tab[])): History {
  const next = typeof tabs === 'function' ? tabs(h.present) : tabs;
  return { ...h, present: next };
}

// A peer's (or an agent's) op, applied to the present AND to every undo and redo snapshot
// (docs/specs/012-collaboration/realtime-conflict-resolution.md "Undo"): undo then restores the
// person's own earlier state with the peer's change still in it, so it takes back only their own
// edits, never a collaborator's (a peer's element, a tab they added). The present takes it now; the
// snapshots take it when one is restored (withRemoteOp), so an op costs one pass over the present
// however deep the history, and the snapshots keep sharing their tabs. `apply` is the pure op
// (applyRoomOpToTabs), returning its input when the op changes nothing there.
export function historyApplyRemoteOp(h: History, apply: (tabs: Tab[]) => Tab[]): History {
  return withRemoteOp(h, apply);
}

type DocumentHistory = {
  tabs: Tab[];
  canUndo: boolean;
  canRedo: boolean;
  commit: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  tick: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  markCheckpoint: () => void;
  cancelToCheckpoint: () => void;
  reset: (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => void;
  applyRemote: (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => void;
  // A peer's op, into the present and every undo / redo snapshot (historyApplyRemoteOp).
  applyRemoteOp: (apply: (tabs: Tab[]) => Tab[]) => void;
  undo: () => void;
  redo: () => void;
};

export function useDocumentHistory(initialTabs: Tab[]): DocumentHistory {
  const [history, setHistory] = useState<History>({
    past: [],
    present: initialTabs,
    future: [],
  });

  const commit = (mapTabs: (tabs: Tab[]) => Tab[]) => {
    setHistory((h) => historyCommit(h, mapTabs));
  };

  // Stable identity: the delta sender (useElementDeltas) memoises on it.
  const tick = useCallback((mapTabs: (tabs: Tab[]) => Tab[]) => {
    setHistory((h) => historyTick(h, mapTabs));
  }, []);

  const markCheckpoint = () => {
    setHistory(historyMarkCheckpoint);
  };

  const undo = () => {
    setHistory(historyUndo);
  };

  // Abort-to-checkpoint for Escape during a drag (see historyCancel).
  const cancelToCheckpoint = () => {
    setHistory(historyCancel);
  };

  const redo = () => {
    setHistory(historyRedo);
  };

  // Replace the present tab list with `tabs` and CLEAR history. For
  // genuine context switches (hydrating on mount, opening a different
  // document, loading a tab) where prior undo states no longer apply.
  // Remote peer merges use `applyRemote` instead, to keep history.
  // Stable identity (setHistory never changes): the per-tab load effect
  // (usePerTabLoad) reaches this through resetTabs, and a fresh function
  // every render once made that effect refetch a failed tab on every
  // re-render (docs/specs/017-telemetry/telemetry.md).
  const reset = useCallback((tabs: Tab[] | ((prev: Tab[]) => Tab[])) => {
    setHistory((h) => historyReset(h, tabs));
  }, []);

  // Merge a remote peer's change into the present, preserving undo/redo.
  const applyRemote = (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => {
    setHistory((h) => historyApplyRemote(h, tabs));
  };

  // Stable: the room's op handler and the changeset feed hold it.
  const applyRemoteOp = useCallback((apply: (tabs: Tab[]) => Tab[]) => {
    setHistory((h) => historyApplyRemoteOp(h, apply));
  }, []);

  return {
    tabs: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    commit,
    tick,
    markCheckpoint,
    cancelToCheckpoint,
    reset,
    applyRemote,
    applyRemoteOp,
    undo,
    redo,
  };
}
