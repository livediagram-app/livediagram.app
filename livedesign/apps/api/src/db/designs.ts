// A design as this api knows it (liveworkspace/docs/one-explorer.md): its content and what it knows of itself (name,
// owner, team, provenance, creation intent) live in its Durable Object's own SQLite (design-room/design-schema.ts,
// the `design` row). Where it is filed, who may open it, its sharing and its Trash state are the index's; this
// module never answers them. The read adds the owner's display name, from their profile at the liveworkspace
// accounts Worker (accounts/profiles.ts).

import type { DesignDTO, Env } from '../types';
import { getParticipant } from '../accounts/profiles';
import { readRecordedIntent } from '../design-intent-row';
import { designRoom } from '../design-client';
import { isDesignSource } from '@livedesign/api-schema';
import type { DesignMeta, DesignOutline } from '../design-room/design-content';

function designOf(
  id: string,
  outline: DesignOutline,
  meta: DesignMeta,
  owner: { name: string | null; color: string | null } | null,
): DesignDTO {
  return {
    id,
    ownerId: meta.ownerId,
    name: meta.name,
    tabs: outline.tabs,
    // Sharing is the index's (its share links); a design read says nothing of it.
    shareable: false,
    shareCode: null,
    folderId: null,
    teamId: meta.teamId,
    source: isDesignSource(meta.source) ? meta.source : null,
    // The slide deck (docs/specs/012-collaboration/presentation-mode.md), kept with the content.
    presentation: outline.presentation,
    savedAt: outline.savedAt,
    createdAt: meta.createdAt,
    ownerName: owner?.name ?? null,
    ownerColor: owner?.color ?? null,
    ...readRecordedIntent({ opens_in: meta.opensIn, tab_kind: meta.tabKind }),
  };
}

// The design's outline (one call to its Durable Object, a local call inside it) and its owner's profile,
// one after the other. Null for a design never started (nothing has created or opened it).
export async function getDesign(env: Env, id: string): Promise<DesignDTO | null> {
  const outline = await designRoom(env, id).outline();
  const meta = outline.meta;
  if (!meta) return null;
  const owner = await getParticipant(env, meta.ownerId);
  return designOf(id, outline, meta, owner);
}

// What the gates and notices need (owner, team, name) without the owner's profile.
export async function getDesignMeta(
  env: Env,
  id: string,
): Promise<{ id: string; ownerId: string; teamId: string | null; name: string } | null> {
  const meta = (await designRoom(env, id).outline()).meta;
  return meta ? { id, ownerId: meta.ownerId, teamId: meta.teamId, name: meta.name } : null;
}

// The R2 key of a design's cached first-tab snapshot (docs/specs/006-design/design-snapshots.md).
export function thumbnailKey(designId: string): string {
  return `thumb/${designId}`;
}

// The R2 key of a design's cached share card (docs/specs/013-workspace/share-link-previews.md).
export function shareCardKey(designId: string): string {
  return `og/${designId}`;
}

// Every cached snapshot a design can have, for the paths that delete it.
export function snapshotKeys(designId: string): string[] {
  return [thumbnailKey(designId), shareCardKey(designId)];
}

// What drawing a design's image needs (its name, last save and snapshot stamp), in one call to its Durable Object.
// Null for a design never started.
export type DesignThumbMeta = {
  id: string;
  name: string;
  savedAt: number;
  thumbRenderedAt: number | null;
};

export async function getDesignThumbMeta(env: Env, id: string): Promise<DesignThumbMeta | null> {
  const outline = await designRoom(env, id).outline();
  const meta = outline.meta;
  if (!meta) return null;
  return {
    id,
    name: meta.name,
    savedAt: outline.savedAt,
    thumbRenderedAt: meta.thumbRenderedAt ?? null,
  };
}

// What R2 holds about a design, for when the index purges it (routes/internal-items.ts): its cached snapshots, in
// one delete. Workbench tickets and sessions scoped to it are in their owners' workbench stores: a ticket lapses in
// a minute, and a session's every request is gated on the design's grant, which a purged design never gets again.
export async function purgeDesignRows(env: Env, id: string): Promise<void> {
  if (env.SNAPSHOTS) await env.SNAPSHOTS.delete(snapshotKeys(id));
}
