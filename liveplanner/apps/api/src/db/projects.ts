// A plan as this api knows it (liveworkspace/docs/one-explorer.md): its content and what it knows of itself (name,
// owner, team, provenance, creation intent) live in its Durable Object's own SQLite (plan-room/plan-schema.ts,
// the `plan` row). Where it is filed, who may open it, its sharing and its Trash state are the index's; this
// module never answers them. The read joins the owner's display name from participants.

import type { ProjectDTO, Env } from '../types';
import { getParticipant } from './participants';
import { readRecordedIntent } from '../project-intent-row';
import { planRoom } from '../plan-client';
import { isProjectSource } from '@liveplanner/api-schema';
import type { PlanMeta, PlanOutline } from '../plan-room/plan-content';

function projectOf(
  id: string,
  outline: PlanOutline,
  meta: PlanMeta,
  owner: { name: string | null; color: string | null } | null,
): ProjectDTO {
  return {
    id,
    ownerId: meta.ownerId,
    name: meta.name,
    tabs: outline.tabs,
    // Sharing is the index's (its share links); a plan read says nothing of it.
    shareable: false,
    shareCode: null,
    folderId: null,
    teamId: meta.teamId,
    source: isProjectSource(meta.source) ? meta.source : null,
    itemTypes: outline.itemTypes,
    itemTypesRev: outline.itemTypesRev,
    savedAt: outline.savedAt,
    createdAt: meta.createdAt,
    ownerName: owner?.name ?? null,
    ownerColor: owner?.color ?? null,
    ...readRecordedIntent({
      opens_in: meta.opensIn,
      tab_kind: meta.tabKind,
      template_family: meta.templateFamily,
    }),
  };
}

// The plan's outline (one call to its Durable Object, a local call inside it) and its owner's participant row,
// side by side. Null for a plan never started (nothing has created or opened it).
export async function getProject(env: Env, id: string): Promise<ProjectDTO | null> {
  const outline = await planRoom(env, id).outline();
  const meta = outline.meta;
  if (!meta) return null;
  const owner = await getParticipant(env, meta.ownerId);
  return projectOf(id, outline, meta, owner);
}

// What the gates and notices need (owner, team, name) without the owner's participant row.
export async function getProjectMeta(
  env: Env,
  id: string,
): Promise<{ id: string; ownerId: string; teamId: string | null; name: string } | null> {
  const meta = (await planRoom(env, id).outline()).meta;
  return meta ? { id, ownerId: meta.ownerId, teamId: meta.teamId, name: meta.name } : null;
}

// The R2 key of a plan's cached first-tab snapshot (docs/specs/006-project/project-snapshots.md).
export function thumbnailKey(projectId: string): string {
  return `thumb/${projectId}`;
}

// The R2 key of a plan's cached share card (docs/specs/013-workspace/share-link-previews.md).
export function shareCardKey(projectId: string): string {
  return `og/${projectId}`;
}

// Every cached snapshot a plan can have, for the paths that delete it.
export function snapshotKeys(projectId: string): string[] {
  return [thumbnailKey(projectId), shareCardKey(projectId)];
}

// What drawing a plan's image needs (its name, last save and snapshot stamp), in one call to its Durable Object.
// Null for a plan never started.
export type ProjectThumbMeta = {
  id: string;
  name: string;
  savedAt: number;
  thumbRenderedAt: number | null;
};

export async function getProjectThumbMeta(env: Env, id: string): Promise<ProjectThumbMeta | null> {
  const outline = await planRoom(env, id).outline();
  const meta = outline.meta;
  if (!meta) return null;
  return { id, name: meta.name, savedAt: outline.savedAt, thumbRenderedAt: meta.thumbRenderedAt ?? null };
}

// What D1 and R2 hold about a plan, for when the index purges it (routes/internal-items.ts): its form links (their
// reads and reports cascade), the workbench tickets and sessions scoped to it, and its cached snapshots. One D1
// batch and one R2 delete, whatever the plan held.
export async function purgePlanRows(env: Env, id: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM form_links WHERE project_id = ?').bind(id),
    env.DB.prepare('DELETE FROM workbench_tickets WHERE project_id = ?').bind(id),
    env.DB.prepare('DELETE FROM workbench_session_rooms WHERE project_id = ?').bind(id),
    env.DB.prepare('DELETE FROM workbench_sessions WHERE project_id = ?').bind(id),
  ]);
  if (env.SNAPSHOTS) await env.SNAPSHOTS.delete(snapshotKeys(id));
}
