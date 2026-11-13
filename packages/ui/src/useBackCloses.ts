'use client';

import { useEffect, useRef } from 'react';

// Back closes a sheet that holds work (docs/specs/007-editor/editor-app.md "Back closes a sheet that holds work").
// While `active`, the sheet has an entry in the browser's history, so Back (Android's, an iPhone's swipe, the
// browser's) lands on the page under it and calls `onBack` instead of leaving the page. The sheet takes its entry
// again at once, so one kept open (it asked Discard Changes? and was kept) still has one; one that closes, by Back or
// any other way, steps back off it, so the next Back does what it did before the sheet opened.
//
// Stacked sheets (a step drawer over the rule drawer) each add their token to the entry's list, so a Back closes the
// top one alone: a sheet whose token is still in the list after a Back was not the one Back closed. The history
// state is kept as it was (a router's own fields with it), as the Inbox pane's entry does.

const KEY = 'liveworkspaceSheets';
let made = 0;

const tokensOf = (state: unknown): readonly unknown[] => {
  const list = state && typeof state === 'object' ? (state as Record<string, unknown>)[KEY] : null;
  return Array.isArray(list) ? list : [];
};

export function useBackCloses(active: boolean, onBack: () => void): void {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  }, [onBack]);
  // The sheet's token, kept across an effect that is torn down and run again at once (React's StrictMode does that
  // in development): the step back off the entry waits a task, and a run in between keeps the entry instead.
  const tokenRef = useRef<string | null>(null);
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;
    if (leaving.current !== null) {
      clearTimeout(leaving.current);
      leaving.current = null;
    }
    if (tokenRef.current === null) {
      made += 1;
      tokenRef.current = `sheet-${made}`;
    }
    const token = tokenRef.current;
    const take = () => {
      try {
        const state: unknown = window.history.state;
        const base = state && typeof state === 'object' ? state : {};
        window.history.pushState({ ...base, [KEY]: [...tokensOf(state), token] }, '');
      } catch {
        // A sandboxed frame: Back stays the page's.
      }
    };
    if (tokensOf(window.history.state).at(-1) !== token) take();
    const onPop = () => {
      if (tokensOf(window.history.state).includes(token)) return;
      take();
      latest.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      leaving.current = setTimeout(() => {
        leaving.current = null;
        tokenRef.current = null;
        // Closed some other way while its entry is on top: step back off it. An entry no longer on top (the page
        // went elsewhere) is left alone, so a navigation is never undone.
        if (tokensOf(window.history.state).at(-1) !== token) return;
        try {
          window.history.back();
        } catch {
          // No history to step back through.
        }
      }, 0);
    };
  }, [active]);
}
