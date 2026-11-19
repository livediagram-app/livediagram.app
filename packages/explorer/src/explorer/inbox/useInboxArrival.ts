'use client';

// The Inbox arrived at from a notice, and the Inbox as read (inbox-notices.md "How a notice goes away"):
//
//   - `useInboxAt`: `?at=<row key>` on the address, read once; when the list first holds that row it is revealed (the
//     pane chosen, or opened where it stands in for the list). The address is left as it was.
//   - `useListedSeen`: while the list is on screen (the tab in view), every row it lists is seen and gone for this
//     person in this browser, so no notice tells of it again and one still showing it closes, in every tab.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { seenStoreFor } from '../../inbox-notices/seen';
import type { InboxEntry } from './sections';

export const INBOX_AT_PARAM = 'at';

function readAtParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get(INBOX_AT_PARAM) || null;
  } catch {
    return null;
  }
}

export function useInboxAt(entries: readonly InboxEntry[], reveal: (entry: InboxEntry) => void) {
  // undefined: not read yet; null: nothing asked, or already revealed.
  const wanted = useRef<string | null | undefined>(undefined);
  const latest = useRef(reveal);
  latest.current = reveal;
  useEffect(() => {
    if (wanted.current === undefined) wanted.current = readAtParam();
    const key = wanted.current;
    if (!key) return;
    const entry = entries.find((e) => e.key === key);
    if (!entry) return;
    wanted.current = null;
    latest.current(entry);
  }, [entries]);
}

const visibleNow = () => document.visibilityState !== 'hidden';
function subscribeVisibility(listener: () => void) {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
}

export function useListedSeen(entries: readonly InboxEntry[], viewerId: string | null) {
  const visible = useSyncExternalStore(subscribeVisibility, visibleNow, () => false);
  useEffect(() => {
    if (!viewerId || !visible || entries.length === 0) return;
    seenStoreFor(viewerId).mark(
      entries.map((e) => ({ key: e.key, at: e.at })),
      true,
    );
  }, [entries, viewerId, visible]);
}
