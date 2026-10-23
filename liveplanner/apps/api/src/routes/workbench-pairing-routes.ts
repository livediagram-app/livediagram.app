// Workbench pairing (docs/specs/013-workspace/blueprints/workbench-embeds.md "Pairing"): a token asks to pair
// with an origin and waits; the token's owner answers once in their own signed-in browser; Settings lists and
// removes pairings. Only a signed-in session answers or unpairs, so no token, workbench session or guest can
// approve a pairing for itself.

import {
  DEVICE_POLL_INTERVAL_S,
  isWorkbenchScope,
  normaliseWorkbenchName,
  pairingCoversScope,
  parseWorkbenchOrigin,
  type WorkbenchPairingRequestCreated,
  type WorkbenchPairingRequestView,
  type WorkbenchPairingStatusResponse,
} from '@liveplanner/api-schema';
import {
  conflict,
  forbidden,
  json,
  noContent,
  notFound,
  rateLimited,
  signInRequired,
} from '../responses';
import { workbenchStore } from '../workbench-store';
import { readBody, type RouteContext } from './context';
import { pairingUrlOf, workbenchRateLimited, workbenchTokenOf } from './workbench-ticket-route';

// POST /api/workbench/pairing-requests: `workbench pair` asks, by token, for one scope (absent: `project`).
export async function openPairing(ctx: RouteContext): Promise<Response> {
  const token = ctx.token;
  const ownerId = ctx.resolveOwner();
  if (!token || !ownerId) return forbidden('token_required');
  if (await workbenchRateLimited(ctx, token.id)) return rateLimited();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const parsed = parseWorkbenchOrigin(typeof body.origin === 'string' ? body.origin : '');
  if (!parsed.ok) return json({ error: 'invalid_origin' }, { status: 400 });
  const origin = parsed.origin;
  const scope = body.scope ?? 'project';
  if (!isWorkbenchScope(scope))
    return json({ error: 'invalid_value', message: 'invalid scope' }, { status: 400 });

  const store = workbenchStore(ctx.env, ownerId);
  const pairing = await store.findPairing(token.id, origin);
  if (pairing && pairingCoversScope(pairing.scope, scope)) {
    const answer: WorkbenchPairingRequestCreated = { status: 'paired', pairing };
    return json(answer);
  }
  const request = await store.openPairingRequest({
    personId: ownerId,
    token: workbenchTokenOf(token),
    origin,
    scope,
    name: normaliseWorkbenchName(body.name),
    now: Date.now(),
  });
  console.log('[workbench] pairing-requested', {
    tokenId: token.id,
    originHost: new URL(origin).hostname,
    scope,
    via: 'pair',
    reused: request.reused,
  });
  const answer: WorkbenchPairingRequestCreated = {
    status: 'pending',
    pairingUrl: pairingUrlOf(ctx, request.code),
    code: request.code,
    expiresAt: request.expiresAt,
    interval: DEVICE_POLL_INTERVAL_S,
  };
  return json(answer);
}

// GET /api/workbench/pairing-requests/:code/status: the waiting CLI's poll, by the token that asked.
export async function pollPairing(ctx: RouteContext, code: string): Promise<Response> {
  const ownerId = ctx.resolveOwner();
  if (!ctx.token || !ownerId) return forbidden('token_required');
  const status = await workbenchStore(ctx.env, ownerId).pairingRequestStatus(
    code,
    ctx.token.id,
    Date.now(),
  );
  if (!status) return notFound();
  const answer: WorkbenchPairingStatusResponse = { ...status, interval: DEVICE_POLL_INTERVAL_S };
  return json(answer);
}

// GET /api/workbench/pairing-requests/:code: the pairing page's view, for the token's owner.
export async function readPairing(ctx: RouteContext, code: string): Promise<Response> {
  const userId = ctx.accountUserId;
  if (!userId) return signInRequired();
  const request = await workbenchStore(ctx.env, userId).readPairingRequest(code, Date.now());
  if (!request) return notFound();
  const view: WorkbenchPairingRequestView = {
    origin: request.origin,
    name: request.name,
    tokenName: request.tokenName,
    scope: request.scope,
    expiresAt: request.expiresAt,
    status: request.status,
  };
  return json({ request: view });
}

// POST /api/workbench/pairing-requests/:code/approve and /decline: answered once, by the token's owner.
export async function answerPairing(
  ctx: RouteContext,
  code: string,
  answer: 'approve' | 'decline',
): Promise<Response> {
  const userId = ctx.accountUserId;
  if (!userId) return signInRequired();
  const result = await workbenchStore(ctx.env, userId).answerPairingRequest({
    code,
    answer,
    now: Date.now(),
  });
  switch (result.outcome) {
    case 'missing':
      return notFound();
    case 'answered':
      return conflict('pairing_answered');
    case 'expired':
      return json({ error: 'pairing_expired' }, { status: 410 });
    case 'declined':
      console.log('[workbench] pairing-declined', { tokenId: result.tokenId, scope: result.asked });
      return noContent();
    case 'approved':
      console.log('[workbench] paired', {
        tokenId: result.pairing.tokenId,
        pairingId: result.pairing.id,
        scope: result.asked,
      });
      return json({ pairing: result.pairing });
  }
}

// GET /api/workbench/pairings (WB46): Settings > API tokens.
export async function listPairings(ctx: RouteContext): Promise<Response> {
  const userId = ctx.accountUserId;
  if (!userId) return signInRequired();
  return json({ pairings: await workbenchStore(ctx.env, userId).listPairings(Date.now()) });
}

// DELETE /api/workbench/pairings/:id: Unpair, ending that pairing's sessions.
export async function unpair(ctx: RouteContext, id: string): Promise<Response> {
  const userId = ctx.accountUserId;
  if (!userId) return signInRequired();
  const store = workbenchStore(ctx.env, userId);
  if (!(await store.hasPairing(id))) return notFound();
  await store.endAccess({ pairingId: id }, 'unpaired');
  return noContent();
}
