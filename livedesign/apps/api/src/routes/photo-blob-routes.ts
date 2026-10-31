// /api/designs/<id>/tabs/<tabId>/photo-blobs[-held|-adopt] — the photo blob store (docs/specs/031-photo/
// photo-store.md "The routes"): which blobs a tab holds, an upload of a batch of them, adopting a
// tab's blobs into another tab, and reading one. A blob is readable through a tab the caller can read
// and that holds a ref to it, and writable only by an editor of the tab; a ref always means the bytes
// were sent and checked, never just an id.
import { decodeBlobBatch, sniffsAs, type PhotoBlobsError } from '@livedesign/api-schema';
import {
  blobIdOf,
  isBlobId,
  PHOTO_ADOPT_MAX_IDS,
  PHOTO_BATCH_BYTES,
  PHOTO_HAS_MAX_IDS,
} from '@livedesign/photo-engine';
import { levelAtLeast } from '@liveworkspace/index-client';
import { designRoom } from '../design-client';
import { designHasTab } from '../db/tabs';
import {
  blobForTab,
  heldBlobs,
  photoBlobKey,
  recordBlobs,
  tabHoldsBlobs,
  tabPhotoBytes,
  type PhotoBlobMeta,
} from '../db/photo-blobs';
import { indexService } from '../index-service';
import { CORS_HEADERS, forbidden, json, notFound } from '../responses';
import { parsePositiveCap } from '../limits';
import {
  COMMUNITY_CONTENT,
  gateEdit,
  gateRead,
  grantCallerOf,
  readBody,
  requireOwner,
  type DesignRouteContext,
} from './context';

function refuse(
  reason: PhotoBlobsError,
  status: number,
  where: { designId: string; tabId: string },
  extra: Record<string, unknown> = {},
): Response {
  console.warn(`[photo-blobs] refused ${reason}`, where);
  return json({ error: reason, ...extra }, { status });
}

const idList = (v: unknown, max: number): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every(isBlobId) ? [...new Set(v)] : null;

