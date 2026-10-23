// A canvas as this api knows it (liveworkspace/docs/one-explorer.md): its content and what it knows of itself (name,
// owner, team, provenance, the slide deck) live in its Durable Object's own SQLite (document-room/document-schema.ts,
// the `document` row). Where it is filed, who may open it, its sharing and its Trash state are the index's; this
// module never answers them. The read joins the owner's display name from their profile (liveworkspace/profiles.ts).

import { isDocumentSource } from '@livediagram/api-schema';
import type { DocumentDTO, Env } from '../types';
import { getParticipant } from '../liveworkspace/profiles';
import { documentRoom } from '../document-client';
import { NO_RECORDED_INTENT } from '../document-intent-row';
import type { DocumentMeta, DocumentOutline } from '../document-room/document-content';

function documentOf(
  id: string,
  outline: DocumentOutline,
  meta: DocumentMeta,
  owner: { name: string | null; color: string | null } | null,
): DocumentDTO {
  return {
    id,
    ownerId: meta.ownerId,
    name: meta.name,
    tabs: outline.tabs,
    // Sharing is the index's (its share links); a canvas read says nothing of it.
    shareable: false,
    shareCode: null,
    communityState: null,
    folderId: null,
    teamId: meta.teamId,
    source: isDocumentSource(meta.source) ? meta.source : null,
    presentation: outline.presentation,
    savedAt: outline.savedAt,
    createdAt: meta.createdAt,
    ownerName: owner?.name ?? null,
    ownerColor: owner?.color ?? null,
    // The intent it was made with is the index's (the item's), not the canvas's.
    ...NO_RECORDED_INTENT,
  };
}

// The canvas's outline (one call to its Durable Object, a local call inside it) and its owner's participant row,
// side by side. Null for a canvas never started (nothing has created or opened it).
export async function getDocument(env: Env, id: string): Promise<DocumentDTO | null> {
  const outline = await documentRoom(env, id).outline();
  const meta = outline.meta;
  if (!meta) return null;
  const owner = await getParticipant(env, meta.ownerId);
  return documentOf(id, outline, meta, owner);
}

// What the gates and notices need (owner, team, name) without the owner's participant row.
export async function getDocumentMeta(
  env: Env,
  id: string,
): Promise<{ id: string; ownerId: string; teamId: string | null; name: string } | null> {
  const meta = (await documentRoom(env, id).outline()).meta;
  return meta ? { id, ownerId: meta.ownerId, teamId: meta.teamId, name: meta.name } : null;
}

// What drawing a canvas's image needs (its name, last save and snapshot stamp), in one call to its Durable Object.
// Null for a canvas never started.
export type DocumentThumbMeta = {
  id: string;
  name: string;
  savedAt: number;
  thumbRenderedAt: number | null;
};

export async function getDocumentThumbMeta(
  env: Env,
  id: string,
): Promise<DocumentThumbMeta | null> {
  const outline = await documentRoom(env, id).outline();
  const meta = outline.meta;
  if (!meta) return null;
  return {
    id,
    name: meta.name,
    savedAt: outline.savedAt,
    thumbRenderedAt: meta.thumbRenderedAt ?? null,
  };
}

// R2 object key for a canvas's cached SVG snapshot (docs/specs/006-document/document-snapshots.md). Shared by
// the render-cache (which writes it) and the purge (which clears it) so the key shape lives in exactly one place.
export function thumbnailKey(documentId: string): string {
  return `thumb/${documentId}`;
}

// The Community's own snapshot (docs/specs/025-community/community.md "Viewing a post's document"): drawn from the
// redacted tab (no comments, no people), so the public card image never serves the owner's snapshot.
export function communityThumbnailKey(documentId: string): string {
  return `thumb-community/${documentId}`;
}

// The share card a link preview shows (docs/specs/013-workspace/share-link-previews.md): the first-tab snapshot drawn
// as a 1200 x 630 PNG, and the Community's own, drawn from its redacted snapshot.
export function shareCardKey(documentId: string): string {
  return `og/${documentId}`;
}

export function communityShareCardKey(documentId: string): string {
  return `og-community/${documentId}`;
}

// Every cached snapshot a canvas can have, for the paths that delete it.
export function snapshotKeys(documentId: string): string[] {
  return [
    thumbnailKey(documentId),
    communityThumbnailKey(documentId),
    shareCardKey(documentId),
    communityShareCardKey(documentId),
  ];
}

// What R2 holds about a canvas, for when the index purges it (routes/internal-items.ts): its cached snapshots.
// One R2 delete, whatever the canvas held. Workbench tickets and sessions scoped to it are in their owners'
// workbench stores: a ticket lapses in a minute, and a session's every request is gated on the canvas's grant,
// which a purged canvas never gets again.
export async function purgeDocumentRows(env: Env, id: string): Promise<void> {
  if (env.IMAGES) await env.IMAGES.delete(snapshotKeys(id));
}
