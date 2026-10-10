// /api/teams/<id>/notify-mention: email the teammates a comment just
// @-mentioned (docs/specs/012-collaboration/comment-mentions.md "The email"). The sibling of notify-action
// (team-action-routes.ts), with a tighter team rule: a mention is only ever
// of the document's OWN team, so the team in the path must be the document's.
//
// A POST, so the shared mutation gate in teams.ts has already required the
// interactive Clerk session. Best-effort in the background: the comment has
// already persisted through the tab write.
//
// A Plan card's comment is stored before the request is sent, so its request names the comment
// (`commentId`) and the route reads the comment's text and mentions from the card, never the body: a
// reworded request cannot email anyone again. A canvas comment reaches D1 only with the next tab save,
// so its request carries the text and mentions.

import { legacyDocumentIdOf } from '../legacy-request-forms';
import type { TeamMember } from '@livediagram/api-schema';
import { MENTIONS_MAX, itemThread, type Comment } from '@livediagram/document';
import { ITEM_ID_PATTERN } from '@livediagram/items';
import { getDocumentMeta, getParticipant, listTeamMembers, readItem } from '../db';
import { NOTIFY_EMAIL_DEDUPE_MS, notifyMentioned } from '../email/notifications';
import { badRequest, forbidden, json, notFound } from '../responses';
import type { RouteContext } from './context';

// Same cap the api holds a comment to.
const MENTION_COMMENT_MAX = 5000;
// A comment id is a UUID the api minted; anything longer is not one.
const COMMENT_ID_MAX = 100;

type MentionTarget = { userId?: unknown; memberId?: unknown };

// Returns null when the request isn't this route.
export async function handleTeamMentionRoutes(
  ctx: RouteContext,
  scope: { teamId: string; me: TeamMember; userId: string },
): Promise<Response | null> {
  const { request, env, segments, clerkEmail } = ctx;
  const { teamId, me, userId } = scope;
  if (segments.length !== 4 || segments[3] !== 'notify-mention') return null;
  if (request.method !== 'POST') return notFound();
  if (me.status !== 'joined') return forbidden();

  const body = (await request.json().catch(() => null)) as {
    documentId?: unknown;
    commentText?: unknown;
    mentions?: unknown;
    itemId?: unknown;
    commentId?: unknown;
  } | null;
  const documentId =
    typeof body?.documentId === 'string' ? body.documentId : legacyDocumentIdOf(body);
  // A Plan card's comment names its card, so the email opens it (docs/specs/012-collaboration/comment-mentions.md).
  const itemId = body?.itemId === undefined ? null : body.itemId;
  if (itemId !== null && (typeof itemId !== 'string' || !ITEM_ID_PATTERN.test(itemId))) {
    return badRequest('bad itemId');
  }
  const commentId = body?.commentId;
  if (
    itemId &&
    (typeof commentId !== 'string' || !commentId || commentId.length > COMMENT_ID_MAX)
  ) {
    return badRequest('missing commentId');
  }
  let commentText = typeof body?.commentText === 'string' ? body.commentText.trim() : '';
  let targets = Array.isArray(body?.mentions) ? (body.mentions as MentionTarget[]) : null;
  if (!documentId || (!itemId && (!commentText || !targets))) {
    return badRequest('missing documentId/commentText/mentions');
  }
  if (!itemId && commentText.length > MENTION_COMMENT_MAX)
    return badRequest('commentText too long');
  if (!itemId && targets!.length > MENTIONS_MAX) return badRequest('too many mentions');

  // The document must live in THIS team's library: a mention is of the
  // document's own team, and its members are exactly who can open it. The
  // caller is a joined member (checked above), so they can open it too. 404,
  // never 403, so the route can't probe which documents exist.
  const liveDoc = await getDocumentMeta(env, documentId);
  if (!liveDoc || liveDoc.teamId !== teamId) return notFound();
  if (itemId) {
    // The card must be one of this document's, and the comment the caller's own on it, posted inside the
    // dedupe window (an older one could be emailed again once its claim lapsed). 404 for each, so the route
    // cannot probe cards or comments.
    const item = await readItem(env, liveDoc.id, itemId);
    const comment: Comment | undefined = item
      ? itemThread(item)?.comments.find((c) => c.id === commentId)
      : undefined;
    if (
      !comment ||
      comment.authorId !== userId ||
      comment.createdAt < Date.now() - NOTIFY_EMAIL_DEDUPE_MS
    ) {
      console.info('[notify-mention] card comment refused', { found: !!comment });
      return notFound();
    }
    commentText = comment.text;
    targets = comment.mentions ?? [];
  }

  // Each target resolves to a member of this team other than the caller;
  // anything else is skipped silently. Once each.
  const members = await listTeamMembers(env, teamId);
  const recipients = new Map<string, TeamMember>();
  for (const t of targets!) {
    const byMember = typeof t?.memberId === 'string' ? t.memberId : null;
    const byUser = typeof t?.userId === 'string' ? t.userId : null;
    const hit =
      (byMember ? members.find((m) => m.id === byMember) : undefined) ??
      (byUser ? members.find((m) => m.userId === byUser) : undefined);
    if (!hit || hit.userId === userId) continue;
    recipients.set(hit.id, hit);
  }

  // The author's display name from their verified identity, never the body.
  const authorName = (await getParticipant(env, userId))?.name ?? clerkEmail ?? null;
  for (const m of recipients.values()) {
    ctx.waitUntil?.(
      notifyMentioned(env, {
        recipientUserId: m.userId,
        recipientFallbackEmail: m.email,
        authorUserId: userId,
        authorName,
        document: { id: liveDoc.id, name: liveDoc.name },
        commentText,
        ...(itemId ? { itemId, commentId: commentId as string } : {}),
      }).catch(() => {}),
    );
  }
  return json({ ok: true }, { status: 202 });
}