export async function handlePhotoBlobRoutes(ctx: DesignRouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments[3] !== 'tabs') return null;
  // The four shapes this serves; anything else falls through to the dispatcher's own 404.
  const read = request.method === 'GET' && segments.length === 7 && segments[5] === 'photo-blobs';
  const post = request.method === 'POST' && segments.length === 6;
  const upload = post && segments[5] === 'photo-blobs';
  const has = post && segments[5] === 'photo-blobs-held';
  const adopt = post && segments[5] === 'photo-blobs-adopt';
  if (!read && !upload && !has && !adopt) return null;
  const designId = segments[2]!;
  const tabId = segments[4]!;
  const where = { designId, tabId };
  if (!env.PHOTO_BLOBS) return json({ error: 'photos_unavailable' }, { status: 503 });
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;

  // GET .../photo-blobs/<blobId>: the bytes, through a tab the caller may read. A photo's pixels are the design's
  // content, so a Community post's link reads them too (docs/specs/025-community/community.md "Viewing a post's
  // design"); every other photo door stays closed to it.
  if (read) {
    const blobId = segments[6]!;
    if (!isBlobId(blobId)) return notFound();
    if (!(await gateRead(ctx, designId, undefined, undefined, tabId, COMMUNITY_CONTENT)))
      return notFound();
    if (!(await designHasTab(env, designId, tabId))) return notFound();
    const blob = await blobForTab(env, tabId, blobId);
    if (!blob) return notFound();
    const object = await env.PHOTO_BLOBS.get(photoBlobKey(blobId));
    if (!object) {
      console.warn('[photo-blobs] row without bytes', { ...where, blobId });
      return notFound();
    }
    const headers = new Headers(CORS_HEADERS);
    headers.set('Content-Type', blob.contentType);
    // Named by content: the bytes behind an id never change.
    headers.set('Cache-Control', 'private, max-age=31536000, immutable');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(object.body, { headers });
  }
  // Writes: an editor of the tab (never a token: agents do not edit pixels), on a tab of this
  // design or one not yet saved (a new tab's first save waits for its pixels). Tab ids are the design's own: a
  // design's object holds no other design's tabs.
  if (ctx.token) return refuse('photos_unavailable', 403, where);
  if (!(await gateEdit(ctx, designId, undefined, undefined, tabId))) return forbidden();

  if (has) {
    const body = await readBody(ctx);
    if (body instanceof Response) return body;
    const ids = idList(body.ids, PHOTO_HAS_MAX_IDS);
    if (!ids) return refuse('too_many', 400, where);
    return json({ has: [...(await tabHoldsBlobs(env, tabId, ids))] });
  }

  if (adopt) {
    const body = await readBody(ctx);
    if (body instanceof Response) return body;
    const ids = idList(body.ids, PHOTO_ADOPT_MAX_IDS);
    const fromDesign = typeof body.fromDesign === 'string' ? body.fromDesign : null;
    const fromTab = typeof body.fromTab === 'string' ? body.fromTab : null;
    if (!ids || !fromDesign || !fromTab) return refuse('too_many', 400, where);
    const found = await sourceBlobs(ctx, fromDesign, fromTab, ids);
    if (found === null) return forbidden();
    await recordBlobs(env, designId, tabId, found);
    return json({ adopted: found.map((b) => b.id) });
  }

  // POST .../photo-blobs: a blob batch.
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > PHOTO_BATCH_BYTES)
    return refuse('too_many', 413, where);
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.length > PHOTO_BATCH_BYTES) return refuse('too_many', 413, where);
  const entries = decodeBlobBatch(raw);
  if (entries === 'bad_batch') return refuse('bad_batch', 400, where);
  for (const e of entries) {
    if (!sniffsAs(e.bytes, e.type)) return refuse('unsupported-type', 415, where);
    if ((await blobIdOf(e.bytes)) !== e.id) return refuse('blob_mismatch', 400, where);
  }
  const ids = entries.map((e) => e.id);
  const held = await tabHoldsBlobs(env, tabId, ids);
  const cap = parsePositiveCap(env.PHOTO_MAX_BYTES_PER_TAB);
  if (cap !== null) {
    const current = await tabPhotoBytes(env, tabId);
    const incoming = entries.filter((e) => !held.has(e.id)).reduce((n, e) => n + e.bytes.length, 0);
    if (current + incoming > cap) return refuse('photo_full', 403, where, { limit: cap, current });
  }
  // Markers, then bytes, then refs (db/photo-blobs.ts): a failure part-way leaves bytes no ref names, never a
  // ref with nothing behind it. The bytes are written every time, even when another design stored them first:
  // they are in hand, and a write is what keeps a blob another design is releasing right now.
  const blobs = entries.map((e) => ({ id: e.id, type: e.type, size: e.bytes.length }));
  await Promise.all(
    entries.map((e) =>
      env.PHOTO_BLOBS!.put(photoBlobKey(e.id), e.bytes, { httpMetadata: { contentType: e.type } }),
    ),
  );
  await recordBlobs(env, designId, tabId, blobs);
  console.info('[photo-blobs] stored', { ...where, blobs: entries.length, bytes: raw.length });
  return json({ stored: ids });
}

// The blobs of `ids` the source tab holds, for an adoption: this design's own tab, or another design's the caller
// may read now (its grant from the index; a lost link adopts nothing). Null when the source is out of reach.
async function sourceBlobs(
  ctx: DesignRouteContext,
  fromDesign: string,
  fromTab: string,
  ids: readonly string[],
): Promise<PhotoBlobMeta[] | null> {
  const { env } = ctx;
  if (fromDesign === ctx.segments[2]) {
    if (!(await gateRead(ctx, fromDesign, undefined, undefined, fromTab))) return null;
    if (!(await designHasTab(env, fromDesign, fromTab))) return null;
    return heldBlobs(env, fromTab, ids);
  }
  const outcome = await indexService.requestGrant(env, grantCallerOf(ctx), fromDesign, null);
  if (!outcome.ok) return null;
  const grant = outcome.grant;
  if (!levelAtLeast(grant.level, 'view') || (grant.tabId !== null && grant.tabId !== fromTab))
    return null;
  return designRoom(env, fromDesign).heldBlobs(fromTab, [...ids]);
}
