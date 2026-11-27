'use client';

// Page Health's score while a page's own read is on its way (docs/specs/030-knowledgebase/page-surface.md "Switching
// pages"). Until `page.health` arrives the score leaves out what it cannot see (backlinks and reads count as full), so
// opening a page showed a figure a point or two off for a few frames before the read landed (42, 43, 42). Held, the
// score stays on the one last shown until this page's read is here, and changes once. A read that never lands lets go
// after RAIL_HOLD_MAX_MS, as the rail's own hold does (loaded-page-store.ts).
import { useEffect, useState } from 'react';
import { RAIL_HOLD_MAX_MS } from './loaded-page-store';

/** `value` once `read` is true for `pageId` (or the wait has run out); until then the value last shown. */
export function useHeldUntilRead<T>(value: T, read: boolean, pageId: string): T {
  const [shown, setShown] = useState(value);
  const [expiredFor, setExpiredFor] = useState<string | null>(null);
  useEffect(() => {
    if (read) return;
    const timer = setTimeout(() => setExpiredFor(pageId), RAIL_HOLD_MAX_MS);
    return () => clearTimeout(timer);
  }, [read, pageId]);
  const follow = read || expiredFor === pageId;
  // The value shown is kept in state, set while rendering when it moves (React's "storing information from previous
  // renders"), so the hold costs no extra commit.
  if (follow && shown !== value) setShown(value);
  return follow ? value : shown;
}
