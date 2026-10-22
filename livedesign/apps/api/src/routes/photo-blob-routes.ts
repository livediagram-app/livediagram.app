// /api/documents/<id>/tabs/<tabId>/photo-blobs[-held|-adopt] — the photo blob store (docs/specs/031-photo/
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
import { documentLinksTab, getDocument, tabBelongsElsewhere } from '../db';
import {
  adoptBlobs,
  blobForTab,
  photoBlobKey,
  recordBlobs,
  storedBlobs,
  tabHoldsBlobs,
  tabPhotoBytes,
} from '../db/photo-blobs';
import { CORS_HEADERS, forbidden, json, notFound } from '../responses';
import { parsePositiveCap } from '../limits';
import {
  gateEdit,
  gateRead,
  missingDocument,
  readBody,
  requireOwner,
  type RouteContext,
} from './context';

function refuse(
  reason: PhotoBlobsError,
  status: number,
  where: { documentId: string; tabId: string },
  extra: Record<string, unknown> = {},
): Response {
  console.warn(`[photo-blobs] refused ${reason}`, where);
  return json({ error: reason, ...extra }, { status });
}

const idList = (v: unknown, max: number): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every(isBlobId) ? [...new Set(v)] : null;

export async function handlePhotoBlobRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments[3] !== 'tabs') return null;
  // The four shapes this serves; anything else falls through to the dispatcher's own 404.
  const read = request.method === 'GET' && segments.length === 7 && segments[5] === 'photo-blobs';
  const post = request.method === 'POST' && segments.length === 6;
  const upload = post && segments[5] === 'photo-blobs';
  const has = post && segments[5] === 'photo-blobs-held';
  const adopt = post && segments[5] === 'photo-blobs-adopt';
  if (!read && !upload && !has && !adopt) return null;
  const documentId = segments[2]!;
  const tabId = segments[4]!;
  const where = { documentId, tabId };
  if (!env.PHOTO_BLOBS) return json({ error: 'photos_unavailable' }, { status: 503 });
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getDocument(env, documentId);
  if (!doc) return missingDocument(ctx, documentId);

  // GET .../photo-blobs/<blobId>: the bytes, through a tab the caller may read.
  if (read) {
    const blobId = segments[6]!;
    if (!isBlobId(blobId)) return notFound();
    if (!(await gateRead(ctx, documentId, doc.ownerId, doc.teamId, tabId))) return notFound();
    if (!(await documentLinksTab(env, documentId, tabId))) return notFound();
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
  // document or one not yet saved anywhere (a new tab's first save waits for its pixels).
  if (ctx.token) return refuse('photos_unavailable', 403, where);
  if (!(await gateEdit(ctx, documentId, doc.ownerId, doc.teamId, tabId))) return forbidden();
  if (await tabBelongsElsewhere(env, tabId, documentId)) return forbidden();

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
    const fromDocument = typeof body.fromDocument === 'string' ? body.fromDocument : null;
    const fromTab = typeof body.fromTab === 'string' ? body.fromTab : null;
    if (!ids || !fromDocument || !fromTab) return refuse('too_many', 400, where);
    const source = await getDocument(env, fromDocument);
    // Read access to the source now: a lost link adopts nothing.
    if (
      !source ||
      !(await gateRead(ctx, fromDocument, source.ownerId, source.teamId, fromTab)) ||
      !(await documentLinksTab(env, fromDocument, fromTab))
    )
      return forbidden();
    return json({ adopted: await adoptBlobs(env, fromTab, tabId, ids) });
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
  // Bytes first, then rows: a failure part-way leaves bytes no row names (the sweep's), never a
  // row with nothing behind it.
  const stored = await storedBlobs(env, ids);
  for (const e of entries)
    if (!stored.has(e.id))
      await env.PHOTO_BLOBS.put(photoBlobKey(e.id), e.bytes, { httpMetadata: { contentType: e.type } });
  await recordBlobs(
    env,
    tabId,
    entries.map((e) => ({ id: e.id, type: e.type, size: e.bytes.length })),
  );
  console.info('[photo-blobs] stored', { ...where, blobs: entries.length, bytes: raw.length });
  return json({ stored: ids });
}
