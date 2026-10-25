'use client';

// Take Offline and Sync handed over by the Explorer on an app's address (liveworkspace's shared Explorer, which
// can't write the app's offline store): the app's editor, opened at the item's own address, reads
// `?convert=…&item=…` once (./this-browser), takes it out of the address, checks the item is the person's to move, and
// runs the conversion through the same code the editor's Explorer panel uses. Both ask first: Take Offline with its
// own confirm, Sync with one here, since a link alone must never move an item.
//
// Every app's editor calls this with its own pieces: its conversions, confirm and toast, its offline list, the index
// read, and the word for its items.

import { useEffect, useRef } from 'react';
import type { App, Item } from '@liveworkspace/index-client';
import { useLatest } from './ui/useLatest';
import {
  dropThisBrowserConversion,
  readThisBrowserConversion,
  type ThisBrowserConversion,
} from './this-browser';

export type HandoffDoc = { id: string; name: string };

export type ConversionHandoffOptions = {
  // The person (account or guest); null until known, and nothing is read before then.
  ownerId: string | null;
  signedIn: boolean;
  // The app whose items may be taken offline from here.
  app: App;
  // What the app calls one item, lower case: 'canvas', 'document', 'design'.
  noun: string;
  conversions: {
    takeOffline: (doc: HandoffDoc) => Promise<unknown>;
    syncToCloud: (doc: HandoffDoc) => Promise<unknown>;
  };
  confirm: (opts: { title: string; message: string; confirmLabel: string }) => Promise<boolean>;
  toastError: (message: string) => void;
  // The index's read of one item (indexClient.getItem).
  getItem: (id: string) => Promise<{ item: Pick<Item, 'app' | 'sharedVia' | 'access' | 'title'> }>;
  // The items this browser keeps (the app's offline store).
  listKept: () => Promise<readonly { id: string; name?: string | null }[]>;
};

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export function useConversionHandoff(options: ConversionHandoffOptions): void {
  // The newest of each, read when the request is run: the request itself is read once.
  const latest = useLatest(options);
  const taken = useRef(false);
  const { ownerId } = options;
  useEffect(() => {
    if (taken.current || !ownerId) return;
    const asked = readThisBrowserConversion(window.location.search);
    if (!asked) return;
    taken.current = true;
    dropThisBrowserConversion();
    void (async () => {
      const { conversions, confirm, toastError, noun } = latest.current;
      const doc = await movable(asked.conversion, asked.id, latest.current);
      if (!doc) {
        toastError(
          asked.conversion === 'sync'
            ? `Couldn’t find that ${noun} in this browser.`
            : `You can’t take that ${noun} offline.`,
        );
        return;
      }
      if (asked.conversion === 'take-offline') {
        await conversions.takeOffline(doc);
        return;
      }
      const ok = await confirm({
        title: `Sync “${doc.name}” to Your Account?`,
        message:
          'It moves into your account, where it is backed up and opens on your other devices, and leaves this browser.',
        confirmLabel: `Sync ${capitalised(noun)}`,
      });
      if (ok) await conversions.syncToCloud(doc);
    })();
    // Read once, as soon as the person is known.
  }, [ownerId, latest]);
}

/** The item the request names, when it may be moved that way: Sync, one this browser keeps (signed in); Take
 *  Offline, one of this app's the person can edit in their own library or a team's (not one reached by a link). */
async function movable(
  conversion: ThisBrowserConversion,
  id: string,
  { signedIn, app, getItem, listKept }: ConversionHandoffOptions,
): Promise<HandoffDoc | null> {
  if (conversion === 'sync') {
    if (!signedIn) return null;
    const kept = (await listKept().catch(() => [])).find((d) => d.id === id);
    return kept ? { id, name: kept.name || 'Untitled' } : null;
  }
  const item = await getItem(id).then(
    (r) => r.item,
    () => null,
  );
  if (!item || item.app !== app || item.sharedVia || item.access !== 'edit') return null;
  return { id, name: item.title || 'Untitled' };
}
