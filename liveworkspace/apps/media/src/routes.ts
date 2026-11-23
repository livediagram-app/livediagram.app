// The media API (`/api/media/app/*`, liveworkspace/docs/specs/006-media/media.md "The API"): what an app's own Worker
// does with the pictures of the people it has signed in. Each request names its app (X-Media-App) and
// carries that app's key as a bearer token. The app has already checked what only it can: who the
// person is, and for the bytes, that the viewer may see a document that places the image.

import {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_IMAGE_TYPES,
  IMAGE_HEIGHT_HEADER,
  IMAGE_NAME_HEADER,
  IMAGE_SHA256_HEADER,
  IMAGE_SOURCE_HEADER,
  imageSourceOf,
  imageTooLargeBody,
  MEDIA_DOCUMENT_HEADER,
  IMAGE_WIDTH_HEADER,
  isAcceptedFileType,
  isAcceptedImageType,
  isMediaApp,
  MAX_IMAGE_BYTES,
  MEDIA_APP_HEADER,
  MEDIA_ID_MAX,
  MEDIA_OWNER_HEADER,
  MEDIA_REFS_PER_DOCUMENT_MAX,
  MEDIA_REFS_SYNC_MAX,
  ORIGINAL_NAME_MAX,
  parseUnusedImageIds,
  sniffMediaType,
  type MediaApp,
  type MediaImage,
  type MediaRefsSync,
  type PayerLimits,
} from '@liveworkspace/media';
import { readCappedBody } from '@liveworkspace/api-kit/request-body';
import { MAX_JSON_BYTES } from './config';
import { appKey, indexAppOf, parsePositiveCap, type Env } from './env';
import { badRequest, forbidden, json, notFound, ok, unauthorized, unavailable } from './http';
import { releaseImage } from './release';
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
  unusedOf,
  usageOf,
  type Caps,
} from './images';
import { stripJpegMetadata } from './jpeg-strip';
import { deleteItemPreviews } from './previews/store';
import { claimRef, syncRefs } from './refs';
import { handleLibrary } from './library/routes';
import {
  deleteOwnerWalkthroughs,
  handleWalkthroughs,
  mergeOwnerWalkthroughs,
} from './walkthroughs';
import { deleteOwnerItems, mergeOwnerItems } from './library/store';
import { ownLimits, proOn, uploadLimits } from './tier';
import { handleOwnersUsage, isSubscriptionCaller } from './owners-usage';
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MEDIA_ID_MAX;

// What the data export's service names itself in X-Media-App (liveworkspace/docs/specs/006-media/media.md).
export const EXPORT_CALLER = 'export';

// Whether a request is the data export's service with its key (MEDIA_KEY_EXPORT).
async function isExportCaller(request: Request, env: Env): Promise<boolean> {
  if (request.headers.get(MEDIA_APP_HEADER) !== EXPORT_CALLER) return false;
  const expected = env.MEDIA_KEY_EXPORT?.trim();
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expected || !token) return false;
  return timingSafeEqual(token, expected);
}

// The app this request speaks for, or null when it doesn't carry that app's key.
async function callerApp(request: Request, env: Env): Promise<MediaApp | null> {
  const app = request.headers.get(MEDIA_APP_HEADER);
  if (!isMediaApp(app)) return null;
  const expected = appKey(env, app);
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expected || !token) return null;
  return (await timingSafeEqual(token, expected)) ? app : null;
}

// Read through a byte counter (api-kit's readCappedBody): a chunked body declares no length, so the Content-Length
// gate alone let one of any size be held whole before it was measured.
async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > MAX_JSON_BYTES || request.body === null) return undefined;
  try {
    const bytes = await readCappedBody(request.body as ReadableStream<Uint8Array>, MAX_JSON_BYTES);
    return bytes === null ? undefined : JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    // Broken off mid-read, or not JSON.
    return undefined;
  }
}

// An image's bytes, with whose it is: for an app to serve to someone it has let in, or for the data export.
async function imageBytes(env: Env, bucket: R2Bucket, id: string): Promise<Response> {
  // The row and the bytes are asked for together: one wait, not two, on every image an app serves.
  const [row, object] = await Promise.all([getImage(env, id), bucket.get(id)]);
  if (!row || !object) {
    // Bytes without a row (or the reverse) are never served, and an unread body is let go.
    await object?.body.cancel().catch(() => {});
    return notFound();
  }
  return new Response(object.body, {
    headers: {
      'Content-Type': row.content_type,
      'Content-Length': String(object.size),
      [MEDIA_OWNER_HEADER]: row.owner,
      'X-Content-Type-Options': 'nosniff',
      // The bytes behind an id never change, but who may see them does: the app sets its own.
      'Cache-Control': 'private, no-store',
      // A file that is not a picture (a PDF) is never active content (media.md "PDFs").
      ...(row.content_type.startsWith('image/')
        ? {}
        : { 'Content-Disposition': 'attachment', 'Content-Security-Policy': 'sandbox' }),
    },
  });
}

