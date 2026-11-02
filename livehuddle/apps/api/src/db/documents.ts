// A canvas as this api knows it (liveworkspace/docs/specs/004-index/one-explorer.md): its content and what it knows of itself (name,
// owner, team, provenance, the slide deck) live in its Durable Object's own SQLite (document-room/document-schema.ts,
// the `document` row). Where it is filed, who may open it, its sharing and its Trash state are the index's; this
// module never answers them. The read joins the owner's display name from their profile (liveworkspace/profiles.ts).

import { isDocumentSource } from '@livehuddle/api-schema';
import type { DocumentDTO, Env } from '../types';
import { getParticipant } from '../liveworkspace/profiles';
import { documentRoom } from '../document-client';
import { mediaClient } from '../media';
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

// What liveworkspace keeps of a canvas's pictures (liveworkspace/docs/specs/006-media/previews.md), for when the index purges it
// (routes/internal-items.ts): its previews go too. Workbench tickets and sessions scoped to it are liveworkspace's:
// a ticket lapses in a minute, and a session's every request is gated on the canvas's grant, which a
// purged canvas never gets again. Best effort: a preview the purge misses is unreachable (every read asks the index).
export async function purgeDocumentPreviews(env: Env, id: string): Promise<void> {
  const media = mediaClient(env);
  if (!media) return;
  try {
    await media.deletePreviews(id);
  } catch (err) {
    console.warn('[purge] previews not dropped', { documentId: id, error: String(err) });
  }
}
