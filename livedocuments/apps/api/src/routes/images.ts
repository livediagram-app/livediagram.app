// /api/images — the gallery, uploads and the auth-gated byte read (docs/specs/009-elements/images.md). The
// images live in liveworkspace's media service (liveworkspace/docs/media.md, src/media.ts): this route keeps
// who may do what, and the service keeps the bytes, the dedupe and the caps.

import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, ORIGINAL_NAME_MAX } from '@liveworkspace/media';
import type { MediaClient } from '@liveworkspace/media';
import { documentRoom } from '../document-client';
import { indexFor } from '../index-service';
import {
  imageSummary,
  MEDIA_APP,
  mediaClient,
  mediaImageOwner,
  mediaOwner,
  rememberMediaOwner,
} from '../media';
import { badRequest, CORS_HEADERS, imagesUnavailable, json, notFound } from '../responses';
import { grantCallerOf, requireOwner, type RouteContext } from './context';
import { resolveDocumentGrant } from './document-grant';

// The Gallery's "Used in" names: at most this many documents are looked up in the index, this many at once.
export const USAGE_DOCUMENTS_MAX = 200;
const USAGE_LOOKUPS_IN_FLIGHT = 6;

// Without the service (a self-host without MEDIA_KEY) every endpoint answers 503, so the editor hides
// images rather than falling through to a generic 500.
export async function handleImages(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments, resolveOwner } = ctx;
  if (segments[1] !== 'images') return notFound();
  const media = mediaClient(env);
  if (!media) return imagesUnavailable();

  // GET /api/images: the owner's gallery, from every app. Owner only. Each image's owner is remembered as the
  // service has it now (src/media.ts), so their own reads of it take the owner shortcut without asking again.
  if (segments.length === 2 && request.method === 'GET') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const named = await mediaOwner(owner);
    const listed = await media.list(named);
    if (!listed.ok) return serviceAnswer(listed);
    const images = listed.value.images;
    for (const image of images) rememberMediaOwner(image.id, named);
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
    const named = await mediaOwner(owner);
    const uploaded = await media.upload({
      owner: named,
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
    rememberMediaOwner(image.id, named);
    return json({ image: imageSummary(image), deduped });
  }

  // GET /api/images/usage: owner-only. The Explorer Image Gallery's "Used in" badge: imageId → [{ id, name }] for
  // every document of theirs that places it, ordered by name. An image no document places has no entry. Which
  // documents place each image is the media service's (each document tells it, document-outbox.ts); their names
  // and owners are the index's (docs/specs/009-elements/images.md).
  if (segments.length === 3 && segments[2] === 'usage' && request.method === 'GET') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    return json({ usage: await usageOf(ctx, media, owner) });
  }

  // GET /api/images/:id: byte read. Auth: owner of the
  // image, OR caller has read access to the document named
  // by `?d=<documentId>` (owner or X-Share-Code) AND that
  // document references this image.
  if (segments.length === 3 && request.method === 'GET') {
    const imageId = segments[2]!;
    const callerOwner = resolveOwner();
    const imageOwner = await mediaImageOwner(media, imageId);
    if (imageOwner === '') return notFound();
    // A document-scope workbench session (docs/specs/013-workspace/workbench-embeds.md) never takes the owner
    // shortcut and reads through its own document only, so it cannot walk its owner's gallery by id. A workspace
    // session reaches the gallery, as the Explorer does, so it reads as its person.
    const workbench = ctx.workbench?.scope === 'document' ? ctx.workbench : null;
    let allowed =
      !workbench && callerOwner !== null && (await mediaOwner(callerOwner)) === imageOwner;
    if (!allowed) {
      const d = url.searchParams.get('d');
      if (d && (!workbench || d === workbench.documentId)) {
        // The reader must be able to read document `d` (the index's grant: the X-Index-Grant the editor sends, or
        // one asked for the caller and the share code they carry), and `d` must place this image AND
        // may serve it (docs/specs/009-elements/images.md, "Placement grants"): the image's owner owns `d`, or `d`
        // holds a placement grant (a teammate's or collaborator's upload, or a copy's). Both are the document's own
        // to answer, in one call to its Durable Object, so an image placed a moment ago serves at once. A
        // tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) reads the images their own tab
        // uses, not every image in the document.
        const grant = await resolveDocumentGrant(ctx, d);
        if (grant && !(grant instanceof Response)) {
          allowed = await documentRoom(env, d).servesImage(imageId, grant.tab);
          if (!allowed) console.warn('[images] not servable by document', { documentId: d, imageId });
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
    rememberMediaOwner(imageId, null);
    return json({ ok: true });
  }

  return notFound();
}

// The Gallery's usage map: the documents of this app the media service says place each of the owner's images,
// kept to those the index answers as theirs and not in the Trash, named as the index has them. At most
// USAGE_DOCUMENTS_MAX documents are looked up (USAGE_LOOKUPS_IN_FLIGHT at a time); a document past that, or one the
// index cannot answer, is left out of the badge rather than failing the Gallery.
async function usageOf(
  ctx: RouteContext,
  media: MediaClient,
  owner: string,
): Promise<Record<string, { id: string; name: string }[]>> {
  const usage: Record<string, { id: string; name: string }[]> = {};
  const answered = await media.usage(await mediaOwner(owner));
  if (!answered.ok) {
    console.error('[images] media usage answered', answered.status);
    return usage;
  }
  const placed = Object.entries(answered.value.usage);
  const documents = [
    ...new Set(placed.flatMap(([, refs]) => refs.filter((r) => r.app === MEDIA_APP).map((r) => r.document))),
  ].slice(0, USAGE_DOCUMENTS_MAX);
  const client = indexFor(ctx.env, grantCallerOf(ctx));
  if (!client || documents.length === 0) return usage;
  const names = new Map<string, string>();
  for (let i = 0; i < documents.length; i += USAGE_LOOKUPS_IN_FLIGHT) {
    await Promise.all(
      documents.slice(i, i + USAGE_LOOKUPS_IN_FLIGHT).map(async (id) => {
        try {
          const { item } = await client.getItem(id);
          if (item.ownerId === owner && item.trashedAt === null) names.set(id, item.title);
        } catch {
          // Gone, or not theirs to read: not in the badge.
        }
      }),
    );
  }
  for (const [imageId, refs] of placed) {
    const docs = refs
      .filter((r) => r.app === MEDIA_APP && names.has(r.document))
      .map((r) => ({ id: r.document, name: names.get(r.document)! }));
    if (docs.length === 0) continue;
    const seen = new Set<string>();
    usage[imageId] = docs
      .filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }
  return usage;
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
