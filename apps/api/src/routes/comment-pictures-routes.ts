// GET /api/documents/<id>/tabs/<tabId>/comment-pictures — the published profile pictures of a tab's
// comment authors, keyed by COMMENT id (docs/specs/014-identity/profile-picture.md §5, §6).
//
// Keyed by comment because a reader never gets other people's comment author ids: they are owner
// ids, a guest's credential (redactCommentAuthorIds). The server holds the ids, looks the pictures
// up, and hands back only comment id -> picture URL. Only a signed-in caller gets any: an anonymous
// share-link visitor reads an empty map, so the URL never reaches them.

import type { Comment, Element } from '@livediagram/document';
import { getDocument, getParticipant, getTab } from '../db';
import { forbidden, json } from '../responses';
import { gateRead, missingDocument, requireOwner, type RouteContext } from './context';

// Bounds the participant reads one request can cause; a tab past it shows initials for the rest.
export const MAX_COMMENT_PICTURE_AUTHORS = 50;

export async function handleCommentPicturesRoute(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (!(
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    segments[5] === 'comment-pictures' &&
    request.method === 'GET'
  )) {
    return null;
  }
  const id = segments[2]!;
  const tabId = segments[4]!;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const existing = await getDocument(env, id);
  if (!existing) return missingDocument(ctx, id);
  if (!(await gateRead(ctx, id, existing.ownerId, existing.teamId, tabId))) return forbidden();
  if (!ctx.verifiedUserId) return json({ pictures: {} });
  const tab = await getTab(env, id, tabId);
  return json({ pictures: tab ? await commentPictures(env, tab.elements) : {} });
}

async function commentPictures(
  env: RouteContext['env'],
  elements: Element[],
): Promise<Record<string, string>> {
  const byAuthor = new Map<string, string[]>();
  for (const el of elements) {
    const thread = (el as { commentThread?: { comments?: Comment[] } }).commentThread;
    for (const c of thread?.comments ?? []) {
      if (!c.authorId) continue;
      const ids = byAuthor.get(c.authorId);
      if (ids) ids.push(c.id);
      else if (byAuthor.size < MAX_COMMENT_PICTURE_AUTHORS) byAuthor.set(c.authorId, [c.id]);
    }
  }
  const pictures: Record<string, string> = {};
  await Promise.all(
    [...byAuthor].map(async ([authorId, commentIds]) => {
      const url = (await getParticipant(env, authorId))?.pictureUrl;
      if (url) for (const commentId of commentIds) pictures[commentId] = url;
    }),
  );
  return pictures;
}
