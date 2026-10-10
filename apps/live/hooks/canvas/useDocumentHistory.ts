'use client';

import { useCallback, useState } from 'react';
import { graftLiveTabState, type Tab } from '@livediagram/document';

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

export type History = {
  past: Tab[][];
  present: Tab[];
  future: Tab[][];
  // How many steps lie behind the present, uncapped (the cap drops the oldest snapshots, never
  // this count), and which branch of edits the present is on (raised by every new step, which
  // clears redo). Item undo steps sit between snapshots by these two counters
  // (docs/specs/026-plan/items.md "Undo"; useItemUndo). Absent = 0.
  depth?: number;
  branch?: number;
};

const depthOf = (h: History) => h.depth ?? 0;
const branchOf = (h: History) => h.branch ?? 0;

// Pure transitions on a History value — exported for unit tests.
// The hook wraps them with `setHistory((h) => transition(h, ...))`.

export function historyCommit(h: History, mapTabs: (tabs: Tab[]) => Tab[]): History {
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: mapTabs(h.present),
    future: [],
    depth: depthOf(h) + 1,
    branch: branchOf(h) + 1,
  };
}

export function historyTick(h: History, mapTabs: (tabs: Tab[]) => Tab[]): History {
  return { ...h, present: mapTabs(h.present) };
}

export function historyMarkCheckpoint(h: History): History {
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: h.present,
    future: [],
    depth: depthOf(h) + 1,
    branch: branchOf(h) + 1,
  };
}

// A new step that is not a snapshot (an item change, useItemUndo): the redo side is gone.
export function historyClearRedo(h: History): History {
  return { ...h, future: [], branch: branchOf(h) + 1 };
}

// Undo / redo re-graft the LIVE non-undoable state onto the restored
// snapshot: comment threads (docs/specs/008-canvas/canvas-and-palette.md — typing a comment then Ctrl+Z
// mustn't wipe it) AND the session tools' `timer` / `vote` tab fields
// (docs/specs/012-collaboration/session-tools.md — not undoable, mutated via tick so no snapshot ever holds
// them). Restoring a snapshot verbatim silently dropped both (then
// autosave persisted + broadcast the stripped tab to every peer).

export function historyUndo(h: History): History {
  if (h.past.length === 0) return h;
  const prev = h.past[h.past.length - 1]!;
  return {
    past: h.past.slice(0, -1),
    present: graftLiveTabState(h.present, prev),
    future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
    depth: depthOf(h) - 1,
    branch: branchOf(h),
  };
}

// Abort an in-flight gesture: restore the newest snapshot (the
// checkpoint its first mutation pushed) into the present and DISCARD
// that step — unlike undo, nothing lands on the redo side, because a
// cancelled drag never happened. Live comment/session state grafts on
// exactly as undo does.
export function historyCancel(h: History): History {
  if (h.past.length === 0) return h;
  const prev = h.past[h.past.length - 1]!;
  return {
    past: h.past.slice(0, -1),
    present: graftLiveTabState(h.present, prev),
    future: h.future,
    depth: depthOf(h) - 1,
    branch: branchOf(h),
  };
}

export function historyRedo(h: History): History {
  if (h.future.length === 0) return h;
  const next = h.future[0]!;
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: graftLiveTabState(h.present, next),
    future: h.future.slice(1),
    depth: depthOf(h) + 1,
    branch: branchOf(h),
  };
}

export function historyReset(h: History, tabs: Tab[] | ((prev: Tab[]) => Tab[])): History {
  const next = typeof tabs === 'function' ? tabs(h.present) : tabs;
  return { past: [], present: next, future: [], depth: 0, branch: branchOf(h) + 1 };
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
// edits, never a collaborator's (a peer's element, a tab they added). `apply` is the pure op
// (applyRoomOpToTabs), returning its input when the op changes nothing there, so an untouched
// snapshot keeps its identity and nothing re-renders for it.
export function historyApplyRemoteOp(h: History, apply: (tabs: Tab[]) => Tab[]): History {
  const present = apply(h.present);
  let changed = present !== h.present;
  const each = (stack: Tab[][]) => {
    let moved = false;
    const out = stack.map((tabs) => {
      const next = apply(tabs);
      if (next !== tabs) moved = true;
      return next;
    });
    if (moved) changed = true;
    return moved ? out : stack;
  };
  const past = each(h.past);
  const future = each(h.future);
  return changed ? { ...h, present, past, future } : h;
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
  // The counters item undo steps are placed by (useItemUndo).
  depth: number;
  branch: number;
  futureLength: number;
  clearRedo: () => void;
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

  // Stable: useItemUndo calls it from item writes.
  const clearRedo = useCallback(() => {
    setHistory(historyClearRedo);
  }, []);

  return {
    depth: depthOf(history),
    branch: branchOf(history),
    futureLength: history.future.length,
    clearRedo,
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
