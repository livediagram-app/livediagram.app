// /api/images: the pictures of Image fields (docs/specs/026-plan/item-types.md "Image fields"), an upload for one
// plan, the check of which pictures were uploaded for it (an agent's, before it places them) and the auth-gated byte
// read. The pictures live in liveworkspace's media service
// (liveworkspace/docs/specs/006-media/media.md, src/media.ts), in their uploader's gallery: this route keeps who may
// upload for a plan and who may see what, and the service keeps the bytes, the dedupe and the caps. Each plan
// records the pictures uploaded for it (plan-room/image-grants.ts). There is no gallery list, usage or delete here:
// the Explorer's gallery lists a person's images from every app.

import {
  IMAGE_GRANT_CHECK_MAX,
  levelAtLeast,
  type GrantedImage,
  type ImageGrantsResponse,
} from '@liveplanner/api-schema';
import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_SOURCE_HEADER,
  imageSourceOf,
  MAX_IMAGE_BYTES,
  ORIGINAL_NAME_MAX,
  type MediaClient,
} from '@liveworkspace/media';
import {
  imageSummary,
  mediaClient,
  mediaImageOwner,
  mediaOwner,
  rememberMediaOwner,
} from '../media';
import { IMAGE_ID_MAX } from '../plan-room/image-grants';
import { planRoom } from '../plan-client';
import {
  badRequest,
  CORS_HEADERS,
  forbidden,
  imagesUnavailable,
  json,
  notFound,
} from '../responses';
import { COMMUNITY_CONTENT, grantOn, readBody, requireOwner, type RouteContext } from './context';
import { resolvePlanGrant } from './plan-grant';
import type { PlanGrant } from '../index-service';

// The longest plan id `p` takes, as the plan routes (routes/projects.ts).
const PLAN_ID_MAX = 200;

// Without the service (no MEDIA_KEY) both answer 503, so the editor says uploads aren't available here.
export async function handleImages(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  const media = mediaClient(ctx.env);
  if (!media) return imagesUnavailable();
  if (segments.length === 2 && request.method === 'POST') return upload(ctx, media);
  if (segments.length === 3 && segments[2] === 'grants' && request.method === 'POST') {
    return grants(ctx, media);
  }
  if (segments.length === 3 && segments[2] && request.method === 'GET') {
    return read(ctx, media, segments[2]);
  }
  return notFound();
}

// A project-scope workbench session (docs/specs/013-workspace/workbench-embeds.md) reaches its own plan only, and
// never takes the owner shortcut, so it cannot walk its owner's gallery by id.
const projectSession = (ctx: RouteContext) =>
  ctx.workbench?.scope === 'project' ? ctx.workbench : null;

