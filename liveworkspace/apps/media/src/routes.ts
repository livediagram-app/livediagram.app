// The media API (`/api/media/app/*`, liveworkspace/docs/media.md "The API"): what an app's own Worker
// does with the pictures of the people it has signed in. Each request names its app (X-Media-App) and
// carries that app's key as a bearer token. The app has already checked what only it can: who the
// person is, and for the bytes, that the viewer may see a document that places the image.

import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_HEIGHT_HEADER,
  IMAGE_NAME_HEADER,
  IMAGE_SHA256_HEADER,
  IMAGE_WIDTH_HEADER,
  isAcceptedImageType,
  isMediaApp,
  MAX_IMAGE_BYTES,
  MEDIA_APP_HEADER,
  MEDIA_ID_MAX,
  MEDIA_OWNER_HEADER,
  MEDIA_REFS_PER_DOCUMENT_MAX,
  MEDIA_REFS_SYNC_MAX,
  ORIGINAL_NAME_MAX,
  sniffImageType,
  type MediaApp,
  type MediaRefsSync,
} from '@liveworkspace/media';
import { MAX_JSON_BYTES } from './config';
import { appKey, parsePositiveCap, type Env } from './env';
import { badRequest, forbidden, json, notFound, ok, unauthorized, unavailable } from './http';
import {
  deleteImageRow,
  deleteOwnerRows,
  findBySha,
  getImage,
  insertImage,
  listImages,
  mergeOwner,
  ownerTotals,
  rowToImage,
  usageOf,
  type Caps,
} from './images';
import { stripJpegMetadata } from './jpeg-strip';
import { syncRefs } from './refs';
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MEDIA_ID_MAX;

// The app this request speaks for, or null when it doesn't carry that app's key.
async function callerApp(request: Request, env: Env): Promise<MediaApp | null> {
  const app = request.headers.get(MEDIA_APP_HEADER);
  if (!isMediaApp(app)) return null;
  const expected = appKey(env, app);
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expected || !token) return null;
  return (await timingSafeEqual(token, expected)) ? app : null;
}

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > MAX_JSON_BYTES) return undefined;
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function handleApp(
  request: Request,
  env: Env,
  url: URL,
  path: string,
): Promise<Response> {
  const app = await callerApp(request, env);
  if (!app) return unauthorized();
  if (!env.MEDIA) return unavailable();
  const bucket = env.MEDIA;
  const segments = path.split('/').filter(Boolean);
  const method = request.method;
  const owner = url.searchParams.get('owner');

  if (segments[0] === 'images') {
    // GET /app/images?owner=: the owner's gallery, from every app.
    if (segments.length === 1 && method === 'GET') {
      if (!isId(owner)) return badRequest('invalid_owner');
      return json({ images: await listImages(env, owner) });
    }
    // POST /app/images?owner=: store a file, or answer the owner's copy of the same bytes.
    if (segments.length === 1 && method === 'POST') {
      if (!isId(owner)) return badRequest('invalid_owner');
      return upload(request, env, bucket, app, owner);
    }
    const id = segments[1];
    if (!isId(id)) return notFound();
    // GET /app/images/<id>: the image and whose it is.
    if (segments.length === 2 && method === 'GET') {
      const row = await getImage(env, id);
      return row ? json({ image: rowToImage(row), owner: row.owner }) : notFound();
    }
    // GET /app/images/<id>/bytes: the bytes, for the app to serve to someone it has let in.
    if (segments.length === 3 && segments[2] === 'bytes' && method === 'GET') {
      const row = await getImage(env, id);
      if (!row) return notFound();
      const object = await bucket.get(id);
      if (!object) return notFound();
      return new Response(object.body, {
        headers: {
          'Content-Type': row.content_type,
          'Content-Length': String(object.size),
          [MEDIA_OWNER_HEADER]: row.owner,
          'X-Content-Type-Options': 'nosniff',
          // The bytes behind an id never change, but who may see them does: the app sets its own.
          'Cache-Control': 'private, no-store',
        },
      });
    }
    // DELETE /app/images/<id>?owner=: its owner removes it from their gallery.
    if (segments.length === 2 && method === 'DELETE') {
      if (!isId(owner)) return badRequest('invalid_owner');
      const row = await getImage(env, id);
      if (!row) return ok();
      if (row.owner !== owner) return forbidden();
      // The row first: dedupe and the bytes route trust a row, so it must never outlive its bytes.
      await deleteImageRow(env, id);
      try {
        await bucket.delete(id);
      } catch (err) {
        console.error('[media] R2 delete failed after the row went', { id }, err);
      }
      console.log('[media] deleted', { app, id });
      return ok();
    }
    return notFound();
  }

  // GET /app/usage?owner=: which documents, in any app, place each of the owner's images.
  if (segments[0] === 'usage' && segments.length === 1 && method === 'GET') {
    if (!isId(owner)) return badRequest('invalid_owner');
    return json({ usage: await usageOf(env, owner) });
  }

  // POST /app/refs: the images each listed document places now.
  if (segments[0] === 'refs' && segments.length === 1 && method === 'POST') {
    const sync = parseRefsSync(await readJson(request));
    if (!sync) return badRequest('invalid_body');
    await syncRefs(env, app, sync.documents, sync.complete === true);
    return ok();
  }

  if (segments[0] === 'owners') {
    // POST /app/owners/merge: a guest signed up.
    if (segments[1] === 'merge' && segments.length === 2 && method === 'POST') {
      const body = (await readJson(request)) as { from?: unknown; to?: unknown } | undefined;
      if (!isId(body?.from) || !isId(body?.to) || body.from === body.to) {
        return badRequest('invalid_body');
      }
      const merged = await mergeOwner(env, body.from, body.to);
      console.log('[media] merged a guest', {
        app,
        moved: merged.moved.length,
        kept: merged.kept.length,
      });
      return json(merged);
    }
    // DELETE /app/owners/<owner>: an account deleted, so every image it uploaded goes.
    if (segments.length === 2 && method === 'DELETE' && isId(segments[1])) {
      const ids = await deleteOwnerRows(env, segments[1]);
      for (let i = 0; i < ids.length; i += 1000) {
        try {
          await bucket.delete(ids.slice(i, i + 1000));
        } catch (err) {
          console.error('[media] R2 delete failed for a deleted owner', err);
        }
      }
      console.log('[media] forgot an owner', { app, deleted: ids.length });
      return json({ deleted: ids.length });
    }
  }

  return notFound();
}

