'use client';

// What the folder cards on screen show of their insides (the index's `GET /folders/previews`): their newest items for
// the mosaic and how many they hold. One request for up to FOLDER_PREVIEW_IDS_MAX folders, asked only for folders
// not already answered, so revealing another batch of cards asks only for the new ones. A new filter, or a change
// that re-reads the lists (the epoch), starts again. Without an answer (loading, or refused) a card shows its folder
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
}: {
  client: IndexClient;
  folderIds: readonly string[];
  // The app shown (this app's items only), or null for every app's.
  app: App | null;
  epoch: number;
}): FolderPreviews {
  const scope = `${app ?? '*'}|${epoch}`;
  const [answered, setAnswered] = useState<{ scope: string; map: Map<string, FolderPreview> }>({
    scope,
    map: new Map(),
  });
  const current = answered.scope === scope ? answered.map : null;
  // A stable key for the ids not yet answered, so a re-render with the same cards asks nothing.
  const missingKey = folderIds.filter((id) => !current?.has(id)).join(',');

  useEffect(() => {
    if (!missingKey) return;
    const missing = missingKey.split(',');
    const controller = new AbortController();
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += FOLDER_PREVIEW_IDS_MAX) {
      chunks.push(missing.slice(i, i + FOLDER_PREVIEW_IDS_MAX));
    }
    for (const ids of chunks) {
      client
        .folderPreviews(ids, app ? { app } : {}, { signal: controller.signal })
        .then(({ previews }) => {
          setAnswered((prev) => {
            const map = new Map(prev.scope === scope ? prev.map : []);
            // A folder out of reach is answered as empty, so it is never asked for again this scope.
            for (const id of ids) map.set(id, { folderId: id, itemCount: 0, items: [] });
            for (const p of previews) map.set(p.folderId, p);
            return { scope, map };
          });
        })
        .catch(() => {
          // Aborted, or refused: the cards keep their glyph.
        });
    }
    return () => controller.abort();
  }, [client, app, scope, missingKey]);

  return useMemo(() => current ?? NONE, [current]);
}
