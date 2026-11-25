'use client';

import { useEffect, useState } from 'react';
import type { IndexClient, Item } from '@liveworkspace/index-client';

const NO_PASSWORD = () => null;

export type OpenItemOptions = {
  // The editor's word that the item is kept only in this browser: the index never holds it, so it is not asked, and a
  // copy it answered before (a Take Offline since) is no longer given.
  offline?: boolean;
  // Whether the panel is showing: each opening asks again, and so does the page coming back into view while it shows.
  // Left out (the footer's Tools), the item is asked once and never on the page's visibility.
  open?: boolean;
};

/**
 * The item open in the editor as the index has it (its title, place, access and version), for the Explorer panel's
 * Current card and the footer's Tools, as the share link's guest when the editor was opened from one (one-explorer.md
 * "The Current card"). Asked once per item, again when it stops being local (a Sync in place), again on every opening
 * of the panel, and again when the page comes back into view while the panel shows, so a rename, a move or an edit made
 * anywhere else is never hidden behind an earlier read (Work Tracker 1461, 1471). A read on its way, or one that fails,
 * keeps the copy already held. Null while the first read is on its way, while the item is local, and when the index has
 * none for it: the panel then draws the card from Offline.
 */
export function useOpenItem(
  client: IndexClient,
  id: string | null | undefined,
  shareCode: string | null = null,
  // Read as the item is: a module function, so the read runs once per item.
  sharePassword: () => string | null = NO_PASSWORD,
  { offline = false, open }: OpenItemOptions = {},
): Item | null {
  const [read, setRead] = useState<{ id: string; item: Item | null } | null>(null);
  // Each opening asks again, set during render so the read starts with it.
  const shown = open ?? true;
  const [asks, setAsks] = useState(0);
  const [wasOpen, setWasOpen] = useState(shown);
  if (shown !== wasOpen) {
    setWasOpen(shown);
    if (shown && id) setAsks((n) => n + 1);
  }
  // Back on the page while the panel shows (a rename in another tab, then back here): asked again.
  const watch = open === true && Boolean(id) && !offline;
  useEffect(() => {
    if (!watch || typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') setAsks((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [watch]);
  useEffect(() => {
    if (!id || offline) return;
    let live = true;
    const share = shareCode ? { code: shareCode, password: sharePassword() } : null;
    client.getItem(id, share).then(
      ({ item }) => live && setRead({ id, item }),
      // A failed read keeps the copy this item already has; with none, the index has nothing for it.
      () => live && setRead((had) => (had?.id === id && had.item ? had : { id, item: null })),
    );
    return () => {
      live = false;
    };
  }, [client, id, offline, asks, shareCode, sharePassword]);
  // Never another item's: a read for the item open before answers nothing for this one.
  return id && !offline && read?.id === id ? read.item : null;
}
