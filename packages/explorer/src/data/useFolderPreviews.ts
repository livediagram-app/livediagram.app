'use client';

// What the folder cards on screen show of their insides (the index's `GET /folders/previews`): their newest items for
// the mosaic and how many they hold. One request for up to FOLDER_PREVIEW_IDS_MAX folders, asked only for folders
// not already answered, so revealing another batch of cards asks only for the new ones. A new filter, or a change
// that re-reads the lists (the epoch), starts again; an item changing place reads them again, keeping what shows. Without an answer (loading, or refused) a card shows its folder
// glyph, as it would with no previews at all.

import { useEffect, useMemo, useState } from 'react';
import {
  FOLDER_PREVIEW_IDS_MAX,
  type App,
  type FolderPreview,
  type IndexClient,
} from '@liveworkspace/index-client';

export type FolderPreviews = ReadonlyMap<string, FolderPreview>;

const NONE: FolderPreviews = new Map();

export function useFolderPreviews({
  client,
  folderIds,
  app,
  epoch,
  placedEpoch = 0,
}: {
  client: IndexClient;
  folderIds: readonly string[];
  // The app shown (this app's items only), or null for every app's.
  app: App | null;
  // A re-read of the lists starts again from nothing.
  epoch: number;
  // An item changed place: the cards keep what they show while it is read again.
  placedEpoch?: number;
}): FolderPreviews {
  const scope = `${app ?? '*'}|${epoch}`;
  const [answered, setAnswered] = useState<{
    scope: string;
    map: Map<string, FolderPreview>;
    fresh: Map<string, number>;
  }>({ scope, map: new Map(), fresh: new Map() });
  const same = answered.scope === scope;
  // A stable key for the ids not answered since the last change of place, so a re-render asks nothing.
  const missingKey = folderIds
    .filter((id) => !same || answered.fresh.get(id) !== placedEpoch)
    .join(',');

  useEffect(() => {
    if (!missingKey) return;
    const missing = missingKey.split(',');
    const controller = new AbortController();
    for (let i = 0; i < missing.length; i += FOLDER_PREVIEW_IDS_MAX) {
      const ids = missing.slice(i, i + FOLDER_PREVIEW_IDS_MAX);
      client
        .folderPreviews(ids, app ? { app } : {}, { signal: controller.signal })
        .then(({ previews }) => {
          setAnswered((prev) => {
            const keep = prev.scope === scope;
            const map = new Map(keep ? prev.map : []);
            const fresh = new Map(keep ? prev.fresh : []);
            // A folder out of reach is answered as empty, so it is never asked for again.
            for (const id of ids) {
              map.set(id, { folderId: id, itemCount: 0, items: [] });
              fresh.set(id, placedEpoch);
            }
            for (const p of previews) map.set(p.folderId, p);
            return { scope, map, fresh };
          });
        })
        .catch(() => {
          // Aborted, or refused: the cards keep what they show.
        });
    }
    return () => controller.abort();
  }, [client, app, scope, placedEpoch, missingKey]);

  return useMemo(() => (same ? answered.map : NONE), [same, answered.map]);
}