// POST /api/images?p={planId}: upload a picture for an Image field of plan `p`. Body: the raw image bytes. The
// caller must be able to write that plan's cards (an Editor or a Participant; a Viewer is refused). The declared
// type and length are checked here first, so a refused file never leaves this Worker; the service checks the type
// against the bytes, dedupes, caps the gallery and strips JPEG metadata. The plan then records a grant for the
// picture, so it serves it to everyone who may read the plan. Without `p` (a This Browser plan, which the server
// does not hold) the picture only goes into the uploader's gallery, and only they read it.
async function upload(ctx: RouteContext, media: MediaClient): Promise<Response> {
  const { request, env, url } = ctx;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const planId = url.searchParams.get('p') || null;
  const session = projectSession(ctx);
  if (session ? planId !== session.projectId : planId !== null && planId.length > PLAN_ID_MAX) {
    return notFound();
  }
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
  if (declaredLen > MAX_IMAGE_BYTES) return tooLarge();
  if (planId !== null) {
    const refused = await refusedUpload(ctx, planId);
    if (refused) return refused;
  }
  // The hash shortcut answers a bare hash with the gallery row without reading a byte, so only the owner's own
  // editor sends it: a workbench session or an API token acts for the owner without being them, and could probe
  // the gallery for any file it can hash. They upload the body, and the service still dedupes on its real hash.
  const headerSha = (request.headers.get('X-Image-Sha256') ?? '').toLowerCase();
  const sha256 =
    !ctx.workbench && !ctx.token && /^[0-9a-f]{64}$/.test(headerSha) ? headerSha : null;
  // Read whole (at most MAX_IMAGE_BYTES, checked above) so the service gets an exact length.
  const bytes = await request.arrayBuffer();
  // Content-Length is the client's word; the body is the truth.
  if (bytes.byteLength > MAX_IMAGE_BYTES) return tooLarge();
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
    // An API token's upload names its tool (the MCP's upload_image, the CLI's `image add`) so the gallery can say
    // Made by AI (liveworkspace/docs/specs/006-media/media.md "Uploaded by a tool"); the editor never sends one.
    source: ctx.token ? imageSourceOf(request.headers.get(IMAGE_SOURCE_HEADER)) : null,
    // A plan the server holds claims the picture, so the media sweep keeps it until that plan reports it gone. A This
    // Browser plan names none (media.md "Uploads").
    document: planId,
  });
  if (!uploaded.ok) return serviceAnswer(uploaded);
  const { image, deduped } = uploaded.value;
  rememberMediaOwner(image.id, named);
  if (planId !== null) await planRoom(env, planId).grantImage(image.id);
  return json({ image: imageSummary(image), deduped });
}

// POST /api/images/grants?p={planId}: which of `ids` were uploaded for plan `p`, each with its upload's name, size and
// type as the service keeps them: what an agent may place on the plan's cards, checked before a card is written
// (docs/specs/015-api/mcp-server.md §4.5b), and what an Attachments entry is made from. Body `{ ids }`, at most
// IMAGE_GRANT_CHECK_MAX. The caller must be able to write the plan's cards, as for an upload. An id the plan holds no
// grant for, or one the service no longer has, is left out of the answer.
async function grants(ctx: RouteContext, media: MediaClient): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const planId = ctx.url.searchParams.get('p') || null;
  const session = projectSession(ctx);
  // The plan is the question's subject: without it there is nothing to ask (400); one it can't be is a plan not found.
  if (!planId) return badRequest('p must name the plan the pictures are for');
  if (planId.length > PLAN_ID_MAX || (session && planId !== session.projectId)) return notFound();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const ids = body['ids'];
  if (
    !Array.isArray(ids) ||
    ids.length > IMAGE_GRANT_CHECK_MAX ||
    !ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= IMAGE_ID_MAX)
  ) {
    return badRequest(`ids must be a list of at most ${IMAGE_GRANT_CHECK_MAX} image ids`);
  }
  const refused = await refusedUpload(ctx, planId);
  if (refused) return refused;
  const granted = await planRoom(ctx.env, planId).grantedImages(ids as string[]);
  // One service read a granted picture, in parallel: a call's pictures are few (IMAGE_GRANT_CHECK_MAX at most).
  const records = await Promise.all(granted.map((id) => media.get(id)));
  const images = records.flatMap((r): GrantedImage[] =>
    r
      ? [
          {
            id: r.image.id,
            name: r.image.originalName ?? null,
            size: r.image.byteSize,
            type: r.image.contentType,
          },
        ]
      : [],
  );
  if (images.length < ids.length) {
    console.info('[images] grant check left ids out', {
      planId,
      asked: ids.length,
      held: images.length,
    });
  }
  return json({ images } satisfies ImageGrantsResponse);
}

// The caller's hold on the plan through `grant`, as the plan's own doors read it. A grant through the plan's
// Community post's link (docs/specs/025-community/community.md "Viewing a post's plan") holds the plan to view, its
// cards' pictures included, while the post is open, and nothing once it is not; the plan's room says which.
async function heldOn(ctx: RouteContext, planId: string, grant: PlanGrant | null) {
  if (!grant) return null;
  const community = grant.shareCode ? await planRoom(ctx.env, planId).community() : null;
  return grantOn({ ...ctx, grant, community }, planId, COMMUNITY_CONTENT);
}

