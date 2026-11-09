// What a tab save needs of its design (docs/specs/015-api/api.md "Tab save"): the design's own row and next tab place
// from its store, nothing from elsewhere. It runs on every autosave.

import type { DesignDTO, DesignEnv } from '../types';
import { readDesignMeta } from '../design-room/design-content';

export type TabSaveDesign = Pick<DesignDTO, 'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt'> & {
  // Where a new tab lands: one past the highest place held (docs/specs/006-design/per-tab-storage.md
  // "New tabs and the tab order"). Not the count: after a tab leaves the middle, the count is the last tab's own
  // place.
  nextOrderIndex: number;
};

// Runs inside the design's Durable Object. Null for a design never started.
export async function getDesignForSave(env: DesignEnv, id: string): Promise<TabSaveDesign | null> {
  // Both reads start before either is awaited; the place is its own async step so a throw while preparing it
  // rejects with the meta read settled, never leaving that one unhandled.
  const nextPlace = async () =>
    env.DESIGN_DB.prepare(
      'SELECT COALESCE(MAX(order_index) + 1, 0) AS n FROM design_tabs WHERE design_id = ?',
    )
      .bind(id)
      .first<{ n: number }>();
  const [meta, next] = await Promise.all([readDesignMeta(env, id), nextPlace()]);
  if (!meta) return null;
  return {
    id,
    ownerId: meta.ownerId,
    teamId: meta.teamId,
    name: meta.name,
    createdAt: meta.createdAt,
    nextOrderIndex: next?.n ?? 0,
  };
}
