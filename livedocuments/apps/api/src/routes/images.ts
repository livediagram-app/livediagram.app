// /api/images — the gallery, uploads and the auth-gated byte read (docs/specs/009-elements/images.md). The
// images live in liveworkspace's media service (liveworkspace/docs/media.md, src/media.ts): this route keeps
// who may do what, and the service keeps the bytes, the dedupe and the caps.

import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, ORIGINAL_NAME_MAX } from '@liveworkspace/media';
import { documentServesImage, getDocumentMeta, imageUsageByOwner } from '../db';
import {
  imageSummary,
  mediaClient,
  mediaImageOwner,
  mediaOwner,
  rememberMediaImages,
} from '../media';
import { badRequest, CORS_HEADERS, imagesUnavailable, json, notFound } from '../responses';
import { recordImageUploaded } from '../timeline';
import { gateGrant, requireOwner, type RouteContext } from './context';

// Without the service (a self-host without MEDIA_KEY) every endpoint answers 503, so the editor hides
// images rather than falling through to a generic 500.
export async function handleImages(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments, resolveOwner } = ctx;
  if (segments[1] !== 'images') return notFound();
  const media = mediaClient(env);
  if (!media) return imagesUnavailable();

  // GET /api/images: the owner's gallery, from every app. Owner only. Each image is remembered as
  // theirs, so a document of theirs placing one uploaded in another app serves it.
  if (segments.length === 2 && request.method === 'GET') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const listed = await media.list(await mediaOwner(owner));
    if (!listed.ok) return serviceAnswer(listed);
    const images = listed.value.images;
    await rememberMediaImages(
      env,
      owner,
      images.map((i) => i.id),
    );
    return json({ images: images.map(imageSummary) });
  }

  // POST /api/images: upload, deduped. Body: the raw image bytes. Owner only. The service checks the
  // type against the bytes, dedupes, caps the gallery and strips JPEG metadata; the declared type and
  // length are checked here first so a refused file never leaves this Worker.
  if (segments.length === 2 && request.method === 'POST') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const declaredType = (request.headers.get('Content-Type') ?? '').toLowerCase();
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(declaredType)) {
      return json(
        { error: 'unsupported_type', acceptedTypes: ACCEPTED_IMAGE_TYPES },
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
    // The hash shortcut answers a bare hash with the gallery row without reading a byte, so only the
    // owner's own editor sends it: a workbench session or an API token acts for the owner without being
    // them, and could probe the gallery for any file it can hash. They upload the body, and the service
    // still dedupes on its real hash.
    const headerSha = (request.headers.get('X-Image-Sha256') ?? '').toLowerCase();
    const sha256 =
      !ctx.workbench && !ctx.token && /^[0-9a-f]{64}$/.test(headerSha) ? headerSha : null;
    // Read whole (at most MAX_IMAGE_BYTES, checked above) so the service gets an exact length.
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      // Content-Length is the client's word; the body is the truth.
      return json({ error: 'file_too_large', limitBytes: MAX_IMAGE_BYTES }, { status: 413 });
    }
    const uploaded = await media.upload({
      owner: await mediaOwner(owner),
      bytes,
      contentType: declaredType,
      byteSize: bytes.byteLength,
      width: Number(request.headers.get('X-Image-Width') ?? '0'),
      height: Number(request.headers.get('X-Image-Height') ?? '0'),
      originalName: originalNameOf(request.headers.get('X-Image-Original-Name')),
      sha256,
    });
    if (!uploaded.ok) return serviceAnswer(uploaded);
    const { image, deduped } = uploaded.value;
    await rememberMediaImages(env, owner, [image.id]);
    // docs/specs/013-workspace/timeline.md §4.5: only a genuinely NEW upload, so pasting the same
    // screenshot twice is one event, and the day's uploads coalesce into one counted bubble.
    if (!deduped) ctx.waitUntil?.(recordImageUploaded(env, owner));
    return json({ image: imageSummary(image), deduped });
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
    const callerOwner = resolveOwner();
    const imageOwner = await mediaImageOwner(env, media, imageId, callerOwner);
    if (imageOwner === null) return notFound();
    // A document-scope workbench session (docs/specs/013-workspace/workbench-embeds.md) never takes the owner
    // shortcut and reads through its own document only, so it cannot walk its owner's gallery by id. A workspace
    // session reaches the gallery, as the Explorer does, so it reads as its person.
    const workbench = ctx.workbench?.scope === 'document' ? ctx.workbench : null;
    let allowed = !workbench && callerOwner === imageOwner;
    if (!allowed) {
      const d = url.searchParams.get('d');
      if (d && (!workbench || d === workbench.documentId)) {
        // Reader must be able to read document `d` (owner OR
        // a valid share code that resolves to it), AND that
        // document must place this image AND may serve it: the
        // image's owner owns `d`, or `d` holds a placement grant
        // (a teammate's or collaborator's upload, or a copy).
        // The owner and team are all the gate needs: one row, not the full document load (its
        // participants and tab summary), which ran once for every image a visitor's board shows.
        const liveDoc = await getDocumentMeta(env, d);
        if (liveDoc) {
          // The same access policy as the tab read (auth/document-access.ts), so a tightening of the
          // share-code check lands once and both routes follow. A tab-scoped visitor
          // (docs/specs/013-workspace/tab-scoped-share-links.md) reads the images their own tab uses,
          // not every image in the document.
          const grant = await gateGrant(ctx, d, liveDoc.ownerId, liveDoc.teamId);
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
    const object = await media.bytes(imageId);
    if (!object?.body) return notFound();
    const headers = new Headers(CORS_HEADERS);
    headers.set('Content-Type', object.contentType);
    // Private cache: each authorised viewer caches their own
    // copy on disk. No shared-CDN leak. An image's bytes never
    // change under its id, so cached bytes stay valid.
    headers.set('Cache-Control', 'private, max-age=86400');
    // The stored type is the sniffed one; never let a browser re-guess it.
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(object.body, { headers });
  }

  // DELETE /api/images/:id: gallery delete. Owner only, which the
  // service checks. Existing references on documents stay; the
  // renderer falls back to a broken-image placeholder.
  if (segments.length === 3 && request.method === 'DELETE') {
    const imageId = segments[2]!;
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const removed = await media.remove(await mediaOwner(owner), imageId);
    if (!removed.ok) return serviceAnswer(removed);
    await env.DB.prepare('DELETE FROM media_images WHERE id = ?').bind(imageId).run();
    return json({ ok: true });
  }

  return notFound();
}

// A refusal from the service, passed on as it came (a full gallery, an unsupported file), except one
// that is about this api's own key or the service itself, which the editor can do nothing about.
function serviceAnswer(failed: { status: number; body: Record<string, unknown> }): Response {
  if (failed.status === 401 || failed.status >= 500) {
    console.error('[images] media service answered', failed.status, failed.body);
    return imagesUnavailable();
  }
  return json(failed.body, { status: failed.status });
}

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
