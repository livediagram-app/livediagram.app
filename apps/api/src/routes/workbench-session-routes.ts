// POST /api/workbench/sessions and DELETE /api/workbench/sessions/current
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "Redemption"). Redemption is credential-free: the
// ticket is the bearer. A session acts as the ticket's owner on its one document, at the lower of the ticket's
// level and the owner's access now, until WORKBENCH_SESSION_TTL_MS or the token's own expiry.

import {
  capWorkbenchRole,
  WORKBENCH_HANDLE_PATTERN,
  WORKBENCH_SESSION_TTL_MS,
  type InvalidTicket,
  type WorkbenchSessionResponse,
} from '@livediagram/api-schema';
import {
  generateWorkbenchSecret,
  hashWorkbenchSecret,
  sessionPrefixOf,
} from '../auth/workbench-session';
import { getParticipant } from '../db/participants';
import {
  consumeWorkbenchTicket,
  deleteWorkbenchSession,
  insertWorkbenchSession,
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
    console.warn('[workbench] session-refused', { reason: consumed.reason });
    const answer: InvalidTicket = { error: 'invalid_ticket', reason: consumed.reason };
    return json(answer, { status: 401 });
  }
  const t = consumed.ticket;
  const access = await ownerDocumentAccess(ctx.env, t.documentId, t.ownerId);
  if (access instanceof Response) {
    console.warn('[workbench] session-refused', {
      reason: 'access',
      documentId: t.documentId,
      tokenId: t.tokenId,
    });
    return access;
  }

  const role = capWorkbenchRole(
    capWorkbenchRole(t.role, access.role),
    t.tokenReadOnly ? 'view' : undefined,
  );
  const session = generateWorkbenchSecret();
  const id = crypto.randomUUID();
  const expiresAt = Math.min(now + WORKBENCH_SESSION_TTL_MS, t.tokenExpiresAt);
  await insertWorkbenchSession(ctx.env, {
    id,
    secretHash: await hashWorkbenchSecret(session),
    ownerId: t.ownerId,
    tokenId: t.tokenId,
    pairingId: t.pairingId,
    documentId: t.documentId,
    tabId: t.tabId,
    origin: t.origin,
    role,
    createdAt: now,
    expiresAt,
  });
  const participant = await getParticipant(ctx.env, t.ownerId);
  console.log('[workbench] session-opened', {
    documentId: t.documentId,
    tokenId: t.tokenId,
    sessionPrefix: sessionPrefixOf(id),
    role,
  });
  const answer: WorkbenchSessionResponse = {
    session,
    documentId: t.documentId,
    tabId: t.tabId,
    origin: t.origin,
    role,
    expiresAt,
    person: {
      id: t.ownerId,
      name: participant?.name ?? null,
      color: participant?.color ?? null,
      pictureUrl: participant?.pictureUrl ?? null,
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
    documentId: workbench.documentId,
    tokenId: workbench.tokenId,
    sessionPrefix: sessionPrefixOf(workbench.sessionId),
  });
  return noContent();
}
