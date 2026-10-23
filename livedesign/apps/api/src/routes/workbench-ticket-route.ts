// POST /api/workbench/tickets (docs/specs/013-workspace/blueprints/workbench-embeds.md "The ticket mint", "The
// workspace mint"): a paired token mints a single-use, one-minute ticket that opens one session, on one design
// (the design scope) or in the person's whole workspace (the workspace scope). An origin the token is not paired
// with for the asked scope answers 428 with the pairing URL; the person approves it once in their own browser.

import {
  capWorkbenchRole,
  pairingCoversScope,
  parseWorkbenchOrigin,
  WORKBENCH_TICKET_TTL_MS,
  type WorkbenchPairing,
  type WorkbenchPairingRequired,
  type WorkbenchRole,
  type WorkbenchScope,
  type WorkbenchTicketResponse,
  type WorkbenchWorkspaceTicketResponse,
} from '@livedesign/api-schema';
import {
  generatePairingCode,
  generateWorkbenchTicket,
  hashWorkbenchSecret,
} from '../auth/workbench-session';
import { designLinksTab } from '../db/tabs';
import {
  findWorkbenchPairing,
  insertWorkbenchTicket,
  openPairingRequest,
  type WorkbenchReach,
} from '../db/workbench';
import { appBaseUrl } from '../email/client';
import { badRequest, forbidden, json, notFound, rateLimited } from '../responses';
import { readBody, type RouteContext } from './context';
import { ownerDesignAccess, ownerReachesFolder } from './workbench-access';

const ID_MAX = 64;

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= ID_MAX;

// The spec's refusals of a body that asks for the wrong things for its scope (WB49).
const invalidValue = (message: string) =>
  json({ error: 'invalid_value', message }, { status: 400 });

export const pairingUrlOf = (ctx: RouteContext, code: string) =>
  `${appBaseUrl(ctx.env)}/workbench/pair?code=${code}`;

// The mint and the pairing request share one bucket per token (WB42).
export async function workbenchRateLimited(ctx: RouteContext, tokenId: string): Promise<boolean> {
  const limiter = ctx.env.WORKBENCH_TICKET_RATE_LIMITER;
  if (!limiter) return false;
  return !(await limiter.limit({ key: `workbench-ticket:${tokenId}` })).success;
}

// What the body asks for, or the 400 that refuses it.
type MintRequest =
  | { scope: 'design'; designId: string; tabId: string | null }
  | { scope: 'workspace'; folderId: string | null };

function readMintRequest(body: Record<string, unknown>): MintRequest | Response {
  const scope = body.scope ?? 'design';
  if (scope === 'workspace') {
    if (body.designId !== undefined || body.tabId !== undefined)
      return invalidValue('a workspace ticket names no design');
    if (body.folderId !== undefined && !isId(body.folderId))
      return invalidValue('invalid folderId');
    return { scope, folderId: body.folderId ?? null };
  }
  if (scope !== 'design') return invalidValue('invalid scope');
  if (body.designId === undefined) return invalidValue('invalid designId');
  if (!isId(body.designId)) return badRequest('invalid designId');
  if (body.tabId !== undefined && !isId(body.tabId)) return badRequest('invalid tabId');
  if (body.folderId !== undefined) return invalidValue('a design ticket names no folder');
  return { scope, designId: body.designId, tabId: body.tabId ?? null };
}

export async function mintWorkbenchTicket(ctx: RouteContext): Promise<Response> {
  const token = ctx.token;
  const ownerId = ctx.resolveOwner();
  if (!token || !ownerId) return forbidden('token_required');
  const refused = (reason: string, scope: WorkbenchScope | null, res: Response) => {
    console.warn('[workbench] mint-refused', { reason, scope, tokenId: token.id });
    return res;
  };
  if (await workbenchRateLimited(ctx, token.id))
    return refused('rate_limited', null, rateLimited());

  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const asked = readMintRequest(body);
  if (asked instanceof Response) return refused('invalid_value', null, asked);
  const parsed = parseWorkbenchOrigin(typeof body.origin === 'string' ? body.origin : '');
  if (!parsed.ok)
    return refused(
      'invalid_origin',
      asked.scope,
      json({ error: 'invalid_origin' }, { status: 400 }),
    );
  const origin = parsed.origin;
  const now = Date.now();

  const pairing = await findWorkbenchPairing(ctx.env, token.id, origin);
  if (!pairing || !pairingCoversScope(pairing.scope, asked.scope)) {
    const request = await openPairingRequest(ctx.env, {
      ownerId,
      tokenId: token.id,
      origin,
      scope: asked.scope,
      name: null,
      code: generatePairingCode(),
      now,
    });
    console.log('[workbench] pairing-requested', {
      tokenId: token.id,
      originHost: new URL(origin).hostname,
      scope: asked.scope,
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

  const ceiling = token.readOnly ? 'view' : undefined;
  if (asked.scope === 'workspace') {
    if (asked.folderId !== null && !(await ownerReachesFolder(ctx.env, ownerId, asked.folderId)))
      return refused('not_found', asked.scope, notFound());
    const minted = await insertTicket(ctx, pairing, ownerId, {
      reach: { scope: 'workspace', designId: null, folderId: asked.folderId },
      tabId: null,
      role: capWorkbenchRole('edit', ceiling),
      now,
    });
    const folderPath =
      asked.folderId === null ? '' : `/folder/${encodeURIComponent(asked.folderId)}`;
    const answer: WorkbenchWorkspaceTicketResponse = {
      url: `${appBaseUrl(ctx.env)}/embed/workbench/explorer${folderPath}#ticket=${minted.ticket}`,
      scope: 'workspace',
      folderId: asked.folderId,
      expiresAt: minted.expiresAt,
    };
    return json(answer, { status: 201 });
  }

  const { designId, tabId } = asked;
  const access = await ownerDesignAccess(ctx.env, designId, ownerId);
  if (access instanceof Response) return refused('not_found', asked.scope, access);
  if (tabId !== null && !(await designLinksTab(ctx.env, designId, tabId)))
    return refused('not_found', asked.scope, notFound());

  const minted = await insertTicket(ctx, pairing, ownerId, {
    reach: { scope: 'design', designId, folderId: null },
    tabId,
    role: capWorkbenchRole(access.role, ceiling),
    now,
  });
  const answer: WorkbenchTicketResponse = {
    url: `${appBaseUrl(ctx.env)}/embed/workbench?d=${encodeURIComponent(designId)}#ticket=${minted.ticket}`,
    designId,
    tabId,
    expiresAt: minted.expiresAt,
  };
  return json(answer, { status: 201 });
}

async function insertTicket(
  ctx: RouteContext,
  pairing: WorkbenchPairing,
  ownerId: string,
  input: { reach: WorkbenchReach; tabId: string | null; role: WorkbenchRole; now: number },
): Promise<{ ticket: string; expiresAt: number }> {
  const { reach, tabId, role, now } = input;
  const ticket = generateWorkbenchTicket();
  const expiresAt = now + WORKBENCH_TICKET_TTL_MS;
  await insertWorkbenchTicket(ctx.env, {
    ticketHash: await hashWorkbenchSecret(ticket),
    ownerId,
    tokenId: pairing.tokenId,
    pairingId: pairing.id,
    ...reach,
    tabId,
    origin: pairing.origin,
    role,
    createdAt: now,
    expiresAt,
  });
  console.log('[workbench] ticket-minted', {
    scope: reach.scope,
    designId: reach.designId,
    folderId: reach.folderId,
    tokenId: pairing.tokenId,
    role,
  });
  return { ticket, expiresAt };
}
