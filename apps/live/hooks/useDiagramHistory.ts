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

const HISTORY_LIMIT = 3;

type History = {
  past: Tab[][];
  present: Tab[];
  future: Tab[][];
};

export type DiagramHistory = {
  tabs: Tab[];
  canUndo: boolean;
  canRedo: boolean;
  commit: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  tick: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  markCheckpoint: () => void;
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
    setHistory((h) => ({
      past: [...h.past, h.present].slice(-HISTORY_LIMIT),
      present: mapTabs(h.present),
      future: [],
    }));
  };

  const tick = (mapTabs: (tabs: Tab[]) => Tab[]) => {
    setHistory((h) => ({ ...h, present: mapTabs(h.present) }));
  };

  const markCheckpoint = () => {
    setHistory((h) => ({
      past: [...h.past, h.present].slice(-HISTORY_LIMIT),
      present: h.present,
      future: [],
    }));
  };

  const undo = () => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1]!;
      return {
        past: h.past.slice(0, -1),
        present: prev,
        future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
      };
    });
  };

  const redo = () => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[0]!;
      return {
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: next,
        future: h.future.slice(1),
      };
    });
  };

  return {
    tabs: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    commit,
    tick,
    markCheckpoint,
    undo,
    redo,
  };
}
