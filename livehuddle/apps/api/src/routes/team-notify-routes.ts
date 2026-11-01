// /api/teams/<id>/access-check, /notify-action and /notify-mention: the assigned-actions and mentions endpoints
// (docs/specs/012-collaboration/assigned-actions.md, comment-mentions.md). The team and its people are the liveworkspace
// accounts Worker's (liveworkspace/team-people.ts); whether someone can open a canvas is the index's (a grant asked for
// them); the email is sent from the canvas's own Durable Object, which keeps its once-only claims
// (email/notifications.ts).
//
// The server establishes every fact that matters itself: the caller is in the team (their token's claim, confirmed
// by accounts) and can open the canvas; the people named are the team's; the canvas's name, the sender's name and
// the recipient's address come from server state, never the body. 404, never 403, for anyone or anything the caller
// cannot name, so the routes cannot probe who or what exists. The notify routes answer 202 at once; the emails go
// in the background (the assignment or comment itself is already in the canvas, through the tab save).

import { teamTargets, type NotifyTarget, type TeamPerson } from '@liveworkspace/auth-client';
import { MENTIONS_MAX } from '@livehuddle/document';
import { documentRoom } from '../document-client';
import { requestGrant, type ItemGrant } from '../index-service';
import { legacyDocumentIdOf } from '../legacy-request-forms';
import { getParticipant } from '../liveworkspace/profiles';
import { documentUrl, elementActionUrl, pushTag } from '../liveworkspace/push';
import { teamPeople } from '../liveworkspace/team-people';
import { badRequest, forbidden, json, notFound } from '../responses';
import { resolveDocumentGrant } from './document-grant';
import type { RouteContext } from './context';

// Body caps: generous against any real action or comment, tight against abuse.
export const ACTION_NAME_MAX = 200;
export const ACTION_DESCRIPTION_MAX = 2000;
const MENTION_COMMENT_MAX = 5000;
const ID_MAX = 200;

const idOf = (value: unknown): string =>
  typeof value === 'string' && value.length <= ID_MAX ? value : '';

// Can this person of `teamId` open the canvas (assigned-actions.md §4)? It is in the team's library (an invited
// person gets in on accepting), they own it, they have joined its own team, or they opened it through a share link
// before (the index, asked for them with no team). Someone invited with no account yet has no other way in.
async function personCanOpen(
  ctx: RouteContext,
  grant: ItemGrant,
  teamId: string,
  person: TeamPerson,
): Promise<boolean> {
  if (grant.team === teamId) return true;
  const userId = person.userId;
  if (!userId) return false;
  if (grant.owner === userId) return true;
  if (grant.team) {
    const theirs = await teamPeople(ctx.env, grant.team);
    if (theirs?.some((p) => p.userId === userId && p.status === 'joined')) return true;
  }
  const asked = await requestGrant(
    ctx.env,
    { kind: 'delegate', personId: userId, teams: [] },
    grant.item,
    null,
  );
  // A link with a password still lets them in once they type it.
  return asked.ok || asked.error === 'password_required';
}

// The caller's grant on the canvas, or null when they cannot open it (or it does not exist).
async function callerGrant(ctx: RouteContext, documentId: string): Promise<ItemGrant | null> {
  const grant = await resolveDocumentGrant(ctx, documentId);
  return grant instanceof Response ? null : grant;
}

