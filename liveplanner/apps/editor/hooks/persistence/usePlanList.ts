'use client';

// The person's plans, for the editor's pickers that name another plan (Add to Project, a link to a plan, search).
// They are the index's (liveworkspace/docs/one-explorer-contracts.md): one page of liveplanner items, read once the
// open plan has loaded and the browser is idle, so it never joins the open's requests. `refresh` reads it again
// after this editor changed it (a tab moved to another plan).

import { useEffect, useState } from 'react';
import type { Item } from '@liveworkspace/index-client';
import type { ProjectListItem } from '@/lib/api-client';
import { indexClient } from '@/lib/index-client';
import { apiFetchProjectThumbnailSvg } from '@/lib/api-client';
import { rememberRecentDiagrams } from '@/lib/recent-diagrams-snapshot';

// One page: the pickers show the most recent few, and search filters what is here.
export const PLAN_LIST_LIMIT = 100;
// Waits at most this long for an idle moment.
const IDLE_TIMEOUT_MS = 4_000;

export function planListItem(item: Item): ProjectListItem {
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

// The person's live plans. Each read also refreshes the landing page's note of the most recent ones
// (docs/specs/019-marketing/returning-visitor.md), as listing them always has.
export async function fetchPlanList(ownerId: string): Promise<ProjectListItem[]> {
  const page = await indexClient.listItems({ app: 'liveplanner', limit: PLAN_LIST_LIMIT });
  const live = page.items.filter((item) => item.trashedAt === null);
  rememberRecentDiagrams(
    live.map((item) => ({
      id: item.id,
      name: item.title,
      savedAt: item.updatedAt,
      empty: item.summary.empty === true,
      opensIn: null,
    })),
    (id, savedAt) => apiFetchProjectThumbnailSvg(ownerId, id, { version: savedAt }),
  );
  return live.map(planListItem);
}

function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 1);
  return () => window.clearTimeout(handle);
}

// `enabled` once the plan has loaded for a person (not a workbench, not before hydration).
export function usePlanList(
  enabled: boolean,
  ownerId: string,
): {
  projectList: ProjectListItem[];
  refreshProjectList: () => void;
} {
  const [projectList, setProjectList] = useState<ProjectListItem[]>([]);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const cancel = whenIdle(() => {
      fetchPlanList(ownerId)
        .then((list) => {
          if (live) setProjectList(list);
        })
        // A failed read leaves the pickers as they were; the next refresh asks again.
        .catch(() => {});
    });
    return () => {
      live = false;
      cancel();
    };
  }, [enabled, ownerId, generation]);
  return { projectList, refreshProjectList: () => setGeneration((g) => g + 1) };
}
