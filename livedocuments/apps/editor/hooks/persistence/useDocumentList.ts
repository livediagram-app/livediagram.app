'use client';

// The person's documents, for the editor's pickers that name another document (Add to Document, a link to a document, search).
// They are the index's (liveworkspace/docs/one-explorer-contracts.md): one page of livedocuments items, read once the
// open document has loaded and the browser is idle, so it never joins the open's requests. `refresh` reads it again
// after this editor changed it (a tab moved to another document).

import { useEffect, useState } from 'react';
import type { Item } from '@liveworkspace/index-client';
import type { DocumentListItem } from '@/lib/api-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';

// One page: the pickers show the most recent few, and search filters what is here.
export const PLAN_LIST_LIMIT = 100;
// Waits at most this long for an idle moment.
const IDLE_TIMEOUT_MS = 4_000;

export function documentListItem(item: Item): DocumentListItem {
  return {
    id: item.id,
    name: item.title,
    folderId: item.folderId,
    savedAt: item.updatedAt,
    shareCode: item.sharedVia,
    ownerId: item.ownerId,
    createdAt: item.createdAt,
  };
}

// The person's live documents.
export async function fetchDocumentList(): Promise<DocumentListItem[]> {
  const page = await indexClient.listItems({ app: 'livedocuments', limit: PLAN_LIST_LIMIT });
  return page.items.filter((item) => item.trashedAt === null).map(documentListItem);
}

function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 1);
  return () => window.clearTimeout(handle);
}

// `enabled` once the document has loaded for a person (not a workbench, not before hydration).
export function useDocumentList(
  enabled: boolean,
  ownerId: string,
): {
  documentList: DocumentListItem[];
  refreshDocumentList: () => void;
} {
  const [documentList, setDocumentList] = useState<DocumentListItem[]>([]);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const cancel = whenIdle(() => {
      fetchDocumentList()
        .then((list) => {
          if (live) setDocumentList(list);
        })
        // A failed read leaves the pickers as they were; the next refresh asks again.
        .catch(() => {});
    });
    return () => {
      live = false;
      cancel();
    };
  }, [enabled, ownerId, generation]);
  return { documentList, refreshDocumentList: () => setGeneration((g) => g + 1) };
}
