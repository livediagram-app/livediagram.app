'use client';

import { useEffect, useRef } from 'react';

// Fire `onRestore` when Back (or Forward) brings this page out of the browser's back/forward cache.
// A button that leads to another page stays busy until the browser has left (busy-buttons.md), and the
// cache keeps the page as it was at that moment: without this, coming Back shows it still busy, for
// good. The handler clears what the press set. Captured through a ref, like useEscape.
export function usePageRestore(onRestore: () => void): void {
  const cbRef = useRef(onRestore);
  useEffect(() => {
    cbRef.current = onRestore;
  });

  useEffect(() => {
    const handler = (event: PageTransitionEvent) => {
      if (event.persisted) cbRef.current();
    };
    window.addEventListener('pageshow', handler);
    return () => window.removeEventListener('pageshow', handler);
  }, []);
}
