// /api/documents/<id>/community: the owner's side of Community (docs/specs/025-community/community.md
// "Publishing"; blueprint §4 and §5 G1 to G3). GET reads the document's post, PUT publishes it or saves an Edit
// Listing, DELETE removes it from Community. The post itself is kept by the liveworkspace Community service
// (community-service.ts); this route checks what only this api can (who owns the document, whether it may be
// published) and keeps the community link that opens it (db/community-links.ts).

import {
  COMMUNITY_UNKNOWN_AUTHOR,
  validateCommunityPostInput,
  type CommunityAppPost,
  type CommunityAuthor,
  type CommunityOwnPost,
} from '@livediagram/api-schema';
import { communityEnabled } from '../community-enabled';
import {
  communityServiceConfigured,
  getServicePost,
  publishServicePost,
  removeServicePost,
} from '../community-service';
import { firstTabElementCount, getDocumentSharePassword, getParticipant } from '../db';
import {
  deleteCommunityLink,
  newCommunityLinkCode,
  saveNewCommunityLink,
  updateCommunityLink,
} from '../db/community-links';
import { conflict, json, noContent, notFound, signInRequired } from '../responses';
import { requireOwnedDocument, type RouteContext } from './context';

function ownPost(post: CommunityAppPost): CommunityOwnPost {
  const { own: _own, ...rest } = post;
  return rest;
}

// How the owner is shown on a post that is not anonymous: their participant name, colour and picture.
async function authorOf(ctx: RouteContext, ownerId: string): Promise<CommunityAuthor> {
  const p = await getParticipant(ctx.env, ownerId);
  if (!p) return COMMUNITY_UNKNOWN_AUTHOR;
  return {
    name: p.name,
    color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : COMMUNITY_UNKNOWN_AUTHOR.color,
    picture: p.pictureUrl,
  };
}

// The service's refusals the editor knows by code pass through as they are.
async function passThrough(res: Response): Promise<Response> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  const code = body?.error ?? 'community_unavailable';
  console.warn(`[community] rejected ${code}`);
  return json({ error: code }, { status: res.status >= 500 ? 502 : res.status });
}

// Returns null when the request isn't this route.
export async function handleCommunityOwnerRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'community') return null;
  const method = request.method;
  if (method !== 'GET' && method !== 'PUT' && method !== 'DELETE') return null;
  const id = segments[2]!;
  // Switched off, or with no service to publish to, a document has no Community post to read, publish or remove.
  if (!communityEnabled(env) || !communityServiceConfigured(env)) return notFound();

  const doc = await requireOwnedDocument(ctx, id);
  if (doc instanceof Response) return doc;
  // A post made by a previous owner (the document left a team library for another member's) is not this owner's:
  // it reads as none, and publishing replaces it (docs/specs/025-community/community.md "Publishing").
  const found = await getServicePost(env, id, doc.ownerId);
  const existing = found?.own ? found : null;

  if (method === 'GET') return json({ post: existing ? ownPost(existing) : null });

  // A post hidden by reports is final (docs/specs/025-community/community.md "Reports and moderation"): nobody
  // reviews it, so its author can neither edit it nor remove it. The service refuses both; this says so first.
  const hidden = existing?.state === 'hidden';

  if (method === 'DELETE') {
    if (!existing) return notFound();
    if (hidden) return reject(conflict('post_hidden'), 'post_hidden');
    const res = await removeServicePost(env, id, doc.ownerId);
    if (!res.ok && res.status !== 404) return passThrough(res);
    await deleteCommunityLink(env, existing.shareCode);
    console.log('[community] removed', { postId: existing.id });
    return noContent();
  }

  // PUT: publish, or save an Edit Listing.
  // G1: every public post is tied to an account, so publishing needs a verified signed-in session (never a guest id or
  // an API token), and a team library document is not one person's to give away.
  if (!ctx.accountUserId || ctx.accountUserId !== doc.ownerId)
    return reject(signInRequired(), 'sign_in_required');
  if (doc.teamId) return reject(conflict('team_document'), 'team_document');
  const parsed = validateCommunityPostInput(await request.json().catch(() => null));
  if (!parsed.ok) return reject(json({ error: parsed.error }, { status: 400 }), parsed.error);
  // G2: a share password and a post exclude each other.
  if (await getDocumentSharePassword(env, id))
    return reject(conflict('share_password_set'), 'share_password_set');
  if (hidden) return reject(conflict('post_hidden'), 'post_hidden');
  const author = await authorOf(ctx, ctx.accountUserId);

  if (existing) {
    const res = await publishServicePost(env, id, {
      owner: ctx.accountUserId,
      shareCode: existing.shareCode,
      documentState: 'public',
      author,
      input: parsed.value,
    });
    if (!res.ok) return passThrough(res);
    const { post } = (await res.json()) as { post: CommunityAppPost };
    await updateCommunityLink(env, post.shareCode, post);
    console.log('[community] updated', { postId: post.id });
    return json({ post: ownPost(post) });
  }

  // G3: something to show. Counted, not rendered: a deploy without the snapshot store can still publish. The
  // per-author cap is the service's: it counts the posts.
  if ((await firstTabElementCount(env, id)) === 0) {
    return reject(conflict('empty_document'), 'empty_document');
  }
  // The community link is made here and written only once the service has taken the post, so a refusal leaves
  // nothing behind.
  const shareCode = newCommunityLinkCode();
  const res = await publishServicePost(env, id, {
    owner: ctx.accountUserId,
    shareCode,
    documentState: 'public',
    author,
    input: parsed.value,
    create: true,
  });
  if (!res.ok) return passThrough(res);
  const { post } = (await res.json()) as { post: CommunityAppPost };
  try {
    await saveNewCommunityLink(env, {
      shareCode,
      documentId: id,
      authorId: ctx.accountUserId,
      postId: post.id,
      title: post.title,
      anonymous: post.anonymous,
    });
  } catch (err) {
    // Two first publishes of one document at once, and the other's link got here first: the service has one post
    // and it is the other's, so this answers as the service would have.
    if (String(err).includes('UNIQUE'))
      return reject(conflict('already_published'), 'already_published');
    throw err;
  }
  console.log('[community] published', { postId: post.id, category: parsed.value.category });
  return json({ post: ownPost(post) }, { status: 201 });
}

function reject(response: Response, code: string): Response {
  console.warn(`[community] rejected ${code}`);
  return response;
}
