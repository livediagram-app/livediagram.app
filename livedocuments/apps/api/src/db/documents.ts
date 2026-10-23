// A document as this api knows it (liveworkspace/docs/one-explorer.md): its content and what it knows of itself (name,
// owner, team, provenance, the slide deck) live in its Durable Object's own SQLite (document-room/document-schema.ts,
// the `document` row). Where it is filed, who may open it, its sharing and its Trash state are the index's; this
// module never answers them. The read joins the owner's display name from their profile (person/profiles.ts).

import type { DocumentDTO, Env } from '../types';
import { getParticipant } from '../person/profiles';
import { documentRoom } from '../document-client';
import { isDocumentSource } from '@livedocuments/api-schema';
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
    // Sharing is the index's (its share links); a document read says nothing of it.
    shareable: false,
    shareCode: null,
    folderId: null,
    teamId: meta.teamId,
    source: isDocumentSource(meta.source) ? meta.source : null,
    presentation: outline.presentation,
    savedAt: outline.savedAt,
    createdAt: meta.createdAt,
    ownerName: owner?.name ?? null,
    ownerColor: owner?.color ?? null,
  };
}

// The document's outline (one call to its Durable Object, a local call inside it) and its owner's participant row,
// side by side. Null for a document never started (nothing has created or opened it).
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

// The R2 key of a document's cached first-tab snapshot (docs/specs/006-document/document-snapshots.md).
export function thumbnailKey(documentId: string): string {
  return `thumb/${documentId}`;
}

// The R2 key of a document's cached share card (docs/specs/013-workspace/share-link-previews.md).
export function shareCardKey(documentId: string): string {
  return `og/${documentId}`;
}

// Every cached snapshot a document can have, for the paths that delete it.
export function snapshotKeys(documentId: string): string[] {
  return [thumbnailKey(documentId), shareCardKey(documentId)];
}

// What drawing a document's image needs (its name, last save and snapshot stamp), in one call to its Durable Object.
// Null for a document never started.
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

// What R2 holds about a document, for when the index purges it (routes/internal-items.ts): its cached snapshots.
// One R2 delete, whatever the document held. Workbench tickets and sessions scoped to it are in their owners'
// workbench stores: a ticket lapses in a minute, and a session's every request is gated on the document's grant,
// which a purged document never gets again.
export async function purgeDocumentRows(env: Env, id: string): Promise<void> {
  if (env.IMAGES) await env.IMAGES.delete(snapshotKeys(id));
}