// The data export's two reads (liveworkspace/docs/specs/006-media/media.md): an owner's gallery and an image's bytes.
// Anything else answers as missing.
async function handleExportReads(
  request: Request,
  env: Env,
  url: URL,
  path: string,
): Promise<Response> {
  if (!env.MEDIA) return unavailable();
  if (request.method !== 'GET') return notFound();
  const segments = path.split('/').filter(Boolean);
  if (segments[0] !== 'images') return notFound();
  if (segments.length === 1) {
    const owner = url.searchParams.get('owner');
    if (!isId(owner)) return badRequest('invalid_owner');
    return json({ images: await listImages(env, owner) });
  }
  let id: string;
  try {
    id = decodeURIComponent(segments[1]!);
  } catch {
    return notFound();
  }
  if (segments.length !== 3 || segments[2] !== 'bytes' || !isId(id)) return notFound();
  return imageBytes(env, env.MEDIA, id);
}

export async function handleApp(
  request: Request,
  env: Env,
  url: URL,
  path: string,
): Promise<Response> {
  if (await isExportCaller(request, env)) return handleExportReads(request, env, url, path);
  // The subscription service's one read: what several owners hold, for a person's usage (media.md "With Pro on").
  if (await isSubscriptionCaller(request, env)) {
    return handleOwnersUsage(request, env, path, await readJson(request));
  }
  const app = await callerApp(request, env);
  if (!app) return unauthorized();
  if (!env.MEDIA) return unavailable();
  const bucket = env.MEDIA;
  // Decoded, as the client encodes them (packages/media client.ts): a guest owner is `guest:<hash>`, sent as
  // `guest%3A<hash>`, and must match the rows as stored.
  let segments: string[];
  try {
    segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return notFound();
  }
  const method = request.method;
  const owner = url.searchParams.get('owner');
  if (segments[0] === 'images') {
    // GET /app/images?owner=: the owner's gallery, from every app.
    if (segments.length === 1 && method === 'GET') {
      if (!isId(owner)) return badRequest('invalid_owner');
      // With Pro on the gallery also says what it uses of its owner's Image Storage (media.md "With Pro on").
      // With it off the list is the only read: no limits are asked for and nothing is totalled.
      const [limits, images, totals] = await Promise.all([
        ownLimits(env, owner),
        listImages(env, owner, 'pictures'),
        proOn(env) ? ownerTotals(env, owner) : null,
      ]);
      if (!limits || !totals) return json({ images });
      return json({
        images,
        storage: {
          used: totals.bytes,
          limit: limits.imageStorageBytes,
          maxImageBytes: limits.imageMaxBytes,
          owner: limits.storageOwner,
        },
      });
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
      return imageBytes(env, bucket, id);
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
      console.info('[media] deleted', { app, id });
      return ok();
    }
    // POST /app/images/<id>/release?document=: the document that claimed it no longer places it (media.md "Releases").
    if (segments.length === 3 && segments[2] === 'release' && method === 'POST') {
      const document = url.searchParams.get('document');
      if (!isId(document)) return badRequest('invalid_document');
      return json(await releaseImage(env, bucket, app, id, document));
    }
    return notFound();
  }

  // DELETE /app/previews/<itemId>: an item purged; every preview kept of it goes (liveworkspace/docs/specs/006-media/previews.md
  // "Purging"). Only the calling app's: the key names the app, and the app names the folder.
  if (segments[0] === 'previews' && segments.length === 2 && method === 'DELETE') {
    const itemId = segments[1];
    if (!isId(itemId)) return notFound();
    return json({ deleted: await deleteItemPreviews(bucket, indexAppOf(app), itemId) });
  }

  // /app/walkthroughs: the canvas apps' narrated recordings (liveworkspace/docs/specs/006-media/walkthroughs.md).
  if (segments[0] === 'walkthroughs') {
    return handleWalkthroughs(request, env, bucket, app, url, segments);
  }

  // POST /app/library/<route>: the Library (liveworkspace/docs/specs/006-media/libraries.md "The API").
  if (segments[0] === 'library' && segments.length === 2 && method === 'POST') {
    return handleLibrary(env, bucket, app, segments[1]!, await readJson(request));
  }

  // GET /app/usage?owner=: which documents, in any app, place each of the owner's images.
  if (segments[0] === 'usage' && segments.length === 1 && method === 'GET') {
    if (!isId(owner)) return badRequest('invalid_owner');
    return json(await usageOf(env, owner));
  }

  // GET /app/unused?owner=&document=&ids=: which of those images nothing but that document uses (media.md "Unused
  // after a delete").
  if (segments[0] === 'unused' && segments.length === 1 && method === 'GET') {
    if (!isId(owner)) return badRequest('invalid_owner');
    const document = url.searchParams.get('document');
    if (!isId(document)) return badRequest('invalid_document');
    const ids = parseUnusedImageIds(url.searchParams.get('ids'));
    if (!ids) return badRequest('invalid_ids');
    return json({ unused: await unusedOf(env, app, owner, document, ids) });
  }

  // POST /app/refs: the images each listed document places now.
  if (segments[0] === 'refs' && segments.length === 1 && method === 'POST') {
    const sync = parseRefsSync(await readJson(request));
    if (!sync) return badRequest('invalid_body');
    await syncRefs(env, app, sync.documents, sync.complete === true, sync.pending);
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
      // Their Personal library goes with their pictures (libraries.md "Account and guest lifecycle").
      const items = await mergeOwnerItems(env, body.from, body.to);
      // And their walkthroughs (walkthroughs.md "Deleting").
      const walkthroughs = await mergeOwnerWalkthroughs(env, body.from, body.to);
      console.info('[media] merged a guest', {
        app,
        moved: merged.moved.length,
        kept: merged.kept.length,
        items,
        walkthroughs,
      });
      return json(merged);
    }
    // DELETE /app/owners/<owner>: an account deleted, so every image it uploaded goes.
    if (segments.length === 2 && method === 'DELETE' && isId(segments[1])) {
      const ids = await deleteOwnerRows(env, segments[1]);
      await deleteOwnerItems(env, segments[1]);
      // Every walkthrough they recorded, in every app, goes with their pictures.
      const walkthroughs = await deleteOwnerWalkthroughs(env, bucket, segments[1]);
      for (let i = 0; i < ids.length; i += 1000) {
        try {
          await bucket.delete(ids.slice(i, i + 1000));
        } catch (err) {
          console.error('[media] R2 delete failed for a deleted owner', err);
        }
      }
      console.info('[media] forgot an owner', { app, deleted: ids.length, walkthroughs });
      return json({ deleted: ids.length });
    }
  }

  return notFound();
}

