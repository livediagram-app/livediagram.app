'use client';

// The lens's live region (liveplanner/docs/specs/013-workspace/explorer-filters.md "Accessibility"), in the first load
// with the lists: it must be in the page before the lens changes for the change to be spoken. The chips and the
// filtered list's empty card load from their own chunk (lazy-lens.tsx).

import { useEffect, useRef, useState } from 'react';
import { announceResults, LENS_SETTLE_MS } from '../lens';
import type { Words } from '../words';

/**
 * The polite live region that says how many items the lens left, once the list for a changed lens has loaded and
 * LENS_SETTLE_MS has passed. Silent on arrival: opening a view is not a change.
 */
export function LensAnnouncer({
  lens,
  loading,
  shown,
  more,
  words,
}: {
  lens: string;
  loading: boolean;
  shown: number;
  more: boolean;
  words: Words;
}) {
  const [message, setMessage] = useState('');
  // The lens the view arrived with; null once it has changed, so changing back speaks too.
  const arrived = useRef<string | null>(lens);
  const counts = useRef({ shown, more, words });
  counts.current = { shown, more, words };
  useEffect(() => {
    if (lens === arrived.current || loading) return;
    arrived.current = null;
    const timer = setTimeout(() => {
      const { shown, more, words } = counts.current;
      setMessage(announceResults(shown, more, words));
    }, LENS_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [lens, loading]);
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
