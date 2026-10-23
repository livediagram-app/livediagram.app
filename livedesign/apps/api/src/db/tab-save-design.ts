// What a tab save needs of its design (docs/specs/015-api/api.md "Tab save"): the design's own row and tab count from
// its store, nothing from elsewhere. It runs on every autosave.

import type { DesignDTO, DesignEnv } from '../types';
import { readDesignMeta } from '../design-room/design-content';

export type TabSaveDesign = Pick<DesignDTO, 'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt'> & {
  // How many tabs the design holds: where a new tab lands.
  tabCount: number;
};

// Runs inside the design's Durable Object. Null for a design never started.
export async function getDesignForSave(env: DesignEnv, id: string): Promise<TabSaveDesign | null> {
  // Both reads start before either is awaited; the count is its own async step so a throw while preparing it
  // rejects with the meta read settled, never leaving that one unhandled.
  const countTabs = async () =>
    env.DESIGN_DB.prepare('SELECT COUNT(*) AS n FROM design_tabs WHERE design_id = ?')
      .bind(id)
      .first<{ n: number }>();
  const [meta, count] = await Promise.all([readDesignMeta(env, id), countTabs()]);
  if (!meta) return null;
  return {
    id,
    ownerId: meta.ownerId,
    teamId: meta.teamId,
    name: meta.name,
    createdAt: meta.createdAt,
    tabCount: count?.n ?? 0,
  };
}
