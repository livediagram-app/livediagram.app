// livediagram's side of liveworkspace's media service (liveworkspace/docs/media.md). The images people upload
// live there, with their gallery, dedupe and caps; this api keeps its own access rules (who may read a
// document, which documents may serve whose image) and serves the bytes to the people they let in. Every call
// carries MEDIA_KEY as a bearer token and names this app.
//
// What this api keeps (migration 0101):
//   - media_images: whose each image is, as this api names owners, for the placement grants
//     (db/image-grants.ts). Filled when an image is uploaded here, listed in a gallery here, or asked for.
//   - media_ref_outbox: the documents whose images changed since the service last heard. Each document's
//     Durable Object queues itself as it pushes its images to `document_images` (document-room/document-outbox.ts),
//     a removal queues what it removes; the every-minute cron sends them.

import {
  createMediaClient,
  isGuestOwner,
  MEDIA_REFS_PER_DOCUMENT_MAX,
  MEDIA_REFS_SYNC_MAX,
  mediaGuestOwner,
  type MediaClient,
  type MediaImage,
} from '@liveworkspace/media';
import type { Env, ImageSummary } from './types';

export const MEDIA_APP = 'livediagram.app';

// The service, or null when this deploy has none (a self-host without the key): images are then off.
export function mediaClient(env: Pick<Env, 'MEDIA_KEY' | 'MEDIA_URL'>): MediaClient | null {
  if (!env.MEDIA_KEY) return null;
  return createMediaClient({ app: MEDIA_APP, key: env.MEDIA_KEY, url: env.MEDIA_URL });
}

// The owner as the service knows them. An account id is the same in every app; a guest id is this app's
// credential and never leaves it, so the service gets a one-way hash of it instead. Account ids start
// `user_`, which request-auth refuses as a guest id.
export async function mediaOwner(owner: string): Promise<string> {
  return owner.startsWith('user_') ? owner : mediaGuestOwner(MEDIA_APP, owner);
}

// The gallery row as this api has always answered it: the service's `app` stays out.
export function imageSummary({ app: _app, ...image }: MediaImage): ImageSummary {
  return image;
}

// Record images as `owner`'s: the ones just uploaded or listed in their gallery. One statement, and it
// writes only rows that change.
export async function rememberMediaImages(env: Env, owner: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await env.DB.prepare(
    `INSERT INTO media_images (id, owner_id) SELECT value, ?2 FROM json_each(?1) WHERE true
     ON CONFLICT (id) DO UPDATE SET owner_id = excluded.owner_id
      WHERE media_images.owner_id <> excluded.owner_id`,
  )
    .bind(JSON.stringify(ids), owner)
    .run();
}

// Whose image `id` is, as this api names owners, or null when the service has no such image. Answered
// here for an image this api has met; otherwise asked of the service once and remembered. `caller` is the
// person asking: a guest's own image comes back under their guest id, and anyone else's guest image under
// a name no owner here has, so it serves nowhere but through a grant.
export async function mediaImageOwner(
  env: Env,
  client: MediaClient,
  id: string,
  caller: string | null,
): Promise<string | null> {
  const row = await env.DB.prepare('SELECT owner_id FROM media_images WHERE id = ?')
    .bind(id)
    .first<{ owner_id: string }>();
  if (row) return row.owner_id || null;
  const found = await client.get(id);
  let owner = found?.owner ?? '';
  if (isGuestOwner(owner) && caller !== null && owner === (await mediaOwner(caller))) {
    owner = caller;
  }
  await env.DB.prepare('INSERT OR IGNORE INTO media_images (id, owner_id) VALUES (?, ?)')
    .bind(id, owner)
    .run();
  return owner || null;
}

// ---------- References (liveworkspace/docs/media.md "References") ----------

