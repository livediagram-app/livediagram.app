// /api/documents/<id>/community: the owner's side of Community (docs/specs/025-community/community.md
// "Publishing"; blueprint §4 and §5 G1 to G3). GET reads the document's post, PUT publishes it or saves an Edit
// Listing, DELETE removes it from Community.

import {
  COMMUNITY_POSTS_PER_AUTHOR,
  validateCommunityPostInput,
  type CommunityOwnPost,
} from '@livediagram/api-schema';
import { communityEnabled } from '../community-enabled';
import { rowState, rowToCommunityPost, type CommunityPostRow } from '../community-row';
import {
  countCommunityPostsByAuthor,
  createCommunityPost,
  deleteCommunityPost,
  firstTabElementCount,
  getCommunityPostForDocument,
  getDocumentSharePassword,
  updateCommunityPost,
} from '../db';
import { conflict, json, noContent, notFound, signInRequired } from '../responses';
import { requireOwnedDocument, type RouteContext } from './context';

function ownPost(row: CommunityPostRow): CommunityOwnPost {
  return { ...rowToCommunityPost(row, false), state: rowState(row) };
}

// Returns null when the request isn't this route.
export async function handleCommunityOwnerRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'community') return null;
  const method = request.method;
  if (method !== 'GET' && method !== 'PUT' && method !== 'DELETE') return null;
  const id = segments[2]!;
  // Switched off, a document has no Community post to read, publish or remove.
  if (!communityEnabled(env)) return notFound();

  const doc = await requireOwnedDocument(ctx, id);
  if (doc instanceof Response) return doc;
  const found = await getCommunityPostForDocument(env, id);
  // A post made by a previous owner (the document left a team library for another member's) is not this owner's:
  // it reads as none, and publishing replaces it (docs/specs/025-community/community.md "Publishing").
  const stale = found !== null && found.author_id !== doc.ownerId ? found : null;
  const existing = stale ? null : found;

  if (method === 'GET') return json({ post: existing ? ownPost(existing) : null });

  // A post hidden by reports is final (docs/specs/025-community/community.md "Reports and moderation"): nobody
  // reviews it, so its author can neither edit it nor remove it, which would clear its reports and let the same
  // document be published again. It stays visible to them alone.
  const hidden = existing !== null && rowState(existing) === 'hidden';

  if (method === 'DELETE') {
    if (!existing) return notFound();
    if (hidden) return reject(conflict('post_hidden'), 'post_hidden');
    await deleteCommunityPost(env, existing.share_code);
    console.log('[community] removed', { postId: existing.id });
    return noContent();
  }

  // PUT: publish, or save an Edit Listing.
  // G1: every public post is tied to an account, so publishing needs a verified Clerk session (never a guest id or
  // an API token), and a team library document is not one person's to give away.
  if (!ctx.clerkUserId || ctx.clerkUserId !== doc.ownerId)
    return reject(signInRequired(), 'sign_in_required');
  if (doc.teamId) return reject(conflict('team_document'), 'team_document');
  const parsed = validateCommunityPostInput(await request.json().catch(() => null));
  if (!parsed.ok) return reject(json({ error: parsed.error }, { status: 400 }), parsed.error);
  // G2: a share password and a post exclude each other.
  if (await getDocumentSharePassword(env, id))
    return reject(conflict('share_password_set'), 'share_password_set');

  if (existing) {
    if (hidden) return reject(conflict('post_hidden'), 'post_hidden');
    await updateCommunityPost(env, existing.id, parsed.value);
    console.log('[community] updated', { postId: existing.id });
    const row = await getCommunityPostForDocument(env, id);
    return json({ post: ownPost(row!) });
  }

  // G3: something to show, and room under the per-author cap.
  // Counted, not rendered: a deploy without the snapshot store can still publish.
  if ((await firstTabElementCount(env, id)) === 0) {
    return reject(conflict('empty_document'), 'empty_document');
  }
  if ((await countCommunityPostsByAuthor(env, ctx.clerkUserId)) >= COMMUNITY_POSTS_PER_AUTHOR) {
    return reject(conflict('post_limit'), 'post_limit');
  }
  if (stale) {
    await deleteCommunityPost(env, stale.share_code);
    console.log('[community] replaced a previous owner post', { postId: stale.id });
  }
  let postId: string;
  try {
    postId = await createCommunityPost(env, id, ctx.clerkUserId, parsed.value);
  } catch (err) {
    // Two first publishes of one document at once: the second meets the one-post-per-document rule.
    if (String(err).includes('UNIQUE'))
      return reject(conflict('already_published'), 'already_published');
    throw err;
  }
  console.log('[community] published', { postId, category: parsed.value.category });
  const row = await getCommunityPostForDocument(env, id);
  return json({ post: ownPost(row!) }, { status: 201 });
}

function reject(response: Response, code: string): Response {
  console.warn(`[community] rejected ${code}`);
  return response;
}