function parseRefsSync(value: unknown): MediaRefsSync | null {
  if (typeof value !== 'object' || value === null) return null;
  const { documents, complete } = value as { documents?: unknown; complete?: unknown };
  if (!Array.isArray(documents) || documents.length > MEDIA_REFS_SYNC_MAX) return null;
  if (complete !== undefined && typeof complete !== 'boolean') return null;
  const out: MediaRefsSync['documents'] = [];
  for (const entry of documents) {
    const { document, images } = (entry ?? {}) as { document?: unknown; images?: unknown };
    if (!isId(document) || !Array.isArray(images)) return null;
    if (images.length > MEDIA_REFS_PER_DOCUMENT_MAX || !images.every(isId)) return null;
    out.push({ document, images });
  }
  return { documents: out, complete: complete === true };
}

const unsupported = () =>
  json({ error: 'unsupported_type', acceptedTypes: ACCEPTED_IMAGE_TYPES }, { status: 415 });
const tooLarge = () =>
  json({ error: 'file_too_large', limitBytes: MAX_IMAGE_BYTES }, { status: 413 });

// The 403 a full gallery answers with, or null when the upload fits.
function galleryFull(caps: Caps, totals: { count: number; bytes: number }, incoming: number) {
  if (caps.maxImages !== null && totals.count >= caps.maxImages) {
    return json(
      { error: 'gallery_full', reason: 'count', limit: caps.maxImages, current: totals.count },
      { status: 403 },
    );
  }
  if (caps.maxBytes !== null && totals.bytes + incoming > caps.maxBytes) {
    return json(
      { error: 'gallery_full', reason: 'bytes', limit: caps.maxBytes, current: totals.bytes },
      { status: 403 },
    );
  }
  return null;
}

