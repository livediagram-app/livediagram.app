'use client';

import { useState } from 'react';
import type { Tab } from '@livediagram/diagram';

// Bounded undo/redo over the tabs array. See specs/09 ("Undo / Redo").
//
// Three primitives:
//   commit(mapTabs)         — push current to past, replace present, clear future
//   tick(mapTabs)            — update present only (no history change; for drags)
//   markCheckpoint()         — push current to past without changing present
//                              (use at drag start so undo returns to pre-drag state)
//
// All keep the past stack capped to HISTORY_LIMIT.

export const HISTORY_LIMIT = 3;

export type History = {
  past: Tab[][];
  present: Tab[];
  future: Tab[][];
};

// Pure transitions on a History value — exported for unit tests.
// The hook wraps them with `setHistory((h) => transition(h, ...))`.

export function historyCommit(h: History, mapTabs: (tabs: Tab[]) => Tab[]): History {
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: mapTabs(h.present),
    future: [],
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
  };
}

export function historyUndo(h: History): History {
  if (h.past.length === 0) return h;
  const prev = h.past[h.past.length - 1]!;
  return {
    past: h.past.slice(0, -1),
    present: prev,
    future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
  };
}

export function historyRedo(h: History): History {
  if (h.future.length === 0) return h;
  const next = h.future[0]!;
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: next,
    future: h.future.slice(1),
  };
}

export function historyReset(h: History, tabs: Tab[] | ((prev: Tab[]) => Tab[])): History {
  const next = typeof tabs === 'function' ? tabs(h.present) : tabs;
  return { past: [], present: next, future: [] };
}

// Merge a remote peer's change into the present WITHOUT touching the
// undo / redo stacks. Used by inbound `tab` / `diagram-meta` ops: peers
// autosave ~every 600ms, so clearing history on each (what `reset` did)
// made the local user's undo stack vanish several times a second during
// any shared session. The retained past states predate the remote
// change, so undoing far enough can locally drop a peer's edit — an
// accepted limitation of last-write-wins collab without OT / CRDT, and
// far better than undo not working at all while someone else is editing.
export function historyApplyRemote(h: History, tabs: Tab[] | ((prev: Tab[]) => Tab[])): History {
  const next = typeof tabs === 'function' ? tabs(h.present) : tabs;
  return { ...h, present: next };
}

type DiagramHistory = {
  tabs: Tab[];
  canUndo: boolean;
  canRedo: boolean;
  commit: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  tick: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  markCheckpoint: () => void;
  reset: (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => void;
  applyRemote: (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => void;
  undo: () => void;
  redo: () => void;
};

export function useDiagramHistory(initialTabs: Tab[]): DiagramHistory {
  const [history, setHistory] = useState<History>({
    past: [],
    present: initialTabs,
    future: [],
  });

  const commit = (mapTabs: (tabs: Tab[]) => Tab[]) => {
    setHistory((h) => historyCommit(h, mapTabs));
  };

  const tick = (mapTabs: (tabs: Tab[]) => Tab[]) => {
    setHistory((h) => historyTick(h, mapTabs));
  };

  const markCheckpoint = () => {
    setHistory(historyMarkCheckpoint);
  };

  const undo = () => {
    setHistory(historyUndo);
  };

  const redo = () => {
    setHistory(historyRedo);
  };

  // Replace the present tab list with `tabs` and CLEAR history. For
  // genuine context switches (hydrating on mount, opening a different
  // diagram, loading a tab) where prior undo states no longer apply.
  // Remote peer merges use `applyRemote` instead, to keep history.
  const reset = (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => {
    setHistory((h) => historyReset(h, tabs));
  };

  // Merge a remote peer's change into the present, preserving undo/redo.
  const applyRemote = (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => {
    setHistory((h) => historyApplyRemote(h, tabs));
  };

  return {
    tabs: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    commit,
    tick,
    markCheckpoint,
    reset,
    applyRemote,
    undo,
    redo,
  };
}
