// /api/teams/<id>/access-check + /notify-action — the assigned-actions
// endpoints (docs/specs/012-collaboration/assigned-actions.md), split out of teams.ts the same way the document
// route families own their own modules. Both are team-scoped: the
// caller resolves the team + their own membership row once and passes
// the scope in.

import type { TeamMember } from '@livediagram/api-schema';
import { getDocumentMeta, getMembership, getParticipant, hasSharedAccess } from '../db';
import { listTeamMembers } from '../db';
import { badRequest, forbidden, json, notFound } from '../responses';
import { notifyActionAssigned } from '../email/notifications';
import type { RouteContext } from './context';

// docs/specs/012-collaboration/assigned-actions.md notify-action body caps: generous vs any real action, tight vs abuse.
const ACTION_NAME_MAX = 200;
const ACTION_DESCRIPTION_MAX = 2000;

// Returns null when the request isn't an action route.
export async function handleTeamActionRoutes(
  ctx: RouteContext,
  scope: { teamId: string; me: TeamMember; userId: string },
): Promise<Response | null> {
  const { request, env, url, segments, clerkEmail } = ctx;
  const { teamId, me, userId } = scope;

  // /api/teams/<id>/access-check — can this teammate open that document?
  // (docs/specs/012-collaboration/assigned-actions.md). Drives the Assign Action dialog's access hint: a REAL
  // answer instead of a client-side guess. Same gates as notify-action
  // below (caller + assignee joined members, caller can access the
  // document, 404s that never probe); the answer covers the three legs
  // the server can see — the assignee owns the document, is a joined
  // member of its team-library team, or has opened it via a share link.
  // A GET, so token callers pass too (read-only, team-scoped).
  if (segments.length === 4 && segments[3] === 'access-check') {
    if (request.method !== 'GET') return notFound();
    if (me.status !== 'joined') return forbidden();
    const assigneeUserId = url.searchParams.get('assigneeUserId') ?? '';
    const documentId = url.searchParams.get('documentId') ?? '';
    if (!assigneeUserId || !documentId) return badRequest('missing assigneeUserId/documentId');
    const assignee = await getMembership(env, teamId, assigneeUserId);
    if (!assignee || assignee.status !== 'joined') return notFound();
    const liveDoc = await getDocumentMeta(env, documentId);
    if (!liveDoc) return notFound();
    const callerIsOwner = liveDoc.ownerId === userId;
    const callerViaTeam = liveDoc.teamId
      ? (await getMembership(env, liveDoc.teamId, userId))?.status === 'joined'
      : false;
    const callerViaShare =
      callerIsOwner || callerViaTeam ? false : await hasSharedAccess(env, userId, documentId);
    if (!callerIsOwner && !callerViaTeam && !callerViaShare) return notFound();
    const canAccess =
      liveDoc.ownerId === assigneeUserId ||
      (liveDoc.teamId
        ? (await getMembership(env, liveDoc.teamId, assigneeUserId))?.status === 'joined'
        : false) ||
      (await hasSharedAccess(env, assigneeUserId, documentId));
    return json({ canAccess });
  }

  // /api/teams/<id>/notify-action — email a teammate about an action just
  // assigned to them on a document element (docs/specs/012-collaboration/assigned-actions.md). A POST, so the shared
  // mutation gate in teams.ts already required the interactive Clerk
  // session. The server establishes every fact that matters itself: both
  // parties must be JOINED members of this team, the caller must be able
  // to access the document, and the document name + assigner name + assignee
  // address all come from server state, never the body. Best-effort in the
  // background; the assignment itself already persisted via the tab write.
  if (segments.length === 4 && segments[3] === 'notify-action') {
    if (request.method !== 'POST') return notFound();
    if (me.status !== 'joined') return forbidden();
    const body = (await request.json().catch(() => null)) as {
      assigneeUserId?: string;
      // The membership row id — the key for an INVITED member the lazy
      // claim hasn't identified with an account yet (docs/specs/012-collaboration/assigned-actions.md).
      assigneeMemberId?: string;
      documentId?: string;
      actionName?: string;
      description?: string;
    } | null;
    const assigneeUserId = typeof body?.assigneeUserId === 'string' ? body.assigneeUserId : '';
    const assigneeMemberId =
      typeof body?.assigneeMemberId === 'string' ? body.assigneeMemberId : '';
    const documentId = typeof body?.documentId === 'string' ? body.documentId : '';
    const actionName = typeof body?.actionName === 'string' ? body.actionName.trim() : '';
    const description = typeof body?.description === 'string' ? body.description : null;
    if ((!assigneeUserId && !assigneeMemberId) || !documentId || !actionName) {
      return badRequest('missing assigneeUserId/documentId/actionName');
    }
    if (actionName.length > ACTION_NAME_MAX) return badRequest('actionName too long');
    if (description && description.length > ACTION_DESCRIPTION_MAX) {
      return badRequest('description too long');
    }
    // The assignee must be a joined OR invited member of this team
    // (docs/specs/012-collaboration/assigned-actions.md — work gets divided while invites are in flight). 404
    // (not 403) so the endpoint can't be used to probe which users
    // exist. An invited member resolves by membership row id.
    const assignee = assigneeUserId
      ? await getMembership(env, teamId, assigneeUserId)
      : ((await listTeamMembers(env, teamId)).find((m) => m.id === assigneeMemberId) ?? null);
    if (!assignee) return notFound();
    // The caller must be able to access the document: their own, in a team
    // library they've joined, or one they've opened through a share link.
    // The document NAME comes from this row, never the request body.
    const liveDoc = await getDocumentMeta(env, documentId);
    if (!liveDoc) return notFound();
    const isOwner = liveDoc.ownerId === userId;
    const viaTeam = liveDoc.teamId
      ? (await getMembership(env, liveDoc.teamId, userId))?.status === 'joined'
      : false;
    const viaShare = isOwner || viaTeam ? false : await hasSharedAccess(env, userId, documentId);
    if (!isOwner && !viaTeam && !viaShare) return notFound();
    // The assigner's display name comes from the caller's own verified
    // identity (participant profile, then their email), so a spoofed
    // assignerName in a tab blob can never sign an email.
    const assignerName = (await getParticipant(env, userId))?.name ?? clerkEmail ?? null;
    ctx.waitUntil?.(
      notifyActionAssigned(env, {
        assigneeUserId: assignee.userId,
        assigneeFallbackEmail: assignee.email,
        assignerName,
        document: { id: liveDoc.id, name: liveDoc.name },
        actionName,
        description,
      }).catch(() => {}),
    );
    return json({ ok: true }, { status: 202 });
  }

  return null;
}
