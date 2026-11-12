'use client';

import { useEffect } from 'react';

// The page's own title while the error card shows (liveworkspace/docs/specs/010-site/site.md "Behaviour"). Set on the
// document rather than rendered as a <title>: the failed page's metadata title is already in the head, and the first
// <title> is the one a tab shows. Light on purpose: the plain card that stands in when the card's code can't load
// (LazyPageError.tsx) is in every page's first load and uses it too.
export const PAGE_ERROR_TITLE = 'Something went wrong · liveworkspace';
let shown = 0;
let titleBefore = '';

/** Holds the error title on the document while the calling card is mounted, and puts the page's own back after. */
export function usePageErrorTitle() {
  useEffect(() => {
    // Counted, since Next can mount the card again before the first one goes: the page's own title comes back only
    // when the last one does (Try Again that works).
    if (shown++ === 0) titleBefore = document.title;
    const claim = () => {
      if (document.title !== PAGE_ERROR_TITLE) document.title = PAGE_ERROR_TITLE;
    };
    claim();
    // The failed page's metadata <title> is React's, and its next commit writes the old words back: held while shown.
    const watch = new MutationObserver(claim);
    watch.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      watch.disconnect();
      if (--shown === 0) document.title = titleBefore;
    };
  }, []);
}
