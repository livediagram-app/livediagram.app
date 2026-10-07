// POST /api/workbench/tickets (docs/specs/013-workspace/blueprints/workbench-embeds.md "The ticket mint"): a
// paired token mints a single-use, one-minute ticket that opens one session on one document. An unpaired
// origin answers 428 with the pairing URL; the person approves it once in their own browser.

import {
  capWorkbenchRole,
  parseWorkbenchOrigin,
  WORKBENCH_TICKET_TTL_MS,
  type WorkbenchPairingRequired,
  type WorkbenchTicketResponse,
} from '@livediagram/api-schema';
import {
  generatePairingCode,
  generateWorkbenchTicket,
  hashWorkbenchSecret,
} from '../auth/workbench-session';
import { documentLinksTab } from '../db/tabs';
import { findWorkbenchPairing, insertWorkbenchTicket, openPairingRequest } from '../db/workbench';
import { appBaseUrl } from '../email/client';
import { badRequest, forbidden, json, notFound, rateLimited } from '../responses';
import { readBody, type RouteContext } from './context';
import { ownerDocumentAccess } from './workbench-access';

const ID_MAX = 64;

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= ID_MAX;

export const pairingUrlOf = (ctx: RouteContext, code: string) =>
  `${appBaseUrl(ctx.env)}/workbench/pair?code=${code}`;

// The mint and the pairing request share one bucket per token (WB42).
export async function workbenchRateLimited(ctx: RouteContext, tokenId: string): Promise<boolean> {
  const limiter = ctx.env.WORKBENCH_TICKET_RATE_LIMITER;
  if (!limiter) return false;
  return !(await limiter.limit({ key: `workbench-ticket:${tokenId}` })).success;
}

export async function mintWorkbenchTicket(ctx: RouteContext): Promise<Response> {
  const token = ctx.token;
  const ownerId = ctx.resolveOwner();
  if (!token || !ownerId) return forbidden('token_required');
  const refused = (reason: string, res: Response) => {
    console.warn('[workbench] mint-refused', { reason, tokenId: token.id });
    return res;
  };
  if (await workbenchRateLimited(ctx, token.id)) return refused('rate_limited', rateLimited());

  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  if (!isId(body.documentId)) return badRequest('invalid documentId');
  if (body.tabId !== undefined && !isId(body.tabId)) return badRequest('invalid tabId');
  const parsed = parseWorkbenchOrigin(typeof body.origin === 'string' ? body.origin : '');
  if (!parsed.ok) return refused('invalid_origin', json({ error: 'invalid_origin' }, { status: 400 }));
  const origin = parsed.origin;
  const documentId = body.documentId;
  const tabId = body.tabId ?? null;
  const now = Date.now();

  const pairing = await findWorkbenchPairing(ctx.env, token.id, origin);
  if (!pairing) {
    const request = await openPairingRequest(ctx.env, {
      ownerId,
      tokenId: token.id,
      origin,
      name: null,
      code: generatePairingCode(),
      now,
    });
    console.log('[workbench] pairing-requested', {
      tokenId: token.id,
      originHost: new URL(origin).hostname,
      via: 'mint',
      reused: request.reused,
    });
    const answer: WorkbenchPairingRequired = {
      error: 'pairing_required',
      pairingUrl: pairingUrlOf(ctx, request.code),
      expiresAt: request.expiresAt,
    };
    return json(answer, { status: 428 });
  }

  const access = await ownerDocumentAccess(ctx.env, documentId, ownerId);
  if (access instanceof Response) return refused('not_found', access);
  if (tabId !== null && !(await documentLinksTab(ctx.env, documentId, tabId)))
    return refused('not_found', notFound());

  const role = capWorkbenchRole(access.role, token.readOnly ? 'view' : undefined);
  const ticket = generateWorkbenchTicket();
  const expiresAt = now + WORKBENCH_TICKET_TTL_MS;
  await insertWorkbenchTicket(ctx.env, {
    ticketHash: await hashWorkbenchSecret(ticket),
    ownerId,
    tokenId: token.id,
    pairingId: pairing.id,
    documentId,
    tabId,
    origin,
    role,
    createdAt: now,
    expiresAt,
  });
  console.log('[workbench] ticket-minted', { documentId, tokenId: token.id, role });
  const answer: WorkbenchTicketResponse = {
    url: `${appBaseUrl(ctx.env)}/embed/workbench?d=${encodeURIComponent(documentId)}#ticket=${ticket}`,
    documentId,
    tabId,
    expiresAt,
  };
  return json(answer, { status: 201 });
}
