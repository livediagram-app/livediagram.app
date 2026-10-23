'use client';

import { useEffect, useRef } from 'react';
import {
  dropThisBrowserConversion,
  readThisBrowserConversion,
  type ThisBrowserConversion,
} from '@liveworkspace/explorer/this-browser';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useLatest } from '@/hooks/ui/useLatest';
import { useToast } from '@/hooks/ui/useToast';
import { indexClient } from '@/lib/index-client';
import { offlineListDocuments } from '@/lib/offline/offline-store';
import { useOfflineConversions } from './useOfflineConversion';

// Take Offline and Sync handed over by the Explorer on this app's address (liveworkspace's shared Explorer, which
// can't write this app's offline store): This Browser's page reads `?convert=…&item=…` once
// (@liveworkspace/explorer/this-browser), takes it out of the address, checks the document is the person's to move,
// and runs the conversion through the same code the editor's panel uses (docs/specs/006-document/offline-mode.md).
// Both ask first: Take Offline with its own confirm, Sync with one here, since a link alone must never move a
// document.
export function useConversionHandoff(ownerId: string | null, signedIn: boolean) {
  // The newest of each, read when the request is run: the request itself is read once.
  const latest = useLatest({
    conversions: useOfflineConversions(ownerId),
    confirm: useConfirm(),
    toast: useToast(),
    signedIn,
  });
  const taken = useRef(false);
  useEffect(() => {
    if (taken.current || !ownerId) return;
    const asked = readThisBrowserConversion(window.location.search);
    if (!asked) return;
    taken.current = true;
    dropThisBrowserConversion();
    void (async () => {
      const { conversions, confirm, toast } = latest.current;
      const doc = await movable(asked.conversion, asked.id, latest.current.signedIn);
      if (!doc) {
        toast.error(
          asked.conversion === 'sync'
            ? 'Couldn’t find that document in this browser.'
            : 'You can’t take that document offline.',
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
        confirmLabel: 'Sync Document',
      });
      if (ok) await conversions.syncToCloud(doc);
    })();
    // Read once, as soon as the person is known.
  }, [ownerId, latest]);
}

/** The document the request names, when it may be moved that way: Sync, one this browser keeps (signed in); Take
 *  Offline, one of this app's the person can edit in their own library or a team's (not one reached by a link). */
async function movable(
  conversion: ThisBrowserConversion,
  id: string,
  signedIn: boolean,
): Promise<{ id: string; name: string } | null> {
  if (conversion === 'sync') {
    if (!signedIn) return null;
    const kept = (await offlineListDocuments().catch(() => [])).find((d) => d.id === id);
    return kept ? { id, name: kept.name || 'Untitled' } : null;
  }
  const item = await indexClient.getItem(id).then(
    (r) => r.item,
    () => null,
  );
  if (!item || item.app !== 'livedocuments' || item.sharedVia || item.access !== 'edit') return null;
  return { id, name: item.title || 'Untitled' };
}
