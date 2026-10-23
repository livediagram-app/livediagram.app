// /api/documents/<id>/community: the owner's side of Community (docs/specs/025-community/community.md
// "Publishing"; blueprint §4 and §5 G1 to G3). GET reads the canvas's post, PUT publishes it or saves an Edit
// Listing, DELETE removes it from Community. The post itself is kept by the liveworkspace Community service
// (community-service.ts); this route checks who owns the canvas and whether it may be published, makes the
// community link that opens it (an index share link, view, never expiring) and keeps it with the canvas
// (document-room/community-post.ts).

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
import type { IndexClient } from '@liveworkspace/index-client';
import { firstTabElementCount } from '../db';
import { getParticipant } from '../liveworkspace/profiles';
import {
  deleteCommunityPost,
  readCommunityPost,
  saveCommunityPost,
  updateCommunityPost,
} from '../document-room/community-post';
import { readDocumentMeta } from '../document-room/document-content';
import { indexFor } from '../index-service';
import { conflict, json, noContent, notFound, signInRequired } from '../responses';
import { grantCallerOf, grantOn, type DocumentRouteContext } from './context';

function ownPost(post: CommunityAppPost): CommunityOwnPost {
  const { own: _own, ...rest } = post;
  return rest;
}

// How the owner is shown on a post that is not anonymous: their participant name and colour (no picture: accounts
// have none).
async function authorOf(ctx: DocumentRouteContext, ownerId: string): Promise<CommunityAuthor> {
  const p = await getParticipant(ctx.env, ownerId);
  if (!p) return COMMUNITY_UNKNOWN_AUTHOR;
  return {
    name: p.name,
    color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : COMMUNITY_UNKNOWN_AUTHOR.color,
    picture: null,
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
export async function handleCommunityOwnerRoutes(
  ctx: DocumentRouteContext,
): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'community') return null;
  const method = request.method;
  if (method !== 'GET' && method !== 'PUT' && method !== 'DELETE') return null;
  const id = segments[2]!;
  // Switched off, or with no service to publish to, a document has no Community post to read, publish or remove.
  if (!communityEnabled(env) || !communityServiceConfigured(env)) return notFound();

  // The canvas's owner alone, holding its grant (the index's word that it is theirs to manage).
  const doc = await readDocumentMeta(env, id);
  const caller = ctx.resolveOwner();
  if (!doc || !caller || caller !== doc.ownerId || !grantOn(ctx, id)) return notFound();
  const client = indexFor(env, grantCallerOf(ctx));
  if (!client) return json({ error: 'index_unavailable' }, { status: 503 });
  // A post made by a previous owner (the canvas left a team library for another member's) is not this owner's:
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
    await revokeLink(client, existing.shareCode);
    await deleteCommunityPost(env);
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
  const sharing = await client.listShareLinks(id);
  if (sharing.passwordSet) return reject(conflict('share_password_set'), 'share_password_set');
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
    // A post the canvas has no row for (published before its canvas kept its own) is kept now.
    if (await readCommunityPost(env)) await updateCommunityPost(env, post);
    else
      await saveCommunityPost(
        env,
        {
          shareCode: post.shareCode,
          authorId: ctx.accountUserId,
          postId: post.id,
          title: post.title,
          anonymous: post.anonymous,
        },
        Date.now(),
      );
    console.log('[community] updated', { postId: post.id });
    return json({ post: ownPost(post) });
  }

  // G3: something to show. Counted, not rendered: a deploy without the snapshot store can still publish. The
  // per-author cap is the service's: it counts the posts.
  if ((await firstTabElementCount(env, id)) === 0) {
    return reject(conflict('empty_document'), 'empty_document');
  }
  // One post per canvas: a post already kept here (a previous owner's) gives way to this one.
  const previous = await readCommunityPost(env);
  // The community link is made at the index first (its code is the post's), and removed again when the service
  // refuses the post, so a refusal leaves nothing behind.
  const { link } = await client.createShareLink(id, { level: 'view', expiry: 'never' });
  const shareCode = link.code;
  const res = await publishServicePost(env, id, {
    owner: ctx.accountUserId,
    shareCode,
    documentState: 'public',
    author,
    input: parsed.value,
    create: true,
  });
  if (!res.ok) {
    await revokeLink(client, shareCode);
    return passThrough(res);
  }
  const { post } = (await res.json()) as { post: CommunityAppPost };
  // Runs inside the canvas's Durable Object, one request at a time per write: two first publishes cannot both get
  // here with no post kept.
  await saveCommunityPost(
    env,
    {
      shareCode,
      authorId: ctx.accountUserId,
      postId: post.id,
      title: post.title,
      anonymous: post.anonymous,
    },
    Date.now(),
  );
  if (previous && previous.shareCode !== shareCode) await revokeLink(client, previous.shareCode);
  console.log('[community] published', { postId: post.id, category: parsed.value.category });
  return json({ post: ownPost(post) }, { status: 201 });
}

// The community link's index share link, removed. Best effort: a link left behind opens nothing as a post (the
// canvas no longer keeps it), and its owner can remove it in the Share dialog.
async function revokeLink(client: IndexClient, code: string): Promise<void> {
  try {
    await client.revokeShareLink(code);
  } catch (err) {
    console.warn('[community] link not removed', { error: String(err) });
  }
}

function reject(response: Response, code: string): Response {
  console.warn(`[community] rejected ${code}`);
  return response;
}
