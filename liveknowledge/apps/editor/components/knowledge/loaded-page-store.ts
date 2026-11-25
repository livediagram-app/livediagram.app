'use client';

// What the right rail reads while pages switch (docs/specs/030-knowledgebase/page-surface.md "Switching pages"): the
// editor's chrome store, held on the last page whose content had loaded until the next page's has. Opening a page
// that is still loading showed the rail an empty page for a few frames (its Page Health score dipped, 43 to 40 and
// back, and On This Page emptied and refilled), which read as a flicker; held, the rail changes once, in place, to the
// new page's figures. A load that never lands lets go after RAIL_HOLD_MAX_MS, so the rail never stays on another page.
import { useEffect, useState } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import {
  useEditorChromeStore,
  type EditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';

/** Longest the rail stays on the page before while the open page loads (ms). */
export const RAIL_HOLD_MAX_MS = 1000;

type Loaded = Pick<EditorContextValue, 'activeId' | 'loadedTabIds'>;

/** Whether the open page's content is here: fetched, seeded or made in this browser. A store that does not track
 *  loads (a test's, a preview's) always has it. */
export const openPageLoaded = (v: Loaded): boolean => {
  const loaded = v.loadedTabIds as ReadonlySet<string> | undefined;
  return loaded === undefined || loaded.has(v.activeId);
};

export type LoadedPageStore = EditorChromeStore & {
  /** Follows the live store; returns the unfollow. */
  connect: () => () => void;
};

export function createLoadedPageStore(live: EditorChromeStore): LoadedPageStore {
  const listeners = createListeners();
  let lastLoaded: EditorContextValue | null = null;
  let current = live.get();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let expired = false;
  const stopTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const read = () => {
    const now = live.get();
    let next = now;
    if (openPageLoaded(now)) {
      stopTimer();
      expired = false;
      lastLoaded = now;
    } else if (lastLoaded && !expired) {
      // Still the page before: the open one has not loaded yet.
      next = lastLoaded;
      timer ??= setTimeout(() => {
        timer = null;
        expired = true;
        read();
      }, RAIL_HOLD_MAX_MS);
    }
    if (next === current) return;
    current = next;
    listeners.notify();
  };
  read();
  return {
    get: () => current,
    set: (value) => live.set(value),
    subscribe: listeners.subscribe,
    connect: () => {
      const off = live.subscribe(read);
      read();
      return () => {
        off();
        stopTimer();
      };
    },
  };
}

/** The held store for the rail, made once per rail and following the editor's while it is mounted. */
export function useLoadedPageStore(): EditorChromeStore {
  const live = useEditorChromeStore();
  const [held] = useState(() => createLoadedPageStore(live));
  useEffect(() => held.connect(), [held]);
  return held;
}
