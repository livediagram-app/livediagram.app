'use client';

// An app's old This Browser page (`/offline`): what it listed is the Explorer's This Browser view now
// (`/explorer/offline`, liveworkspace/docs/specs/004-index/one-explorer.md "This Browser"), so the page only sends people there, its
// query and hash kept, the history entry replaced so Back never lands on it again. A Take Offline or Sync an older
// link still asks for (`?convert=…&item=…`) goes on from there to the app's editor (ThisBrowser.tsx).

import { useEffect } from 'react';

export const THIS_BROWSER_VIEW_PATH = '/explorer/offline';

/** Where an address under `/offline` goes: the Explorer's This Browser view, with the same query and hash. */
export function thisBrowserViewHref(location: Pick<Location, 'search' | 'hash'>): string {
  return `${THIS_BROWSER_VIEW_PATH}${location.search}${location.hash}`;
}

export function OfflineRedirect() {
  useEffect(() => {
    window.location.replace(thisBrowserViewHref(window.location));
  }, []);
  return (
    <p role="status" className="sr-only">
      Opening This Browser in the Explorer…
    </p>
  );
}
