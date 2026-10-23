// POST /api/workbench/sessions and DELETE /api/workbench/sessions/current
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "Redemption"). Redemption is credential-free: the
// ticket is the bearer. A document session acts as the ticket's owner on its one document, at the lower of the
// ticket's level and the owner's access now; a workspace session acts as them in their workspace at the ticket's
// level, each route capping it by their access now. Both last WORKBENCH_SESSION_TTL_MS or until the token's expiry.

import {
  capWorkbenchRole,
  WORKBENCH_HANDLE_PATTERN,
  WORKBENCH_SESSION_TTL_MS,
  type InvalidTicket,
  type WorkbenchSessionResponse,
} from '@livedocuments/api-schema';
import {
  generateWorkbenchSecret,
  hashWorkbenchSecret,
  sessionPrefixOf,
} from '../auth/workbench-session';
import { getParticipant } from '../person/profiles';
import {
  consumeWorkbenchTicket,
  deleteWorkbenchSession,
  insertWorkbenchSession,
  type WorkbenchReach,
} from '../db/workbench';
import { badRequest, forbidden, json, noContent } from '../responses';
import { readBody, type RouteContext } from './context';
import { ownerDocumentAccess } from './workbench-access';

export async function redeemWorkbenchTicket(ctx: RouteContext): Promise<Response> {
  if (ctx.workbench) return forbidden('workbench_confined');
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const ticket = body.ticket;
  if (typeof ticket !== 'string' || !WORKBENCH_HANDLE_PATTERN.test(ticket))
    return badRequest('invalid ticket');
  const now = Date.now();

  const consumed = await consumeWorkbenchTicket(ctx.env, await hashWorkbenchSecret(ticket), now);
  if (!consumed.ok) {
    console.warn('[workbench] session-refused', { reason: consumed.reason, scope: null });
    const answer: InvalidTicket = { error: 'invalid_ticket', reason: consumed.reason };
    return json(answer, { status: 401 });
  }
  const t = consumed.ticket;
  let ceiling = t.role;
  if (t.scope === 'document') {
    const access = await ownerDocumentAccess(ctx.env, t.documentId, t.ownerId);
    if (access instanceof Response) {
      console.warn('[workbench] session-refused', {
        reason: 'access',
        scope: t.scope,
        documentId: t.documentId,
        tokenId: t.tokenId,
      });
      return access;
    }
    ceiling = capWorkbenchRole(t.role, access.role);
  }

  const role = capWorkbenchRole(ceiling, t.tokenReadOnly ? 'view' : undefined);
  const reach: WorkbenchReach =
    t.scope === 'document'
      ? { scope: 'document', documentId: t.documentId, folderId: null }
      : { scope: 'workspace', documentId: null, folderId: t.folderId };
  const session = generateWorkbenchSecret();
  const id = crypto.randomUUID();
  const expiresAt = Math.min(now + WORKBENCH_SESSION_TTL_MS, t.tokenExpiresAt);
  await insertWorkbenchSession(ctx.env, {
    id,
    secretHash: await hashWorkbenchSecret(session),
    ownerId: t.ownerId,
    tokenId: t.tokenId,
    pairingId: t.pairingId,
    ...reach,
    tabId: t.tabId,
    origin: t.origin,
    role,
    createdAt: now,
    expiresAt,
  });
  const participant = await getParticipant(ctx.env, t.ownerId);
  console.log('[workbench] session-opened', {
    scope: t.scope,
    documentId: t.documentId,
    tokenId: t.tokenId,
    sessionPrefix: sessionPrefixOf(id),
    role,
  });
  const answer: WorkbenchSessionResponse = {
    session,
    ...(reach.scope === 'document' ? { ...reach, tabId: t.tabId } : { ...reach, tabId: null }),
    origin: t.origin,
    role,
    expiresAt,
    person: {
      id: t.ownerId,
      name: participant?.name ?? null,
      color: participant?.color ?? null,
    },
  };
  return json(answer, { status: 201 });
}

// The page ends its own session: after a renewal swaps in the next one, or when it unbinds. Its room socket
// stays (renewal keeps it, WB11).
export async function endCurrentWorkbenchSession(ctx: RouteContext): Promise<Response> {
  const workbench = ctx.workbench;
  if (!workbench) return forbidden('not_a_workbench_session');
  await deleteWorkbenchSession(ctx.env, workbench.sessionId);
  console.log('[workbench] session-ended', {
    reason: 'ended',
    scope: workbench.scope,
    documentId: workbench.documentId,
    tokenId: workbench.tokenId,
    sessionPrefix: sessionPrefixOf(workbench.sessionId),
  });
  return noContent();
}
