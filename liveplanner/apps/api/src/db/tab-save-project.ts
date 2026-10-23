// What a tab save needs of its plan (docs/specs/015-api/api.md "Tab save"): the plan's own row and tab count from
// its store, and the owner's display name from their profile at the liveworkspace accounts Worker (person/profiles.ts,
// remembered for a minute per isolate). It runs on every autosave.

import type { ProjectDTO, PlanEnv } from '../types';
import { readPlanMeta } from '../plan-room/plan-content';
import { getParticipant } from '../person/profiles';

export type TabSaveProject = Pick<
  ProjectDTO,
  'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt' | 'ownerName' | 'ownerColor'
> & {
  // How many tabs the project holds: where a new tab lands.
  tabCount: number;
};

// Runs inside the plan's Durable Object. Null for a plan never started.
export async function getProjectForSave(env: PlanEnv, id: string): Promise<TabSaveProject | null> {
  // Both reads start before either is awaited; the count is its own async step so a throw while preparing it
  // rejects with the meta read settled, never leaving that one unhandled.
  const countTabs = async () =>
    env.PLAN_DB.prepare('SELECT COUNT(*) AS n FROM plan_tabs WHERE plan_id = ?')
      .bind(id)
      .first<{ n: number }>();
  const [meta, count] = await Promise.all([readPlanMeta(env, id), countTabs()]);
  if (!meta) return null;
  const owner = await getParticipant(env, meta.ownerId);
  return {
    id,
    ownerId: meta.ownerId,
    teamId: meta.teamId,
    name: meta.name,
    createdAt: meta.createdAt,
    ownerName: owner?.name ?? null,
    ownerColor: owner?.color ?? null,
    tabCount: count?.n ?? 0,
  };
}