// `documents` and `pending` (unconfirmed references, media.md "Unconfirmed references") held together to the cap.
function parseRefsSync(value: unknown): MediaRefsSync | null {
  if (typeof value !== 'object' || value === null) return null;
  const { documents, pending, complete } = value as {
    documents?: unknown;
    pending?: unknown;
    complete?: unknown;
  };
  if (!Array.isArray(documents)) return null;
  if (pending !== undefined && !Array.isArray(pending)) return null;
  const vouched = pending ?? [];
  if (documents.length + vouched.length > MEDIA_REFS_SYNC_MAX) return null;
  if (complete !== undefined && typeof complete !== 'boolean') return null;
  const own = refEntries(documents);
  const unconfirmed = refEntries(vouched);
  if (!own || !unconfirmed) return null;
  return { documents: own, pending: unconfirmed, complete: complete === true };
}

// Each `{ document, images }` checked, or null when any is not.
function refEntries(entries: readonly unknown[]): MediaRefsSync['documents'] | null {
  const out: MediaRefsSync['documents'] = [];
  for (const entry of entries) {
    const { document, images } = (entry ?? {}) as { document?: unknown; images?: unknown };
    if (!isId(document) || !Array.isArray(images)) return null;
    if (images.length > MEDIA_REFS_PER_DOCUMENT_MAX || !images.every(isId)) return null;
    out.push({ document, images });
  }
  return out;
}

const unsupported = () =>
  json(
    { error: 'unsupported_type', acceptedTypes: [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_FILE_TYPES] },
    { status: 415 },
  );

