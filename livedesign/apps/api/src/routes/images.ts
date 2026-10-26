// /api/images — the gallery, uploads and the auth-gated byte read (docs/specs/009-elements/images.md). The
// images live in liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md, src/media.ts): this route keeps
// who may do what, and the service keeps the bytes, the dedupe and the caps.

import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, ORIGINAL_NAME_MAX } from '@liveworkspace/media';
import { galleryUsage, type MediaClient } from '@liveworkspace/media';
import { reportImagesUploaded } from '@liveworkspace/index-app';
import { designRoom } from '../design-client';
import { indexAppClient } from '../index-service';
import { imageSummary, mediaClient, mediaImageOwnerFor, mediaOwner } from '../media';
import { badRequest, CORS_HEADERS, imagesUnavailable, json, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';
import { resolveDesignGrant } from './design-grant';
import { clientFor } from './index-adapters';

// Without the service (a deployment without MEDIA_KEY) every endpoint answers 503, so the editor hides
// images rather than falling through to a generic 500.
export async function handleImages(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments, resolveOwner } = ctx;
  if (segments[1] !== 'images') return notFound();
  const media = mediaClient(env);
  if (!media) return imagesUnavailable();

  // GET /api/images: the owner's gallery, from every app. Owner only. A design of theirs placing one uploaded in
  // another app serves it: whose an image is is the service's answer, wherever it was uploaded.
  if (segments.length === 2 && request.method === 'GET') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const listed = await media.list(await mediaOwner(owner));
    if (!listed.ok) return serviceAnswer(listed);
    return json({ images: listed.value.images.map(imageSummary) });
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
    // On the uploader's Timeline (one entry a day, counting up); the same bytes again are no news.
    if (!deduped) ctx.waitUntil?.(reportImagesUploaded(indexAppClient(env), owner));
    return json({ image: imageSummary(image), deduped });
  }

  // GET /api/images/usage: owner-only. The inverse index the Explorer's Image Gallery shows: imageId →
  // [{ id, name, app }] for every item, in any app, the caller can open that places it, from the media service's
  // references (each item sends its own) with the names from the index. An image nothing places has no entry.
  // See docs/specs/013-workspace/folders.md + docs/specs/009-elements/images.md.
  if (segments.length === 3 && segments[2] === 'usage' && request.method === 'GET') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    return imageUsage(ctx, media, owner);
  }

  // GET /api/images/:id: byte read. Auth: owner of the
  // image, OR caller has read access to the design named
  // by `?d=<designId>` (owner or X-Share-Code) AND that
  // design references this image.
  if (segments.length === 3 && request.method === 'GET') {
    const imageId = segments[2]!;
    const callerOwner = resolveOwner();
    const imageOwner = await mediaImageOwnerFor(media, imageId, callerOwner);
    if (imageOwner === null) return notFound();
    // A design-scope workbench session (docs/specs/013-workspace/workbench-embeds.md) never takes the owner
    // shortcut and reads through its own design only, so it cannot walk its owner's gallery by id. A workspace
    // session reaches the gallery, as the Explorer does, so it reads as its person.
    const workbench = ctx.workbench?.scope === 'design' ? ctx.workbench : null;
    let allowed = !workbench && callerOwner === imageOwner;
    if (!allowed) {
      const d = url.searchParams.get('d');
      if (d && (!workbench || d === workbench.designId)) {
        // The reader may read design `d` (the index's grant, a share link's included), AND that design places
        // this image AND may serve it: the image's owner owns `d`, or `d` holds a placement grant (a teammate's
        // or collaborator's upload, or a copy). A tab-scoped visitor
        // (docs/specs/013-workspace/tab-scoped-share-links.md) reads the images their own tab uses, not every
        // image in the design. Answered by the design's own object, from its reference index.
        const grant = await resolveDesignGrant(ctx, d);
        if (grant instanceof Response) return grant;
        if (grant) {
          allowed = await designRoom(env, d).servesImage(imageId, grant.tab);
          if (!allowed) console.warn('[images] not servable by design', { designId: d, imageId });
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
  // service checks. Existing references on designs stay; the
  // renderer falls back to a broken-image placeholder.
  if (segments.length === 3 && request.method === 'DELETE') {
    const imageId = segments[2]!;
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const removed = await media.remove(await mediaOwner(owner), imageId);
    if (!removed.ok) return serviceAnswer(removed);
    return json({ ok: true });
  }

  return notFound();
}

// Designs named per usage answer: a gallery's images are placed on a few designs each, and a name is one index
// read, run IMAGE_USAGE_READS at a time.
export const IMAGE_USAGE_DESIGNS_MAX = 200;
const IMAGE_USAGE_READS = 8;

// The items, in every app, that place each image (@liveworkspace/media galleryUsage): the gallery lists every app's
// images, so an image placed only in another app's items is used there, not "Not used".
async function imageUsage(ctx: RouteContext, media: MediaClient, owner: string): Promise<Response> {
  const answered = await media.usage(await mediaOwner(owner));
  if (!answered.ok) return serviceAnswer(answered);
  if (Object.keys(answered.value.usage).length === 0) return json({ usage: {} });
  const client = clientFor(ctx);
  if (client instanceof Response) return client;
  const usage = await galleryUsage(
    answered.value.usage,
    async (app, id) => {
      const { item } = await client.getItem(id);
      // Gone, another app's id, trashed or not the caller's to open: not shown.
      return item.app === app && !item.trashedAt ? item.title : null;
    },
    { max: IMAGE_USAGE_DESIGNS_MAX, inFlight: IMAGE_USAGE_READS },
  );
  return json({ usage });
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
