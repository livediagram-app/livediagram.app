// /api/images — per-owner gallery + dedup'd upload + auth-gated byte
// read (spec/19).

import { sha256Hex } from '@livediagram/api-schema';
import {
  deleteImage,
  diagramReferencesImage,
  findImageBySha,
  getDiagram,
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
  CORS_HEADERS,
  forbidden,
  imagesUnavailable,
  json,
  notFound,
} from '../responses';
import { gateRead, requireOwner, type RouteContext } from './context';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB, see spec/19.

// Parse a positive-integer cap from a wrangler.toml [vars] entry.
// Returns null when the string is missing, blank, non-numeric, or
// not strictly positive, so callers treat "unset" and "0" and
// "garbage" identically as "no cap" (the OSS self-host default per
// spec/19).
function parsePositiveCap(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
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
          error: 'unsupported-type',
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
      return json({ error: 'file-too-large', limitBytes: MAX_IMAGE_BYTES }, { status: 413 });
    }
    // Early dedupe via the client-supplied SHA (spec/19). The client
    // computes sha256(bytes) before posting and sends it as
    // X-Image-Sha256; if a row already exists at (owner, sha) the
    // server can return the existing image without touching the
    // body. Defence: the lookup is owner-scoped, so a malicious or
    // mistyped header at most lets the caller "dedupe" against
    // their OWN image (a no-op outcome) and never crosses owners.
    // Falls through to the post-parse dedupe + insert below when
    // the header is missing or doesn't match anything.
    const headerSha = (request.headers.get('X-Image-Sha256') ?? '').toLowerCase();
    if (/^[0-9a-f]{64}$/.test(headerSha)) {
      const headerDedupe = await findImageBySha(env, owner, headerSha);
      if (headerDedupe) {
        return json({ image: headerDedupe, deduped: true });
      }
    }
    // Per-owner soft cap (spec/19). Enforcement order: per-file cap
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
    if (maxImages !== null || maxBytes !== null) {
      const totals = await imageTotalsByOwner(env, owner);
      if (maxImages !== null && totals.count >= maxImages) {
        return json(
          {
            error: 'gallery-full',
            reason: 'count',
            limit: maxImages,
            current: totals.count,
          },
          { status: 403 },
        );
      }
      if (maxBytes !== null && totals.bytes + declaredLen > maxBytes) {
        return json(
          {
            error: 'gallery-full',
            reason: 'bytes',
            limit: maxBytes,
            current: totals.bytes,
          },
          { status: 403 },
        );
      }
    }
    const width = Number(request.headers.get('X-Image-Width') ?? '0');
    const height = Number(request.headers.get('X-Image-Height') ?? '0');
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return badRequest('missing or invalid X-Image-Width / X-Image-Height');
    }
    const originalName = request.headers.get('X-Image-Original-Name');
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      // Defence-in-depth: Content-Length is client-supplied
      // and could lie. Re-check after the buffer has fully
      // landed.
      return json({ error: 'file-too-large', limitBytes: MAX_IMAGE_BYTES }, { status: 413 });
    }
    const sniffed = sniffImageType(new Uint8Array(bytes.slice(0, 16)));
    if (!sniffed || sniffed !== declaredType) {
      return json(
        {
          error: 'unsupported-type',
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
    // chunk walkers. See spec/19 + image-strip.ts.
    let storedBytes: ArrayBuffer = bytes;
    if (sniffed === 'image/jpeg') {
      try {
        storedBytes = stripJpegMetadata(bytes);
      } catch {
        // Malformed JPEG: fail the upload rather than store
        // the original (which would leak the metadata we're
        // trying to remove). The user can re-export a clean
        // copy and retry.
        return json({ error: 'malformed-jpeg' }, { status: 415 });
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
    const image = await insertImage(env, {
      id,
      ownerId: owner,
      contentType: sniffed,
      byteSize: storedBytes.byteLength,
      width,
      height,
      sha256: sha,
      originalName,
    });
    return json({ image, deduped: false });
  }

  // GET /api/images/usage: owner-only. Returns the inverse
  // index used by the Explorer Image Gallery: imageId →
  // [{ id, name }] for every owned diagram that references
  // it. Empty arrays for images that aren't placed on any
  // canvas yet (the entry simply doesn't appear in the map).
  // See spec/15 + spec/19.
  if (segments.length === 3 && segments[2] === 'usage' && request.method === 'GET') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const usage = await imageUsageByOwner(env, owner);
    return json({ usage });
  }

  // GET /api/images/:id: byte read. Auth: owner of the
  // image, OR caller has read access to the diagram named
  // by `?d=<diagramId>` (owner or X-Share-Code) AND that
  // diagram references this image.
  if (segments.length === 3 && request.method === 'GET') {
    const imageId = segments[2]!;
    const meta = await getImage(env, imageId);
    if (!meta) return notFound();
    const callerOwner = resolveOwner();
    let allowed = callerOwner === meta.ownerId;
    if (!allowed) {
      const d = url.searchParams.get('d');
      if (d) {
        // Reader must be able to read diagram `d` (owner OR
        // a valid share code that resolves to it), AND that
        // diagram must actually use this image. The image's
        // own owner doesn't have to be the share-code's
        // owner: if a diagram references an image owned by
        // a different owner (only happens via Copy-Diagram
        // in v1), the share recipient can still load it.
        const diagram = await getDiagram(env, d);
        if (diagram) {
          // canReadDiagram (owner OR any valid share code
          // mapping to this diagram, see auth/diagram-access.ts)
          // is the same access policy spelled out inline here
          // before commit 069b785 / 5527329 extracted it.
          // Reusing the helper keeps the image-read auth in
          // step with the tab-read auth automatically: a
          // future tightening of the share-code check (e.g.
          // explicit expiry, IP throttling) lands once and
          // both routes follow.
          const diagramReadable = await gateRead(ctx, d, diagram.ownerId, diagram.teamId);
          if (diagramReadable) {
            allowed = await diagramReferencesImage(env, d, imageId);
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
    return new Response(object.body, { headers });
  }

  // DELETE /api/images/:id: gallery delete. Owner only.
  // Removes the R2 object + the D1 row. Existing references
  // on diagrams stay; the renderer falls back to a broken-
  // image placeholder.
  if (segments.length === 3 && request.method === 'DELETE') {
    const imageId = segments[2]!;
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const meta = await getImage(env, imageId);
    if (!meta) return json({ ok: true });
    if (meta.ownerId !== owner) return forbidden();
    await env.IMAGES.delete(imageId);
    await deleteImage(env, imageId);
    return json({ ok: true });
  }

  return notFound();
}