// The order is cheapest refusal first: the declared type and length, the hash shortcut, the caps, then
// the body. The body's real hash is the dedupe key, and the insert checks the caps again atomically.
async function upload(
  request: Request,
  env: Env,
  bucket: R2Bucket,
  app: MediaApp,
  owner: string,
): Promise<Response> {
  const declaredType = (request.headers.get('Content-Type') ?? '').toLowerCase();
  if (!isAcceptedImageType(declaredType)) return unsupported();
  const declaredLength = Number(request.headers.get('Content-Length') ?? '0');
  if (!Number.isFinite(declaredLength) || declaredLength <= 0) return badRequest('missing_length');
  if (declaredLength > MAX_IMAGE_BYTES) return tooLarge();

  const headerSha = (request.headers.get(IMAGE_SHA256_HEADER) ?? '').toLowerCase();
  if (/^[0-9a-f]{64}$/.test(headerSha)) {
    const known = await findBySha(env, owner, headerSha);
    if (known) return json({ image: known, deduped: true });
  }

  const caps: Caps = {
    maxImages: parsePositiveCap(env.IMAGE_MAX_PER_OWNER),
    maxBytes: parsePositiveCap(env.IMAGE_MAX_BYTES_PER_OWNER),
  };
  if (caps.maxImages !== null || caps.maxBytes !== null) {
    const full = galleryFull(caps, await ownerTotals(env, owner), declaredLength);
    if (full) return full;
  }

  const width = Number(request.headers.get(IMAGE_WIDTH_HEADER) ?? '0');
  const height = Number(request.headers.get(IMAGE_HEIGHT_HEADER) ?? '0');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return badRequest('invalid_dimensions');
  }
  const originalName = originalNameOf(request.headers.get(IMAGE_NAME_HEADER));

  const bytes = await request.arrayBuffer();
  // Content-Length is the caller's word; the body is the fact.
  if (bytes.byteLength > MAX_IMAGE_BYTES) return tooLarge();
  const sniffed = sniffImageType(new Uint8Array(bytes.slice(0, 16)));
  if (!sniffed || sniffed !== declaredType) return unsupported();

  // The hash of the file as picked, so the same file dedupes however its metadata is stripped below.
  const sha256 = await sha256Hex(bytes);
  const existing = await findBySha(env, owner, sha256);
  if (existing) return json({ image: existing, deduped: true });

  // A JPEG loses its metadata (GPS, camera serial, comments) before it is stored; the picture is
  // bit-identical. A malformed one is refused rather than stored with what it should have lost.
  let stored = bytes;
  if (sniffed === 'image/jpeg') {
    try {
      stored = stripJpegMetadata(bytes);
    } catch {
      return json({ error: 'malformed_jpeg' }, { status: 415 });
    }
  }

  const id = crypto.randomUUID();
  await bucket.put(id, stored, {
    httpMetadata: { contentType: sniffed },
    customMetadata: { owner, app },
  });
  let image;
  try {
    image = await insertImage(
      env,
      {
        id,
        owner,
        app,
        content_type: sniffed,
        byte_size: stored.byteLength,
        width,
        height,
        sha256,
        original_name: originalName,
      },
      caps,
    );
  } catch (err) {
    // No row will ever name these bytes, and the sweep only walks rows: never leave them.
    await bucket.delete(id);
    throw err;
  }
  if (!image) {
    await bucket.delete(id);
    // The same bytes landed at the same moment from another upload: theirs is the answer.
    const raced = await findBySha(env, owner, sha256);
    if (raced) return json({ image: raced, deduped: true });
    // A racing upload filled the gallery after the check above.
    return (
      galleryFull(caps, await ownerTotals(env, owner), stored.byteLength) ??
      json({ error: 'upload_conflict' }, { status: 409 })
    );
  }
  console.log('[media] stored', { app, id, bytes: stored.byteLength });
  return json({ image, deduped: false });
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// The file's own name: percent-encoded by the app, read raw when it doesn't decode, cut to
// ORIGINAL_NAME_MAX characters. Null when none was sent.
export function originalNameOf(header: string | null): string | null {
  if (header === null || header === '') return null;
  let name = header;
  try {
    name = decodeURIComponent(header);
  } catch {
    // A raw name with a lone `%`: kept as sent.
  }
  return Array.from(name).slice(0, ORIGINAL_NAME_MAX).join('');
}
