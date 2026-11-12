'use client';

import { useEffect, type RefObject } from 'react';
import { backOutTarget } from '../../lib/back-out';
import { debugLog } from '../../lib/debug-log';

// /new on a back/forward-cache restore (docs/specs/007-editor/new-document-route.md): /new creates as it mounts,
// so a restore would either strand the person on a frozen "Creating…" screen or (re-firing the create) trap Back
// behind a page that always navigates forward again. It backs out to the page that opened /new instead, or home.
// `handedOff` is set once the new item IS the editor, which then stands this down.
export function useBackOutOnRestore(handedOff: RefObject<boolean>): void {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted || handedOff.current) return;
      const target = backOutTarget({
        referrer: document.referrer,
        origin: window.location.origin,
        historyLength: window.history.length,
      });
      debugLog(`[new] restored, back out ${target}`);
      if (target === 'back') window.history.back();
      else window.location.replace('/');
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [handedOff]);
}
