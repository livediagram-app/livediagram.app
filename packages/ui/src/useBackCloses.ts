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
//
// Tokens carry this page load's own id: the history state outlives a reload, so a counter alone could name a new
// sheet after an old entry's token, and that sheet then took no entry of its own or heard a Back as not its own. The
// step back off closed sheets' entries is one shared pass a task after the last close, so sheets that close together
// (the rule drawer with its step drawer over it) leave none of their entries behind.

const KEY = 'liveworkspaceSheets';
const LOAD = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
let made = 0;
// The tokens of the sheets open now.
const live = new Set<string>();
let stepping: ReturnType<typeof setTimeout> | null = null;

const tokensOf = (state: unknown): readonly unknown[] => {
  const list = state && typeof state === 'object' ? (state as Record<string, unknown>)[KEY] : null;
  return Array.isArray(list) ? list : [];
};

// A token of a sheet this page load opened and has since closed.
const closed = (token: unknown) =>
  typeof token === 'string' && token.startsWith(`sheet-${LOAD}-`) && !live.has(token);

// Steps back off the entries of this page's closed sheets at the top of history, one entry per token. A token that
// is not a closed sheet's (the page went elsewhere, or a sheet is still open on it) stops the walk, so a navigation
// is never undone.
function stepOffClosed(): void {
  if (stepping !== null) return;
  stepping = setTimeout(() => {
    stepping = null;
    const list = tokensOf(window.history.state);
    let count = 0;
    while (count < list.length && closed(list[list.length - 1 - count])) count += 1;
    if (count === 0) return;
    try {
      window.history.go(-count);
    } catch {
      // No history to step back through.
    }
  }, 0);
}

export function useBackCloses(active: boolean, onBack: () => void): void {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  }, [onBack]);
  // The sheet's token, one for the hook's life: an effect torn down and run again at once (React's StrictMode does
  // that in development) is live again before the shared step back looks, so it keeps its entry.
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    if (tokenRef.current === null) {
      made += 1;
      tokenRef.current = `sheet-${LOAD}-${made}`;
    }
    const token = tokenRef.current;
    live.add(token);
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
      live.delete(token);
      stepOffClosed();
    };
  }, [active]);
}