// Returns null when the request isn't one of these routes. `owner` is the caller, already found to be in the team.
export async function handleTeamNotifyRoutes(
  ctx: RouteContext,
  teamId: string,
  owner: string,
): Promise<Response | null> {
  const { request, url, segments } = ctx;
  const route = segments.length === 4 ? segments[3] : null;
  if (route !== 'access-check' && route !== 'notify-action' && route !== 'notify-mention')
    return null;
  const people = await teamPeople(ctx.env, teamId);
  if (!people) return notFound();
  // The token's claim, confirmed by the team as accounts holds it now (someone removed since stays out).
  if (!people.some((p) => p.userId === owner && p.status === 'joined')) return forbidden();

  // GET /api/teams/<id>/access-check?assigneeUserId=&documentId=: can this teammate open that canvas? Drives the
  // Assign Action dialog's access hint with a real answer. A read, so an API token's caller may ask too.
  if (route === 'access-check') {
    if (request.method !== 'GET') return notFound();
    const assigneeUserId = idOf(url.searchParams.get('assigneeUserId'));
    const documentId = idOf(url.searchParams.get('documentId'));
    if (!assigneeUserId || !documentId) return badRequest('missing assigneeUserId/documentId');
    const assignee = people.find((p) => p.userId === assigneeUserId && p.status === 'joined');
    if (!assignee) return notFound();
    const grant = await callerGrant(ctx, documentId);
    if (!grant) return notFound();
    return json({ canAccess: await personCanOpen(ctx, grant, teamId, assignee) });
  }

  if (request.method !== 'POST') return notFound();
  // A signed-in person's assignment or mention: never an API token's.
  if (ctx.token || !ctx.accountUserId || ctx.accountUserId !== owner) return forbidden();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const documentId = idOf(body?.documentId) || legacyDocumentIdOf(body) || '';

  // POST /api/teams/<id>/notify-action {assigneeUserId? | assigneeMemberId?, documentId, actionName, description?,
  // email?, tabId?, elementId?}: email a teammate (joined, or invited: work gets divided while invites are in flight)
  // about an action just assigned to them on a canvas element. `email: false` (the dialog's Email box unticked)
  // sends no email; the phone notification goes either way, to an assignee with an account who can open the canvas,
  // linking `tabId` and `elementId` when given (docs/specs/014-identity/phone-notifications.md).
  if (route === 'notify-action') {
    const target: NotifyTarget = {
      userId: idOf(body?.assigneeUserId) || null,
      memberId: idOf(body?.assigneeMemberId) || null,
    };
    const actionName = typeof body?.actionName === 'string' ? body.actionName.trim() : '';
    const description =
      typeof body?.description === 'string' && body.description.trim() ? body.description : null;
    const email = body?.email !== false;
    const tabId = idOf(body?.tabId);
    const elementId = idOf(body?.elementId);
    if ((!target.userId && !target.memberId) || !documentId || !actionName) {
      return badRequest('missing assigneeUserId/documentId/actionName');
    }
    if (actionName.length > ACTION_NAME_MAX) return badRequest('actionName too long');
    if (description && description.length > ACTION_DESCRIPTION_MAX) {
      return badRequest('description too long');
    }
    const [assignee] = teamTargets(people, [target], owner);
    if (!assignee) return notFound();
    const grant = await callerGrant(ctx, documentId);
    if (!grant) return notFound();
    const [canOpen, assigner] = await Promise.all([
      personCanOpen(ctx, grant, teamId, assignee),
      getParticipant(ctx.env, owner),
    ]);
    const sent = await documentRoom(ctx.env, documentId).notifyAction({
      assignee,
      assignerUserId: owner,
      // The assigner's name from their verified identity (profile, then address), never the body.
      assignerName: assigner?.name ?? ctx.accountEmail ?? null,
      assigneeCanOpen: canOpen,
      actionName,
      description,
      email,
      push: {
        url:
          tabId && elementId
            ? elementActionUrl(ctx.env, documentId, tabId, elementId)
            : documentUrl(ctx.env, documentId),
        tag: pushTag(documentId, elementId || 'action'),
      },
    });
    return sent ? json({ ok: true }, { status: 202 }) : notFound();
  }

  // POST /api/teams/<id>/notify-mention {documentId, commentText, mentions: [{userId? | memberId?}]}: email the
  // teammates a comment just @-mentioned. A mention is only ever of the canvas's OWN team, so the team in the path
  // must be the canvas's; anyone else a comment names is skipped.
  const commentText = typeof body?.commentText === 'string' ? body.commentText.trim() : '';
  const mentions = Array.isArray(body?.mentions) ? (body.mentions as unknown[]) : null;
  if (!documentId || !commentText || !mentions) {
    return badRequest('missing documentId/commentText/mentions');
  }
  if (commentText.length > MENTION_COMMENT_MAX) return badRequest('commentText too long');
  if (mentions.length > MENTIONS_MAX) return badRequest('too many mentions');
  const grant = await callerGrant(ctx, documentId);
  if (!grant || grant.team !== teamId) return notFound();
  const recipients = teamTargets(
    people,
    mentions.map((m) => {
      const t = (m ?? {}) as Record<string, unknown>;
      return { userId: idOf(t.userId) || null, memberId: idOf(t.memberId) || null };
    }),
    owner,
  );
  if (recipients.length === 0) return json({ ok: true }, { status: 202 });
  const author = await getParticipant(ctx.env, owner);
  const sent = await documentRoom(ctx.env, documentId).notifyMention({
    recipients,
    authorUserId: owner,
    // The author's name from their verified identity, never the body.
    authorName: author?.name ?? ctx.accountEmail ?? null,
    commentText,
  });
  return sent ? json({ ok: true }, { status: 202 }) : notFound();
}
