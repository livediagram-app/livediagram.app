// POST /api/designs/<id>/notify-action: email a teammate about an action just assigned to them on this design
// (docs/specs/012-collaboration/assigned-actions.md "The email"). Answered inside the design's Durable Object, which
// keeps the email's once-only claim. The assignment itself is already in the design (the tab save); this only says so.
//
//   body: { teamId, assigneeUserId? | assigneeMemberId?, actionName, description? }
//
// The server establishes every fact that matters itself. The caller is a signed-in person (never an API token)
// who can open the design (its grant) and has joined `teamId` (their token's teams). The assignee is one of that
// team's joined or invited people (accounts), and never the caller. The design's name, the assigner's name and the
// assignee's address come from server state, never the body. Whether the assignee can open the design decides
// whether the email names it. 404, never 403, for anyone or anything the caller cannot name, so the route cannot
// probe who exists. Answered 202 at once; the email goes in the background.

import { teamTargets, type TeamPerson } from '@liveworkspace/auth-client';
import { getDesignMeta } from '../db';
import { notifyActionAssigned } from '../email/notifications';
import { requestGrant } from '../index-service';
import { teamPeople } from '../accounts/notify';
import { isAccountOwner } from '../accounts/client';
import { getParticipant } from '../accounts/profiles';
import { badRequest, forbidden, json, notFound } from '../responses';
import { gateRead, readBody, requireOwner, type DesignRouteContext } from './context';

// Body caps: generous against any real action, tight against abuse.
export const ACTION_NAME_MAX = 200;
export const ACTION_DESCRIPTION_MAX = 2000;
const ID_MAX = 200;

const optionalId = (value: unknown): string | null | false =>
  value === undefined || value === null || value === ''
    ? null
    : typeof value === 'string' && value.length <= ID_MAX
      ? value
      : false;

// Can the assignee open the design (assigned-actions.md §4)? It is in the assigning team's library (an invited
// person gets in on accepting), they own it, they have joined its own team, or they opened it through a share
// link before (the index, asked for them with no team).
async function assigneeCanOpen(
  ctx: DesignRouteContext,
  design: { id: string; ownerId: string; teamId: string | null },
  teamId: string,
  assignee: TeamPerson,
): Promise<boolean> {
  if (design.teamId === teamId) return true;
  const userId = assignee.userId;
  if (!userId) return false;
  if (design.ownerId === userId) return true;
  if (design.teamId) {
    const theirs = await teamPeople(ctx.env, design.teamId);
    if (theirs?.some((p) => p.userId === userId && p.status === 'joined')) return true;
  }
  const grant = await requestGrant(
    ctx.env,
    { kind: 'delegate', personId: userId, teams: [] },
    design.id,
    null,
  );
  // A link with a password still lets them in once they type it.
  return grant.ok || grant.error === 'password_required';
}

export async function handleNotifyAction(ctx: DesignRouteContext, id: string): Promise<Response> {
  if (ctx.request.method !== 'POST') return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const userId = ctx.verifiedUserId;
  // A signed-in person's assignment: never a guest's, an API token's or a link visitor's.
  if (ctx.token || !userId || userId !== owner || !isAccountOwner(userId)) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const teamId = optionalId(body.teamId);
  const assigneeUserId = optionalId(body.assigneeUserId);
  const assigneeMemberId = optionalId(body.assigneeMemberId);
  const actionName = typeof body.actionName === 'string' ? body.actionName.trim() : '';
  const description =
    typeof body.description === 'string' && body.description.trim() ? body.description : null;
  if (!teamId || assigneeUserId === false || assigneeMemberId === false) {
    return badRequest('missing teamId');
  }
  if ((!assigneeUserId && !assigneeMemberId) || !actionName) {
    return badRequest('missing assigneeUserId/actionName');
  }
  if (actionName.length > ACTION_NAME_MAX) return badRequest('actionName too long');
  if (description && description.length > ACTION_DESCRIPTION_MAX) {
    return badRequest('description too long');
  }
  // The caller has joined the team (their token says so) and can open the design (their grant).
  if (!(ctx.teams ?? []).some((t) => t.id === teamId)) return notFound();
  if (!(await gateRead(ctx, id))) return notFound();
  const design = await getDesignMeta(ctx.env, id);
  if (!design) return notFound();
  const people = await teamPeople(ctx.env, teamId);
  // The token's claim, confirmed by the team as accounts holds it now (someone removed since stays out).
  if (!people?.some((p) => p.userId === userId && p.status === 'joined')) return notFound();
  const [assignee] = teamTargets(
    people,
    [{ userId: assigneeUserId || null, memberId: assigneeMemberId || null }],
    userId,
  );
  if (!assignee) return notFound();
  const [canOpen, assigner] = await Promise.all([
    assigneeCanOpen(ctx, design, teamId, assignee),
    getParticipant(ctx.env, userId),
  ]);
  ctx.waitUntil?.(
    notifyActionAssigned(ctx.env, {
      assignee,
      assignerUserId: userId,
      assignerName: assigner?.name ?? ctx.accountEmail ?? null,
      design: { id: design.id, name: design.name },
      assigneeCanOpen: canOpen,
      actionName,
      description,
    }).catch(() => {}),
  );
  return json({ ok: true }, { status: 202 });
}
