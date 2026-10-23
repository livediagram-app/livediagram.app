// livedesign's side of liveworkspace's media service (liveworkspace/docs/media.md). The images people upload
// live there, with their gallery, dedupe and caps; this api keeps its own access rules (who may read a
// design, which designs may serve whose image) and serves the bytes to the people they let in. Every call
// carries MEDIA_KEY as a bearer token and names this app.
//
// What each design keeps of it, in its own SQLite (design-room/design-schema.ts):
//   - media_images: whose each image it has met is, as this api names owners, for the placement grants
//     (db/image-grants.ts). Filled when a write first places an image (learnMediaOwners).
//   - an outbox key: the design's images changed since the service last heard. The image reference triggers
//     queue it in the transaction that changes them; the design's alarm sends the whole set
//     (pushDesignMediaRefs).
import {
  createMediaClient,
  isGuestOwner,
  MEDIA_REFS_PER_DOCUMENT_MAX,
  mediaGuestOwner,
  type MediaClient,
  type MediaImage,
} from '@liveworkspace/media';
import type { DesignEnv, Env, ImageSummary } from './types';

export const MEDIA_APP = 'livedesign.app';

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

// The owners of `ids` the design has not met yet, asked of the service and remembered (media_images), so the
// placement and serving rules (db/image-grants.ts) can join them. Run before a write's statements. A guest's image
// comes back from the service under a hash of their id (mediaOwner); it is named here as the design's owner or an
// entitled person whose hash it is, and otherwise under a name no owner has, so it serves nowhere but through a
// grant. At most MEDIA_LOOKUPS_PER_WRITE asks a write: a body naming more unknown images than that learns the
// rest on the next write.
export const MEDIA_LOOKUPS_PER_WRITE = 25;

export async function learnMediaOwners(env: DesignEnv, ids: readonly string[]): Promise<void> {
  const client = mediaClient(env);
  if (!client || ids.length === 0) return;
  const known = await env.DESIGN_DB.prepare(
    'SELECT id FROM media_images WHERE id IN (SELECT value FROM json_each(?))',
  )
    .bind(JSON.stringify(ids))
    .all<{ id: string }>();
  const have = new Set(known.results.map((r) => r.id));
  const unknown = [...new Set(ids)].filter((id) => !have.has(id)).slice(0, MEDIA_LOOKUPS_PER_WRITE);
  if (unknown.length === 0) return;
  const people = await env.DESIGN_DB.prepare(
    `SELECT owner_id AS id FROM design WHERE owner_id <> ''
     UNION SELECT person_id FROM entitled WHERE until > ?`,
  )
    .bind(Date.now())
    .all<{ id: string }>();
  const candidates = people.results.map((r) => r.id);
  const owners = await Promise.all(unknown.map((id) => askMediaOwner(client, id, candidates)));
  await env.DESIGN_DB.prepare(
    `INSERT OR IGNORE INTO media_images (id, owner_id)
     SELECT value ->> '$[0]', value ->> '$[1]' FROM json_each(?)`,
  )
    .bind(JSON.stringify(unknown.map((id, i) => [id, owners[i]])))
    .run();
}

// Whose image `id` is, as this api names owners ('' for an id the service does not know). A guest's image is
// named after whichever of `candidates` it belongs to.
async function askMediaOwner(
  client: MediaClient,
  id: string,
  candidates: readonly (string | null)[],
): Promise<string> {
  const found = await client.get(id);
  const owner = found?.owner ?? '';
  if (!isGuestOwner(owner)) return owner;
  for (const candidate of candidates) {
    if (candidate !== null && !candidate.startsWith('user_') && owner === (await mediaOwner(candidate)))
      return candidate;
  }
  return owner;
}

// Whose image `id` is for the worker's own reads (the gallery owner's byte read), asked of the service and
// remembered per isolate for MEDIA_OWNER_TTL_MS. An image's owner changes only when a guest signs up.
const MEDIA_OWNER_TTL_MS = 60_000;
const MEDIA_OWNER_CACHE_MAX = 2000;
const ownerCache = new Map<string, { owner: string; at: number }>();

export async function mediaImageOwnerFor(
  client: MediaClient,
  id: string,
  caller: string | null,
  now = Date.now(),
): Promise<string | null> {
  const key = `${id} ${caller ?? ''}`;
  const hit = ownerCache.get(key);
  if (hit && now - hit.at < MEDIA_OWNER_TTL_MS) return hit.owner || null;
  const owner = await askMediaOwner(client, id, [caller]);
  ownerCache.delete(key);
  if (ownerCache.size >= MEDIA_OWNER_CACHE_MAX) {
    const oldest = ownerCache.keys().next().value;
    if (oldest !== undefined) ownerCache.delete(oldest);
  }
  ownerCache.set(key, { owner, at: now });
  return owner || null;
}

// ---------- References (liveworkspace/docs/media.md "References") ----------

// Send the design's images to the service: its whole set, replacing what the service held for it (an empty set
// for a design that places none, or is gone). Each design sends its own when they change, so every design that
// places an image has been sent at least once: `complete` holds from the first. Without the service there is
// nobody to tell. Throws when the service refuses, so the outbox keeps the key and retries.
export async function pushDesignMediaRefs(env: DesignEnv, designId: string): Promise<void> {
  const client = mediaClient(env);
  if (!client) return;
  const placed = await env.DESIGN_DB.prepare(
    `SELECT DISTINCT r.image_id FROM design_tabs dt JOIN image_refs r ON r.tab_id = dt.tab_id
      WHERE dt.design_id = ?`,
  )
    .bind(designId)
    .all<{ image_id: string }>();
  const images = placed.results.map((r) => r.image_id);
  if (images.length > MEDIA_REFS_PER_DOCUMENT_MAX) {
    // Past any gallery's cap: the rest stay unreported, so the sweep could take one of them.
    console.error('[media] a design places more images than one sync carries', {
      design: designId,
      images: images.length,
    });
  }
  const sent = await client.syncRefs({
    documents: [{ document: designId, images: images.slice(0, MEDIA_REFS_PER_DOCUMENT_MAX) }],
    complete: true,
  });
  if (!sent.ok) throw new Error(`media: refs sync answered ${sent.status}`);
}

// The daily run (index.ts scheduled): this app has sent every design's set (each sends its own as it changes,
// from its first), so `complete` holds; saying it daily keeps a quiet app from holding the service's sweep up.
export async function announceMediaRefs(env: Env): Promise<void> {
  const client = mediaClient(env);
  if (!client) return;
  const sent = await client.syncRefs({ documents: [], complete: true });
  if (!sent.ok) console.error('[media] refs announce failed', sent.status, sent.body);
}

// A design purged: the service hears it places nothing. Best effort (the purge goes on); a failure is logged.
export async function forgetDesignMediaRefs(env: Env, designId: string): Promise<void> {
  const client = mediaClient(env);
  if (!client) return;
  const sent = await client.syncRefs({ documents: [{ document: designId, images: [] }], complete: true });
  if (!sent.ok) console.error('[media] refs clear failed', sent.status, sent.body);
}

// A guest who became an account: every image the guest uploaded becomes the account's, in every app's view of the
// service. A throw keeps the index's notice, so it asks again.
export async function mergeMediaOwner(env: Env, guestId: string, userId: string): Promise<void> {
  const client = mediaClient(env);
  if (!client) return;
  const merged = await client.mergeOwner(await mediaOwner(guestId), await mediaOwner(userId));
  if (!merged.ok) throw new Error(`media: merging the guest's images answered ${merged.status}`);
}
