'use client';

// The person's designs, for the editor's pickers that name another design (Add to Design, a link to a design, search).
// They are the index's (liveworkspace/docs/one-explorer-contracts.md): one page of livedesign items, read once the
// open design has loaded and the browser is idle, so it never joins the open's requests. `refresh` reads it again
// after this editor changed it (a tab moved to another design).

import { useEffect, useState } from 'react';
import type { Item } from '@liveworkspace/index-client';
import type { DesignListItem } from '@/lib/api-client';
import { indexClient } from '@/lib/index-client';
import { apiFetchDesignThumbnailSvg } from '@/lib/api-client';
import { rememberRecentDesigns } from '@/lib/recent-designs-snapshot';

// One page: the pickers show the most recent few, and search filters what is here.
export const DESIGN_LIST_LIMIT = 100;
// Waits at most this long for an idle moment.
const IDLE_TIMEOUT_MS = 4_000;

export function designListItem(item: Item): DesignListItem {
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

// The person's live designs. Each read also refreshes the landing page's note of the most recent ones
// (docs/specs/019-marketing/returning-visitor.md), as listing them always has.
export async function fetchDesignList(ownerId: string): Promise<DesignListItem[]> {
  const page = await indexClient.listItems({ app: 'livedesign', limit: DESIGN_LIST_LIMIT });
  const live = page.items.filter((item) => item.trashedAt === null);
  rememberRecentDesigns(
    live.map((item) => ({
      id: item.id,
      name: item.title,
      savedAt: item.updatedAt,
      empty: item.summary.empty === true,
      opensIn: null,
      hiddenFromRecent: item.hiddenFromRecent === true,
    })),
    (id, savedAt) => apiFetchDesignThumbnailSvg(ownerId, id, { version: savedAt }),
  );
  return live.map(designListItem);
}

function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 1);
  return () => window.clearTimeout(handle);
}

// `enabled` once the design has loaded for a person (not a workbench, not before hydration).
export function useDesignList(
  enabled: boolean,
  ownerId: string,
): {
  designList: DesignListItem[];
  refreshDesignList: () => void;
} {
  const [designList, setDesignList] = useState<DesignListItem[]>([]);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const cancel = whenIdle(() => {
      fetchDesignList(ownerId)
        .then((list) => {
          if (live) setDesignList(list);
        })
        // A failed read leaves the pickers as they were; the next refresh asks again.
        .catch(() => {});
    });
    return () => {
      live = false;
      cancel();
    };
  }, [enabled, ownerId, generation]);
  return { designList, refreshDesignList: () => setGeneration((g) => g + 1) };
}
