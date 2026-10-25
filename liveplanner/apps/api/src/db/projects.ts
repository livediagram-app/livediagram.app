// A plan as this api knows it (liveworkspace/docs/one-explorer.md): its content and what it knows of itself (name,
// owner, team, provenance, creation intent) live in its Durable Object's own SQLite (plan-room/plan-schema.ts,
// the `plan` row). Where it is filed, who may open it, its sharing and its Trash state are the index's; this
// module never answers them. The read adds the owner's display name, from their profile at the liveworkspace
// accounts Worker (person/profiles.ts).

import type { ProjectDTO, Env } from '../types';
import { getParticipant } from '../person/profiles';
import { readRecordedIntent } from '../project-intent-row';
import { planRoom } from '../plan-client';
import { isProjectSource } from '@liveplanner/api-schema';
import type { PlanMeta, PlanOutline } from '../plan-room/plan-content';
import { mediaClient } from '../media';

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

// The plan's outline (one call to its Durable Object, a local call inside it) and its owner's profile,
// one after the other. Null for a plan never started (nothing has created or opened it).
export async function getProject(env: Env, id: string): Promise<ProjectDTO | null> {
  const outline = await planRoom(env, id).outline();
  const meta = outline.meta;
  if (!meta) return null;
  const owner = await getParticipant(env, meta.ownerId);
  return projectOf(id, outline, meta, owner);
}

// What the gates and notices need (owner, team, name) without the owner's profile.
export async function getProjectMeta(
  env: Env,
  id: string,
): Promise<{ id: string; ownerId: string; teamId: string | null; name: string } | null> {
  const meta = (await planRoom(env, id).outline()).meta;
  return meta ? { id, ownerId: meta.ownerId, teamId: meta.teamId, name: meta.name } : null;
}

// What liveworkspace keeps of a plan's pictures (liveworkspace/docs/previews.md), for when the index purges it
// (routes/internal-items.ts): its previews go too. Its form links and reports are in its own Durable Object (wiped
// with it), and the index's form row and code cascade with the item. Workbench tickets and sessions scoped to it are
// liveworkspace's: a ticket lapses in a minute, and a session's every request is gated on the
// plan's grant, which a purged plan never gets again. Best effort: a preview the purge misses is unreachable (every
// read asks the index).
export async function purgePlanPreviews(env: Env, id: string): Promise<void> {
  const media = mediaClient(env);
  if (!media) return;
  try {
    await media.deletePreviews(id);
  } catch (err) {
    console.warn('[purge] previews not dropped', { projectId: id, error: String(err) });
  }
}
