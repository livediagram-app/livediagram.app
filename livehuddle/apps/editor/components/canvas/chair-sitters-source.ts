'use client';

// Who sits in each chair, read by the chair itself (docs/specs/008-canvas/canvas-performance.md "Walking renders the
// characters, not the canvas"). The canvas hands every element view one source that never changes, and each piece
// that seats people subscribes to its own row. Somebody sitting down or standing up then re-renders the chairs whose
// sitters changed, never every element on the board: a fresh `sittersOf` function each time cost a whole-board render
// per sit, two long tasks a walk round Team Pod on a slowed phone (Work Tracker 1185).
import { useSyncExternalStore } from 'react';
import { sameSitterList, type Sitter } from '@livehuddle/avatar/chair-sitters';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export type SittersSource = {
  /** This chair's sitters: the same array until they change, and one shared empty array for an empty chair. */
  get: (chairId: string) => Sitter[];
  subscribe: (listener: () => void) => () => void;
};

export type WritableSittersSource = SittersSource & {
  /** The board's sitters now; each chair whose sitters read the same keeps its array, so it does not re-render. */
  set: (next: ReadonlyMap<string, Sitter[]>) => void;
};

const NO_SITTERS: Sitter[] = [];

export function createSittersSource(): WritableSittersSource {
  let rows: ReadonlyMap<string, Sitter[]> = new Map();
  const listeners = createListeners();
  return {
    get: (chairId) => rows.get(chairId) ?? NO_SITTERS,
    subscribe: listeners.subscribe,
    set(next) {
      let changed = next.size !== rows.size;
      const kept = new Map<string, Sitter[]>();
      for (const [chairId, list] of next) {
        const before = rows.get(chairId);
        if (before && sameSitterList(before, list)) kept.set(chairId, before);
        else {
          kept.set(chairId, list);
          changed = true;
        }
      }
      rows = kept;
      if (changed) listeners.notify();
    },
  };
}

const noSubscribe = () => () => {};
const none = () => NO_SITTERS;

/** One chair's sitters from the source, re-rendering only when they change; none without a source (a preview). */
export function useChairSitters(source: SittersSource | undefined, chairId: string): Sitter[] {
  return useSyncExternalStore(
    source ? source.subscribe : noSubscribe,
    source ? () => source.get(chairId) : none,
    none,
  );
}