// The 403 a full gallery answers with, or null when the upload fits. With Pro on it names whose tier set the limit:
// the gallery's own owner's, whoever owns the item the upload is for.
function galleryFull(
  caps: Caps,
  totals: { count: number; bytes: number },
  incoming: number,
  limits: PayerLimits | null,
) {
  const whose = limits ? { owner: limits.storageOwner } : {};
  if (caps.maxImages !== null && totals.count >= caps.maxImages) {
    return json(
      {
        error: 'gallery_full',
        reason: 'count',
        limit: caps.maxImages,
        current: totals.count,
        ...whose,
      },
      { status: 403 },
    );
  }
  if (caps.maxBytes !== null && totals.bytes + incoming > caps.maxBytes) {
    return json(
      {
        error: 'gallery_full',
        reason: 'bytes',
        limit: caps.maxBytes,
        current: totals.bytes,
        ...whose,
      },
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
  const isFile = isAcceptedFileType(declaredType);
  if (!isAcceptedImageType(declaredType) && !isFile) return unsupported();
  const declaredLength = Number(request.headers.get('Content-Length') ?? '0');
  if (!Number.isFinite(declaredLength) || declaredLength <= 0) return badRequest('missing_length');
  // With Pro on the largest image is the better of the uploader's tier and the item's owner's, and the gallery's
  // size is the uploader's own tier's, both read before the body (media.md "With Pro on"); with it off, the caps
  // this service always had.
  const limits = await uploadLimits(env, request, owner);
  const maxBytes = limits ? limits.imageMaxBytes : MAX_IMAGE_BYTES;
  const tooLarge = (size: number) =>
    json(
      imageTooLargeBody({ pro: limits !== null, maxBytes, owner: limits?.owner ?? null }, size),
      {
        status: 413,
      },
    );
  if (declaredLength > maxBytes) return tooLarge(declaredLength);
  const document = documentOf(request.headers.get(MEDIA_DOCUMENT_HEADER));
  if (document === false) return badRequest('invalid_document');
  // Every answer with an image, deduped or new, first records the document's reference to it.
  const answer = async (image: MediaImage, deduped: boolean) => {
    if (document) await claimRef(env, app, document, image.id);
    return json({ image, deduped });
  };

  const headerSha = (request.headers.get(IMAGE_SHA256_HEADER) ?? '').toLowerCase();
  if (/^[0-9a-f]{64}$/.test(headerSha)) {
    const known = await findBySha(env, owner, headerSha);
    if (known) return answer(known, true);
  }

  const caps: Caps = limits
    ? { maxImages: null, maxBytes: limits.imageStorageBytes }
    : {
        maxImages: parsePositiveCap(env.IMAGE_MAX_PER_OWNER),
        maxBytes: parsePositiveCap(env.IMAGE_MAX_BYTES_PER_OWNER),
      };
  if (caps.maxImages !== null || caps.maxBytes !== null) {
    const full = galleryFull(caps, await ownerTotals(env, owner), declaredLength, limits);
    if (full) return full;
  }

  // A PDF has no size to draw at: stored 0 by 0, whatever was sent (media.md "PDFs").
  const width = isFile ? 0 : Number(request.headers.get(IMAGE_WIDTH_HEADER) ?? '0');
  const height = isFile ? 0 : Number(request.headers.get(IMAGE_HEIGHT_HEADER) ?? '0');
  if (
    !isFile &&
    (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
  ) {
    return badRequest('invalid_dimensions');
  }
  const originalName = originalNameOf(request.headers.get(IMAGE_NAME_HEADER));
  const source = imageSourceOf(request.headers.get(IMAGE_SOURCE_HEADER));

  const bytes = await request.arrayBuffer();
  // Content-Length is the caller's word; the body is the fact.
  if (bytes.byteLength > maxBytes) return tooLarge(bytes.byteLength);
  const sniffed = sniffMediaType(new Uint8Array(bytes.slice(0, 16)));
  if (!sniffed || sniffed !== declaredType) return unsupported();

  // The hash of the file as picked, so the same file dedupes however its metadata is stripped below.
  const sha256 = await sha256Hex(bytes);
  const existing = await findBySha(env, owner, sha256);
  if (existing) return answer(existing, true);

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
        document,
        source,
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
    if (raced) return answer(raced, true);
    // A racing upload filled the gallery after the check above.
    return (
      galleryFull(caps, await ownerTotals(env, owner), stored.byteLength, limits) ??
      json({ error: 'upload_conflict' }, { status: 409 })
    );
  }
  console.info('[media] stored', { app, id, bytes: stored.byteLength });
  return answer(image, false);
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// The document an upload is for: null when none was named, false when it is longer than an id may be.
export function documentOf(header: string | null): string | null | false {
  if (header === null || header === '') return null;
  return header.length > MEDIA_ID_MAX ? false : header;
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
