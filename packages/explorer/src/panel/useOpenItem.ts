'use client';

import { useEffect, useState } from 'react';
import type { IndexClient, Item } from '@liveworkspace/index-client';

const NO_PASSWORD = () => null;

export type OpenItemOptions = {
  // The editor's word that the item is kept only in this browser: the index never holds it, so it is not asked, and a
  // copy it answered before (a Take Offline since) is no longer given.
  offline?: boolean;
  // Whether the panel is showing: an opening asks again while the index had nothing for it (an item created since).
  open?: boolean;
};

/**
 * The item open in the editor as the index has it (its title, place and access), for the Explorer panel's Current
 * card and the footer's Tools, as the share link's guest when the editor was opened from one (one-explorer.md "The
 * Current card"). Asked once per item, again when it stops being local (a Sync in place), and again on an opening
 * while the index had nothing for it; one it answered is never read again for an opening. Null while it is read, while
 * the item is local, and when the index has none for it: the panel then draws the card from Offline.
 */
export function useOpenItem(
  client: IndexClient,
  id: string | null | undefined,
  shareCode: string | null = null,
  // Read as the item is: a module function, so the read runs once per item.
  sharePassword: () => string | null = NO_PASSWORD,
  { offline = false, open = true }: OpenItemOptions = {},
): Item | null {
  const [read, setRead] = useState<{ id: string; item: Item | null } | null>(null);
  // Each opening while the index had nothing for this item asks again, set during render so the read starts with it.
  const [asks, setAsks] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && id && read?.id === id && read.item === null) setAsks((n) => n + 1);
  }
  useEffect(() => {
    if (!id || offline) return;
    let live = true;
    const share = shareCode ? { code: shareCode, password: sharePassword() } : null;
    client.getItem(id, share).then(
      ({ item }) => live && setRead({ id, item }),
      () => live && setRead({ id, item: null }),
    );
    return () => {
      live = false;
    };
  }, [client, id, offline, asks, shareCode, sharePassword]);
  // Never another item's: a read for the item open before answers nothing for this one.
  return id && !offline && read?.id === id ? read.item : null;
}
