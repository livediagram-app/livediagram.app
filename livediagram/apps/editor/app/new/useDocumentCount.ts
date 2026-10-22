import { useCallback, useRef } from 'react';

// How long a create waits for the document count before it goes ahead without it (no tour offer).
// The count's fetch starts once identity settles, which the create has already waited out, so this
// only covers the list request itself; 3 s is well past a slow connection's round trip.
export const DOCUMENT_COUNT_WAIT_MS = 3000;

// How many documents the person had before this visit created one (docs/specs/007-editor/editor-tour.md
// "Where it appears"): reported once by RecentDocumentsCard's fetch, and awaited by the create, which decides
// the Diagram tour's offer from it. Read before the create, never after: a count taken once the new document
// exists says 1, and a brand-new person would lose the tour. Only the first report counts, for the same reason
// (the card re-reads the list when a Drive change lands).
export function useDocumentCount() {
  const known = useRef<number | null>(null);
  const waiters = useRef<((n: number) => void)[]>([]);

  const report = useCallback((n: number) => {
    if (known.current !== null) return;
    known.current = n;
    for (const wake of waiters.current) wake(n);
    waiters.current = [];
  }, []);

  /** The count once reported, or null if it has not arrived within `waitMs`. */
  const settled = useCallback((waitMs: number = DOCUMENT_COUNT_WAIT_MS): Promise<number | null> => {
    if (known.current !== null || waitMs <= 0) return Promise.resolve(known.current);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        waiters.current = waiters.current.filter((w) => w !== wake);
        resolve(null);
      }, waitMs);
      const wake = (n: number) => {
        clearTimeout(timer);
        resolve(n);
      };
      waiters.current.push(wake);
    });
  }, []);

  return { report, settled };
}
