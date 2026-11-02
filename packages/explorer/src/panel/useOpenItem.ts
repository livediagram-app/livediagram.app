'use client';

import { useEffect, useState } from 'react';
import type { IndexClient, Item } from '@liveworkspace/index-client';

const NO_PASSWORD = () => null;

/**
 * The item open in the editor as the index has it (its title, place and star), for the Explorer panel's Current
 * card: read once each time the panel mounts (it mounts only while open), as the share link's guest when the editor
 * was opened from one. Null while it is read, and when the index has none for it, as for an item kept only in this
 * browser: the panel then draws the card from This Browser's list (ExplorerPanel's `currentId`). Every editor's panel
 * reads it here, once.
 */
export function useOpenItem(
  client: IndexClient,
  id: string | null | undefined,
  shareCode: string | null = null,
  // Read as the item is: a module function, so the read runs once per item.
  sharePassword: () => string | null = NO_PASSWORD,
): Item | null {
  const [read, setRead] = useState<{ id: string; item: Item | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    const share = shareCode ? { code: shareCode, password: sharePassword() } : null;
    client.getItem(id, share).then(
      ({ item }) => live && setRead({ id, item }),
      () => live && setRead({ id, item: null }),
    );
    return () => {
      live = false;
    };
  }, [client, id, shareCode, sharePassword]);
  // Never another item's: a read for the item open before answers nothing for this one.
  return id && read?.id === id ? read.item : null;
}