// The document's images as its Durable Object pushes them (document-room/document-outbox.ts): queue it for the
// service when the set differs from the one `document_images` holds, before the push replaces those rows. A push
// whose set is unchanged queues nothing. A document D1 no longer has queues nothing either.
export function mediaRefQueueSetStatement(
  env: Env,
  documentId: string,
  ids: string[],
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO media_ref_outbox (document_id, queued_at)
     SELECT d.id, ?3 FROM documents d
      WHERE d.id = ?1
        AND (EXISTS (SELECT 1 FROM json_each(?2) j
                      WHERE NOT EXISTS (SELECT 1 FROM document_images r
                                         WHERE r.document_id = ?1 AND r.image_id = j.value))
             OR EXISTS (SELECT 1 FROM document_images r
                         WHERE r.document_id = ?1 AND r.image_id NOT IN (SELECT value FROM json_each(?2))))
     ON CONFLICT (document_id) DO UPDATE SET queued_at = excluded.queued_at`,
  ).bind(documentId, JSON.stringify(ids), Date.now());
}

// Queue the documents `where` picks (a SQL condition on `d`, its params bound from ?2 on): a document removed.
// Only those placing an image, unless `where` already says why it changed.
export function mediaRefQueueDocumentsStatement(
  env: Env,
  where: string,
  params: readonly unknown[],
  onlyPlacing = true,
): D1PreparedStatement {
  const placing = onlyPlacing
    ? `AND EXISTS (SELECT 1 FROM document_images r WHERE r.document_id = d.id)`
    : '';
  return env.DB.prepare(
    `INSERT INTO media_ref_outbox (document_id, queued_at)
     SELECT d.id, ?1 FROM documents d
      WHERE (${where}) ${placing}
     ON CONFLICT (document_id) DO UPDATE SET queued_at = excluded.queued_at`,
  ).bind(Date.now(), ...params);
}

// Send the queued documents' images to the service: up to one request's worth a run, each document's
// whole set, a gone document's as empty. A row queued again while this ran stays for the next run. Says
// `complete` once nothing is left, which the service's unused-image sweep waits for. Without the service
// there is nobody to tell, and the queue is dropped. An empty queue sends nothing, except on the daily run
// (`announce`), which says `complete` so a quiet app never holds the sweep up.
export async function flushMediaRefs(env: Env, announce = false): Promise<number> {
  const client = mediaClient(env);
  if (!client) {
    await env.DB.prepare('DELETE FROM media_ref_outbox').run();
    return 0;
  }
  const queued = await env.DB.prepare(
    'SELECT document_id, queued_at FROM media_ref_outbox ORDER BY queued_at LIMIT ?',
  )
    .bind(MEDIA_REFS_SYNC_MAX)
    .all<{ document_id: string; queued_at: number }>();
  const rows = queued.results ?? [];
  const drained = rows.length < MEDIA_REFS_SYNC_MAX;
  if (rows.length === 0) {
    if (!announce) return 0;
    const sent = await client.syncRefs({ documents: [], complete: true });
    if (!sent.ok) console.error('[media] refs sync failed', sent.status, sent.body);
    return 0;
  }
  const ids = rows.map((r) => r.document_id);
  const placed = await env.DB.prepare(
    `SELECT r.document_id, r.image_id
       FROM document_images r
      WHERE r.document_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(JSON.stringify(ids))
    .all<{ document_id: string; image_id: string }>();
  const sets = new Map(ids.map((id) => [id, [] as string[]]));
  for (const row of placed.results ?? []) sets.get(row.document_id)!.push(row.image_id);
  const documents = [...sets].map(([document, images]) => {
    if (images.length > MEDIA_REFS_PER_DOCUMENT_MAX) {
      // Past any gallery's cap: the rest stay unreported, so the sweep could take one of them.
      console.error('[media] a document places more images than one sync carries', {
        document,
        images: images.length,
      });
    }
    return { document, images: images.slice(0, MEDIA_REFS_PER_DOCUMENT_MAX) };
  });
  const sent = await client.syncRefs({ documents, complete: drained });
  if (!sent.ok) {
    console.error('[media] refs sync failed', sent.status, sent.body);
    return 0;
  }
  await env.DB.prepare(
    `DELETE FROM media_ref_outbox
      WHERE (document_id, queued_at) IN
            (SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?))`,
  )
    .bind(JSON.stringify(rows.map((r) => [r.document_id, r.queued_at])))
    .run();
  return documents.length;
}