// Who may upload for a plan: whoever may write its cards, by the index's grant, as every item write checks it
// (routes/item-route-kit.ts). Cards are the plan's, not a tab's, so a Participant confined to one tab uploads for
// the cards it shows too. Null lets the upload on; otherwise the refusal to answer.
async function refusedUpload(ctx: RouteContext, planId: string): Promise<Response | null> {
  const grant = await resolvePlanGrant(ctx, planId);
  if (grant instanceof Response) return grant;
  const held = await heldOn(ctx, planId, grant);
  if (!held) return notFound();
  if (levelAtLeast(held.role, 'participate')) return null;
  console.info('[images] upload refused below Participant', { planId });
  return forbidden();
}

// GET /api/images/{id}?p={planId}: the picture's bytes, to its uploader (as the service names them), or to anyone
// who may read plan `p` (its owner, its team, and every share role) when that plan serves it: it holds a grant for
// it and one of its cards holds the id, for a tab-scoped grant a card its tab shows (docs/specs/026-plan/items.md
// "Who sees the bytes"). Anything else answers 404, so an id reveals nothing.
async function read(ctx: RouteContext, media: MediaClient, imageId: string): Promise<Response> {
  if (imageId.length > IMAGE_ID_MAX) return notFound();
  const session = projectSession(ctx);
  const caller = ctx.resolveOwner();
  let allowed = false;
  if (!session && caller !== null) {
    const imageOwner = await mediaImageOwner(media, imageId);
    if (imageOwner === '') return notFound();
    allowed = imageOwner === (await mediaOwner(caller));
  }
  const planId = ctx.url.searchParams.get('p');
  if (!allowed && planId && planId.length <= PLAN_ID_MAX) {
    if (!session || planId === session.projectId) {
      const grant = await resolvePlanGrant(ctx, planId);
      const held = grant instanceof Response ? null : await heldOn(ctx, planId, grant);
      if (held) {
        allowed = await planRoom(ctx.env, planId).servesImage(imageId, held.tabScope);
        if (!allowed) console.warn('[images] not served by plan', { planId, imageId });
      }
    }
  }
  if (!allowed) return notFound();
  const object = await media.bytes(imageId);
  if (!object?.body) return notFound();
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', object.contentType);
  // Private cache: each reader keeps their own copy, never a shared CDN's. An image's bytes never change under its
  // id, so the copy stays right.
  headers.set('Cache-Control', 'private, max-age=86400');
  // The stored type is the sniffed one; never let a browser re-guess it.
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
}

const tooLarge = () =>
  json({ error: 'file_too_large', limitBytes: MAX_IMAGE_BYTES }, { status: 413 });

// A refusal from the service, passed on as it came (a full gallery, an unsupported file), except one about this
// api's own key or the service itself, which the editor can do nothing about.
function serviceAnswer(failed: { status: number; body: Record<string, unknown> }): Response {
  if (failed.status === 401 || failed.status >= 500) {
    console.error('[images] media service answered', failed.status, failed.body);
    return imagesUnavailable();
  }
  return json(failed.body, { status: failed.status });
}

/** The uploaded file's own name: percent-encoded by the editor (a header is Latin-1 only), read raw when it does
 *  not decode, cut to ORIGINAL_NAME_MAX characters. Null when none was sent. */
export function originalNameOf(header: string | null): string | null {
  if (header === null) return null;
  let name = header;
  try {
    name = decodeURIComponent(header);
  } catch {
    // A raw name (a lone `%`): kept as sent.
  }
  return Array.from(name).slice(0, ORIGINAL_NAME_MAX).join('');
}
