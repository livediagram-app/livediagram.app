'use client';

import { useEffect } from 'react';

// Holds the browser tab's title at `title` while the page shows it (each product's offline-mode.md "The tab title").
// A plain `document.title =` in an effect is not enough: Next.js commits the route's metadata <title> after the page
// has named itself and writes the static title back over it. A form link's page reads its form in about 100ms, and a
// warm open names the item from its last seen copy before the static export's not-found route (which serves every
// item address) commits, so without this the tab kept the bare brand ("livehuddle") for the whole visit. So the head
// is watched while mounted, and the title put back whenever something else rewrites it. One observer; its callback
// writes only when the title differs. null leaves the title alone.
export function useBrowserTabTitle(title: string | null): void {
  useEffect(() => {
    if (title === null) return;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
}
