'use client';

import { useEffect } from 'react';

// Holds the browser tab's title at `title` while the page shows it (each product's offline-mode.md "The tab title").
// A plain `document.title =` in an effect is not enough: Next.js commits the route's metadata <title> after the page
// has named itself and writes the static title back over it. A form link's page reads its form in about 100ms, and a
// warm open names the item from its last seen copy before the static export's not-found route (which serves every
// item address) commits, so without this the tab kept the bare brand ("livehuddle") for the whole visit. So the head
// is watched while anything holds a title, and the title put back whenever something else rewrites it.
//
// Several holders can be mounted at once: the editor page names its item, and a status screen it shows in place of
// the item (not found, archived, deleted, a load error, each product's 007-editor/new-document-route.md "The tab
// title") names that instead (`status`), so a missing item's tab never reads as an empty one. A status holder beats
// an item's; among equals the latest mounted wins. One observer for them all; its callback writes only when the
// title differs. null holds nothing.

type Holder = { title: string; status: boolean };

const holders = new Set<Holder>();
let observer: MutationObserver | null = null;

// The title the holders ask for: the latest status holder's, else the latest holder's. Only asked while a holder is
// mounted: the observer disconnects when the last one goes, which also drops its queued records.
function wanted(): string {
  let pick: Holder | null = null;
  for (const holder of holders) if (holder.status || !pick?.status) pick = holder;
  return pick!.title;
}

function apply(): void {
  const title = wanted();
  if (document.title !== title) document.title = title;
}

export function useBrowserTabTitle(title: string | null, options: { status?: boolean } = {}): void {
  const status = options.status === true;
  useEffect(() => {
    if (title === null) return;
    const holder: Holder = { title, status };
    holders.add(holder);
    if (!observer) {
      observer = new MutationObserver(apply);
      observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    }
    apply();
    return () => {
      holders.delete(holder);
      if (holders.size > 0) {
        apply();
        return;
      }
      observer?.disconnect();
      observer = null;
    };
  }, [title, status]);
}
