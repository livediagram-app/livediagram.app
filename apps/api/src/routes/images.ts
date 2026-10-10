// /api/images — per-owner gallery + dedup'd upload + auth-gated byte
// read (docs/specs/009-elements/images.md).

import { sha256Hex } from '@livediagram/api-schema';
import {
  deleteImage,
  documentServesImage,
  findImageBySha,
  getDocument,
  getImage,
  imageTotalsByOwner,
  imageUsageByOwner,
  insertImage,
  listImagesByOwner,
} from '../db';
import { ACCEPTED_IMAGE_TYPES, type AcceptedImageType, sniffImageType } from '../image-sniff';
import { stripJpegMetadata } from '../image-strip';
import {
  badRequest,
  conflict,
  CORS_HEADERS,
  forbidden,
  imagesUnavailable,
  json,
  notFound,
} from '../responses';
import { MAX_IMAGE_BYTES } from '../limits';
import { recordImageUploaded } from '../timeline';
import { COMMUNITY_CONTENT, gateGrant, requireOwner, type RouteContext } from './context';

// Parse a positive-integer cap from a wrangler.toml [vars] entry.
// Returns null when the string is missing, blank, non-numeric, or
// not strictly positive, so callers treat "unset" and "0" and
// "garbage" identically as "no cap" (the OSS self-host default per
// docs/specs/009-elements/images.md).
export function parsePositiveCap(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

// The 403 a full gallery answers with, or null when the upload fits.
function galleryFull(
  caps: { maxImages: number | null; maxBytes: number | null },
  totals: { count: number; bytes: number },
  incomingBytes: number,
): Response | null {
  if (caps.maxImages !== null && totals.count >= caps.maxImages) {
    return json(
      { error: 'gallery_full', reason: 'count', limit: caps.maxImages, current: totals.count },
      { status: 403 },
    );
  }
  if (caps.maxBytes !== null && totals.bytes + incomingBytes > caps.maxBytes) {
    return json(
      { error: 'gallery_full', reason: 'bytes', limit: caps.maxBytes, current: totals.bytes },
      { status: 403 },
    );
  }
  return null;
}

// Per-owner gallery + dedup'd upload + auth-gated byte read.
// When the R2 binding is absent (self-host without R2), every
// endpoint returns 503 so the live app can hide the feature
// without falling through to a generic 500.
export async function handleImages(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments, resolveOwner } = ctx;
  if (segments[1] !== 'images') return notFound();
  if (!env.IMAGES) return imagesUnavailable();

  // GET /api/images: gallery list. Owner only.
  if (segments.length === 2 && request.method === 'GET') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const images = await listImagesByOwner(env, owner);
    return json({ images });
  }

  // POST /api/images: upload + dedupe. Body: raw image bytes.
  // Owner only. Server sniffs magic bytes against the
  // declared Content-Type so a forged header can't slip an
  // SVG / arbitrary file through. SHA-256 + dimensions come
  // in via headers; the server independently verifies the
  // SHA before trusting it (the dedupe key has to be the
  // body's real hash, not whatever the client claimed).
  if (segments.length === 2 && request.method === 'POST') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const declaredType = (request.headers.get('Content-Type') ?? '').toLowerCase();
    if (!ACCEPTED_IMAGE_TYPES.includes(declaredType as AcceptedImageType)) {
      return json(
        {
          error: 'unsupported_type',
          acceptedTypes: ACCEPTED_IMAGE_TYPES,
        },
        { status: 415 },
      );
    }
    const declaredLen = Number(request.headers.get('Content-Length') ?? '0');
    if (!Number.isFinite(declaredLen) || declaredLen <= 0) {
      return badRequest('missing or invalid Content-Length');
    }
    if (declaredLen > MAX_IMAGE_BYTES) {
      return json({ error: 'file_too_large', limitBytes: MAX_IMAGE_BYTES }, { status: 413 });
    }
    // Early dedupe via the client-supplied SHA (docs/specs/009-elements/images.md). The client
    // computes sha256(bytes) before posting and sends it as
    // X-Image-Sha256; if a row already exists at (owner, sha) the
    // server can return the existing image without touching the
    // body. Defence: the lookup is owner-scoped, so a malicious or
    // mistyped header at most lets the caller "dedupe" against
    // their OWN image (a no-op outcome) and never crosses owners.
    // Falls through to the post-parse dedupe + insert below when
    // the header is missing or doesn't match anything.
    // Not for a workbench session or an API token: they act for the owner without being the owner's
    // own editor, and the shortcut answers a bare hash with the gallery row (id, name, size) without
    // reading a byte, so it would let them probe the gallery for any file they can hash. They upload
    // the body, and the body-hash dedupe below still answers a real duplicate.
    const headerSha = (request.headers.get('X-Image-Sha256') ?? '').toLowerCase();
    if (!ctx.workbench && !ctx.token && /^[0-9a-f]{64}$/.test(headerSha)) {
      const headerDedupe = await findImageBySha(env, owner, headerSha);
      if (headerDedupe) {
        return json({ image: headerDedupe, deduped: true });
      }
    }
    // Per-owner soft cap (docs/specs/009-elements/images.md). Enforcement order: per-file cap
    // first (above) so an oversize upload is rejected before any D1
    // round-trip; then this owner-sum check so the body parse only
    // happens for uploads that would actually land. Both caps zero
    // out when their env var is unset, which is the OSS self-host
    // default. Dedupe via the body-recomputed hash happens AFTER
    // the body parse below, so a deduped upload that would not grow
    // either total still pays the parse: that is acceptable because
    // the early X-Image-Sha256 path above already handles the common
    // dedupe case without the parse.
    const maxImages = parsePositiveCap(env.IMAGE_MAX_PER_OWNER);
    const maxBytes = parsePositiveCap(env.IMAGE_MAX_BYTES_PER_OWNER);
    const caps = { maxImages, maxBytes };
    if (maxImages !== null || maxBytes !== null) {
      const full = galleryFull(caps, await imageTotalsByOwner(env, owner), declaredLen);
      if (full) return full;
    }
    const width = Number(request.headers.get('X-Image-Width') ?? '0');
    const height = Number(request.headers.get('X-Image-Height') ?? '0');
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return badRequest('missing or invalid X-Image-Width / X-Image-Height');
    }
    const originalName = originalNameOf(request.headers.get('X-Image-Original-Name'));
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      // Defence-in-depth: Content-Length is client-supplied
      // and could lie. Re-check after the buffer has fully
      // landed.
      return json({ error: 'file_too_large', limitBytes: MAX_IMAGE_BYTES }, { status: 413 });
    }
    const sniffed = sniffImageType(new Uint8Array(bytes.slice(0, 16)));
    if (!sniffed || sniffed !== declaredType) {
      return json(
        {
          error: 'unsupported_type',
          acceptedTypes: ACCEPTED_IMAGE_TYPES,
        },
        { status: 415 },
      );
    }
    const sha = await sha256Hex(bytes);
    // Dedupe: same owner + same bytes returns the existing
    // row without an R2 write. We hash the ORIGINAL bytes
    // (matching the client-supplied SHA) so re-uploading the
    // same file deduplicates predictably; the stored bytes
    // below may differ from the hashed bytes when JPEG
    // metadata is stripped.
    const existing = await findImageBySha(env, owner, sha);
    if (existing) {
      return json({ image: existing, deduped: true });
    }
    // Strip metadata from JPEGs (EXIF GPS, camera serial,
    // JFIF / ICC / comment markers) before writing to R2.
    // The visible image content stays bit-identical; only
    // the privacy-sensitive byte segments leave. PNG / WebP
    // / GIF pass through unchanged: real-world leaks via
    // those formats are rare and would need per-format
    // chunk walkers. See docs/specs/009-elements/images.md + image-strip.ts.
    let storedBytes: ArrayBuffer = bytes;
    if (sniffed === 'image/jpeg') {
      try {
        storedBytes = stripJpegMetadata(bytes);
      } catch {
        // Malformed JPEG: fail the upload rather than store
        // the original (which would leak the metadata we're
        // trying to remove). The user can re-export a clean
        // copy and retry.
        return json({ error: 'malformed_jpeg' }, { status: 415 });
      }
    }
    const id = crypto.randomUUID();
    await env.IMAGES.put(id, storedBytes, {
      httpMetadata: { contentType: sniffed },
      customMetadata: {
        ownerId: owner,
        originalName: originalName ?? '',
      },
    });
    let image: Awaited<ReturnType<typeof insertImage>>;
    try {
      image = await insertImage(
        env,
        {
          id,
          ownerId: owner,
          contentType: sniffed,
          byteSize: storedBytes.byteLength,
          width,
          height,
          sha256: sha,
          originalName,
        },
        caps,
      );
    } catch (err) {
      // No row will ever name these bytes, and the retention sweep only walks rows: never leave them.
      await env.IMAGES.delete(id);
      throw err;
    }
    if (!image) {
      // The same bytes uploaded at the same moment (the file dropped twice, two tabs): the other upload's
      // row won. Ours is an orphan; the answer is theirs, as a dedupe.
      const raced = await findImageBySha(env, owner, sha);
      if (raced) {
        await env.IMAGES.delete(id);
        console.info('[images] racing upload of the same bytes deduped', { owner });
        return json({ image: raced, deduped: true });
      }
      // A concurrent upload filled the gallery after the check above; the
      // insert refused atomically, so the bytes just written are an orphan.
      await env.IMAGES.delete(id);
      console.info('[images] cap refused a racing upload', { owner });
      const totals = await imageTotalsByOwner(env, owner);
      // Room again already (an image was deleted meanwhile): let the client retry.
      return galleryFull(caps, totals, storedBytes.byteLength) ?? conflict('upload_conflict');
    }
    // docs/specs/013-workspace/timeline.md §4.5: only a genuinely NEW upload. The dedupe branches
    // above return early, so pasting the same screenshot twice is one
    // event, and the day's uploads coalesce into one counted bubble.
    ctx.waitUntil?.(recordImageUploaded(env, owner));
    return json({ image, deduped: false });
  }

  // GET /api/images/usage: owner-only. Returns the inverse
  // index used by the Explorer Image Gallery: imageId →
  // [{ id, name }] for every owned document that references
  // it. Empty arrays for images that aren't placed on any
  // canvas yet (the entry simply doesn't appear in the map).
  // See docs/specs/013-workspace/folders.md + docs/specs/009-elements/images.md.
  if (segments.length === 3 && segments[2] === 'usage' && request.method === 'GET') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const usage = await imageUsageByOwner(env, owner);
    return json({ usage });
  }

  // GET /api/images/:id: byte read. Auth: owner of the
  // image, OR caller has read access to the document named
  // by `?d=<documentId>` (owner or X-Share-Code) AND that
  // document references this image.
  if (segments.length === 3 && request.method === 'GET') {
    const imageId = segments[2]!;
    const meta = await getImage(env, imageId);
    if (!meta) return notFound();
    const callerOwner = resolveOwner();
    // A workbench session (docs/specs/013-workspace/workbench-embeds.md) never takes the owner shortcut and
    // reads through its own document only, so it cannot walk its owner's gallery by id.
    const workbench = ctx.workbench ?? null;
    let allowed = !workbench && callerOwner === meta.ownerId;
    if (!allowed) {
      const d = url.searchParams.get('d');
      if (d && (!workbench || d === workbench.documentId)) {
        // Reader must be able to read document `d` (owner OR
        // a valid share code that resolves to it), AND that
        // document must place this image AND may serve it: the
        // image's owner owns `d`, or `d` holds a placement grant
        // (a teammate's or collaborator's upload, or a copy).
        const liveDoc = await getDocument(env, d);
        if (liveDoc) {
          // canReadDocument (owner OR any valid share code
          // mapping to this document, see auth/document-access.ts)
          // is the same access policy spelled out inline here
          // before commit 069b785 / 5527329 extracted it.
          // Reusing the helper keeps the image-read auth in
          // step with the tab-read auth automatically: a
          // future tightening of the share-code check (e.g.
          // explicit expiry, IP throttling) lands once and
          // both routes follow.
          // A tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) reads the images their
          // own tab uses, not every image in the document.
          const grant = await gateGrant(ctx, d, liveDoc.ownerId, liveDoc.teamId, COMMUNITY_CONTENT);
          if (grant) {
            // Placed by the document AND servable by it (docs/specs/009-elements/images.md,
            // "Placement grants"): an id pasted into an unrelated document serves nothing.
            allowed = await documentServesImage(env, d, imageId, grant.tabScope);
            if (!allowed) {
              console.warn('[images] not servable by document', { documentId: d, imageId });
            }
          }
        }
      }
    }
    if (!allowed) return notFound();
    const object = await env.IMAGES.get(imageId);
    if (!object) return notFound();
    const headers = new Headers(CORS_HEADERS);
    headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream');
    // Private cache: each authorised viewer caches their own
    // copy on disk. No shared-CDN leak. The id is content-
    // addressed so cached bytes stay valid for the lifetime
    // of the row.
    headers.set('Cache-Control', 'private, max-age=86400');
    // The stored type is the sniffed one; never let a browser re-guess it.
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(object.body, { headers });
  }

  // DELETE /api/images/:id: gallery delete. Owner only.
  // Removes the D1 row, then the R2 object. Existing references
  // on documents stay; the renderer falls back to a broken-
  // image placeholder.
  if (segments.length === 3 && request.method === 'DELETE') {
    const imageId = segments[2]!;
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const meta = await getImage(env, imageId);
    if (!meta) return json({ ok: true });
    if (meta.ownerId !== owner) return forbidden();
    // The row first: a row is what dedupe and the byte read trust, so it must never outlive its
    // bytes. A D1 failure throws with both still in place; an R2 failure after it leaves bytes no
    // row names (storage kept, never an id that serves nothing), logged with the id.
    await deleteImage(env, imageId);
    try {
      await env.IMAGES.delete(imageId);
    } catch (err) {
      console.error('[images] R2 delete failed after the row was removed', { imageId }, err);
    }
    return json({ ok: true });
  }

  return notFound();
}

// The longest original name kept, in characters: R2's custom metadata holds 2 KB in all, and a name past it
// made the store throw. Safe range: 100 to 300.
export const ORIGINAL_NAME_MAX = 200;

/** The uploaded file's own name: percent-encoded by the editor (a header is Latin-1 only), read raw from an
 *  older client whose name does not decode, cut to ORIGINAL_NAME_MAX characters. Null when none was sent. */
export function originalNameOf(header: string | null): string | null {
  if (header === null) return null;
  let name = header;
  try {
    name = decodeURIComponent(header);
  } catch {
    // An older client's raw name (a lone `%`): kept as sent.
  }
  return Array.from(name).slice(0, ORIGINAL_NAME_MAX).join('');
}
