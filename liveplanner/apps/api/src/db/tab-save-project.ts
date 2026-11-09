// What a tab save needs of its plan (docs/specs/015-api/api.md "Tab save"): the plan's own row and next tab place from
// its store, and the owner's display name from their profile at the liveworkspace accounts Worker (person/profiles.ts,
// remembered for a minute per isolate). It runs on every autosave.

import type { ProjectDTO, PlanEnv } from '../types';
import { readPlanMeta } from '../plan-room/plan-content';
import { getParticipant } from '../person/profiles';

export type TabSaveProject = Pick<
  ProjectDTO,
  'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt' | 'ownerName' | 'ownerColor'
> & {
  // Where a new tab lands: one past the highest place held (docs/specs/006-project/per-tab-storage.md
  // "New tabs and the tab order"). Not the count: after a tab leaves the middle, the count is the last tab's own
  // place.
  nextOrderIndex: number;
};

// Runs inside the plan's Durable Object. Null for a plan never started.
export async function getProjectForSave(env: PlanEnv, id: string): Promise<TabSaveProject | null> {
  // Both reads start before either is awaited; the place is its own async step so a throw while preparing it
  // rejects with the meta read settled, never leaving that one unhandled.
  const nextPlace = async () =>
    env.PLAN_DB.prepare(
      'SELECT COALESCE(MAX(order_index) + 1, 0) AS n FROM plan_tabs WHERE plan_id = ?',
    )
      .bind(id)
      .first<{ n: number }>();
  const [meta, next] = await Promise.all([readPlanMeta(env, id), nextPlace()]);
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
    nextOrderIndex: next?.n ?? 0,
  };
}
