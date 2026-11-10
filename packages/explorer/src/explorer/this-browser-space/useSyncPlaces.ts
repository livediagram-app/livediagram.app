'use client';

// Sync keeping its place on the Explorer page (one-explorer.md "This Browser, a Space"): the page hands Sync over to
// the app's editor, which syncs the item and stays there, so the page notes first where it should land
// (noteSyncPlace). Here, once an Explorer on this address is open and the item has left this browser's list, it is
// read from the index (one request per note, and notes are rare) and moved there if it is still where a Sync lands,
// My Work's root. A note whose place is gone, or whose item has moved since, is dropped; one whose item isn't in
// the account yet waits, up to a day.

import { useEffect, useMemo } from 'react';
import { dropSyncPlace, readSyncPlaces } from '../../this-browser';
import { useExplorer } from '../context';
import { useExtras } from '../extras';
import { useThisBrowserItems } from '../ThisBrowser';

export function useSyncPlaces(): void {
  const { app, client, actions, folders, teams } = useExplorer();
  const { signedIn } = useExtras();
  const { host } = useThisBrowserItems();
  // Read again whenever an item leaves (or joins) the list: a Sync is one leaving.
  const localIds = useMemo(() => host?.items.map((i) => i.id).join('\n') ?? null, [host]);
  const known = folders.byId;
  useEffect(() => {
    if (localIds === null || !signedIn || folders.loading) return;
    const local = new Set(localIds.split('\n'));
    const waiting = readSyncPlaces(app).filter((p) => !local.has(p.id));
    if (waiting.length === 0) return;
    let stale = false;
    for (const place of waiting) {
      const placeGone =
        (place.folderId !== null && !known.has(place.folderId)) ||
        (place.teamId !== null && !teams.some((t) => t.id === place.teamId));
      if (placeGone) {
        dropSyncPlace(app, place.id);
        continue;
      }
      void client.getItem(place.id).then(
        ({ item }) => {
          if (stale) return;
          dropSyncPlace(app, place.id);
          if (item.folderId === null && item.teamId === null)
            void actions.move(item, { teamId: place.teamId, folderId: place.folderId });
        },
        // Not in the account yet (or not readable now): the note waits, up to a day.
        () => {},
      );
    }
    return () => {
      stale = true;
    };
  }, [localIds, signedIn, app, client, actions, known, teams, folders.loading]);
}
