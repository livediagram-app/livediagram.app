// Workbench pairing (docs/specs/013-workspace/blueprints/workbench-embeds.md "Pairing"): a token asks to pair
// with an origin and waits; the token's owner answers once in their own signed-in browser; Settings lists and
// removes pairings. Only a Clerk session answers or unpairs, so no token, workbench session or guest can
// approve a pairing for itself.

import {
  DEVICE_POLL_INTERVAL_S,
  normaliseWorkbenchName,
  parseWorkbenchOrigin,
  WORKBENCH_HANDLE_PATTERN,
  type WorkbenchPairingRequestCreated,
  type WorkbenchPairingRequestView,
  type WorkbenchPairingStatusResponse,
} from '@livediagram/api-schema';
import { generatePairingCode } from '../auth/workbench-session';
import {
  answerPairingRequest,
  findWorkbenchPairing,
  listWorkbenchPairings,
  openPairingRequest,
  pairingRequestStatus,
  readPairingRequest,
  workbenchPairingOwner,
} from '../db/workbench';
import {
  conflict,
  forbidden,
  json,
  noContent,
  notFound,
  rateLimited,
  signInRequired,
} from '../responses';
import { endWorkbenchAccess } from '../workbench-end';
import { readBody, type RouteContext } from './context';
import { pairingUrlOf, workbenchRateLimited } from './workbench-ticket-route';

// POST /api/workbench/pairing-requests: `workbench pair` asks, by token.
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

  const pairing = await findWorkbenchPairing(ctx.env, token.id, origin);
  if (pairing) {
    const answer: WorkbenchPairingRequestCreated = { status: 'paired', pairing };
    return json(answer);
  }
  const request = await openPairingRequest(ctx.env, {
    ownerId,
    tokenId: token.id,
    origin,
    name: normaliseWorkbenchName(body.name),
    code: generatePairingCode(),
    now: Date.now(),
  });
  console.log('[workbench] pairing-requested', {
    tokenId: token.id,
    originHost: new URL(origin).hostname,
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
  if (!ctx.token) return forbidden('token_required');
  const status = await pairingRequestStatus(ctx.env, code, ctx.token.id, Date.now());
  if (!status) return notFound();
  const answer: WorkbenchPairingStatusResponse = { ...status, interval: DEVICE_POLL_INTERVAL_S };
  return json(answer);
}

// GET /api/workbench/pairing-requests/:code: the pairing page's view, for the token's owner.
export async function readPairing(ctx: RouteContext, code: string): Promise<Response> {
  const userId = ctx.clerkUserId;
  if (!userId) return signInRequired();
  const request = await readPairingRequest(ctx.env, code, Date.now());
  if (!request || request.ownerId !== userId) return notFound();
  const view: WorkbenchPairingRequestView = {
    origin: request.origin,
    name: request.name,
    tokenName: request.tokenName,
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
  const userId = ctx.clerkUserId;
  if (!userId) return signInRequired();
  const result = await answerPairingRequest(ctx.env, {
    code,
    ownerId: userId,
    answer,
    pairingId: crypto.randomUUID(),
    now: Date.now(),
  });
  switch (result.outcome) {
    case 'missing':
      return notFound();
    case 'answered':
      return conflict('pairing_answered');
    case 'expired':
      return json({ error: 'pairing_expired' }, { status: 410 });
    case 'declined': {
      const request = await readPairingRequest(ctx.env, code, Date.now());
      console.log('[workbench] pairing-declined', { tokenId: request?.tokenId ?? null });
      return noContent();
    }
    case 'approved':
      console.log('[workbench] paired', {
        tokenId: result.pairing.tokenId,
        pairingId: result.pairing.id,
      });
      return json({ pairing: result.pairing });
  }
}

// GET /api/workbench/pairings (WB46): Settings > API tokens.
export async function listPairings(ctx: RouteContext): Promise<Response> {
  const userId = ctx.clerkUserId;
  if (!userId) return signInRequired();
  return json({ pairings: await listWorkbenchPairings(ctx.env, userId, Date.now()) });
}

// DELETE /api/workbench/pairings/:id: Unpair, ending that pairing's sessions.
export async function unpair(ctx: RouteContext, id: string): Promise<Response> {
  const userId = ctx.clerkUserId;
  if (!userId) return signInRequired();
  if ((await workbenchPairingOwner(ctx.env, id)) !== userId) return notFound();
  await endWorkbenchAccess(ctx.env, { pairingId: id }, 'unpaired');
  return noContent();
}

export const isPairingCode = (value: string | undefined): value is string =>
  value !== undefined && WORKBENCH_HANDLE_PATTERN.test(value);
