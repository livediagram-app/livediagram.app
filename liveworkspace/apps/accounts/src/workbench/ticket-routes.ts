// The workbench's tickets and sessions (./routes): minting a ticket for an app, redeeming it for a session, and
// ending the current one.
import type { App } from '@liveworkspace/index-client';
import { bearerOf } from '../bearer.ts';
import { readProfiles } from '../profiles.ts';
import { teamsClaim } from '../teams.ts';
import { appBaseUrl, appOfRequest, dialectOf, scopeOfWire, type Dialect } from './apps.ts';
import { ownerItemAccess, ownerReachesFolder } from './index-access.ts';
import { liveTokenFacts } from './revoke.ts';
import {
  pairingCovers,
  sessionPrefixOf,
  WORKBENCH_SESSION_PATTERN,
  WORKBENCH_TICKET_PATTERN,
  workbenchStoreOf,
  workbenchStoreOfSecret,
  type WorkbenchLevel,
  type WorkbenchReach,
} from './store.ts';
import {
  WORKBENCH_SESSION_TTL_MS,
  WORKBENCH_TICKET_TTL_MS,
  type WorkbenchContext,
  apiTokenOf,
  badRequest,
  capLevel,
  fail,
  invalidValue,
  isId,
  json,
  limited,
  noContent,
  notFound,
  pairingUrlOf,
  parseWorkbenchOrigin,
  rateLimited,
  readBody,
  tokenRequired,
  unknownApp,
} from './route-kit.ts';

// ---------- Tickets ----------------------------------------------------------------------------------------------

type MintRequest =
  | { scope: 'item'; itemId: string; tabId: string | null }
  | { scope: 'workspace'; folderId: string | null };

function readMintRequest(dialect: Dialect, body: Record<string, unknown>): MintRequest | Response {
  const scope = scopeOfWire(dialect, body.scope);
  const itemId = body[dialect.idField];
  if (scope === 'workspace') {
    if (itemId !== undefined || body.tabId !== undefined)
      return invalidValue(`a workspace ticket names no ${dialect.noun}`);
    if (body.folderId !== undefined && !isId(body.folderId))
      return invalidValue('invalid folderId');
    return { scope, folderId: (body.folderId as string | undefined) ?? null };
  }
  if (scope !== 'item') return invalidValue('invalid scope');
  if (itemId === undefined) return invalidValue(`invalid ${dialect.idField}`);
  if (!isId(itemId)) return badRequest(`invalid ${dialect.idField}`);
  if (body.tabId !== undefined && !isId(body.tabId)) return badRequest('invalid tabId');
  if (body.folderId !== undefined) return invalidValue(`a ${dialect.noun} ticket names no folder`);
  return { scope, itemId, tabId: (body.tabId as string | undefined) ?? null };
}

export async function mintTicket(ctx: WorkbenchContext): Promise<Response> {
  const token = await apiTokenOf(ctx);
  if (!token) return tokenRequired();
  const refused = (reason: string, scope: string | null, res: Response) => {
    console.warn('[workbench] mint-refused', { reason, scope, tokenId: token.tokenId });
    return res;
  };
  if (await limited(ctx, token.tokenId)) return refused('rate_limited', null, rateLimited());
  const body = await readBody(ctx.request);
  if (body instanceof Response) return body;
  const app = appOfRequest(ctx.request, body);
  if (!app) return unknownApp();
  const dialect = dialectOf(app);
  const asked = readMintRequest(dialect, body);
  if (asked instanceof Response) return refused('invalid_value', null, asked);
  const origin = parseWorkbenchOrigin(body.origin);
  if (!origin) return refused('invalid_origin', asked.scope, fail(400, 'invalid_origin'));
  const { env, now } = ctx;
  const ownerId = token.userId;

  const store = workbenchStoreOf(env.WORKBENCH!, ownerId);
  const pairing = await store.findPairing(app, token.tokenId, origin);
  if (!pairing || !pairingCovers(pairing.scope, asked.scope)) {
    const request = await store.openPairingRequest({
      personId: ownerId,
      app,
      tokenId: token.tokenId,
      origin,
      scope: asked.scope,
      name: null,
      now,
    });
    console.info('[workbench] pairing-requested', {
      app,
      tokenId: token.tokenId,
      originHost: new URL(origin).hostname,
      scope: asked.scope,
      via: 'mint',
      reused: request.reused,
    });
    return json(
      {
        error: 'pairing_required',
        pairingUrl: pairingUrlOf(env, request.code),
        expiresAt: request.expiresAt,
      },
      428,
    );
  }

  const teams = (await teamsClaim(env.AUTH_DB, ownerId)).map((t) => t.id);
  const ceiling: WorkbenchLevel | undefined = token.readOnly ? 'view' : undefined;
  const base = appBaseUrl(env, app);
  let reach: WorkbenchReach;
  let level: WorkbenchLevel;
  if (asked.scope === 'workspace') {
    if (asked.folderId !== null) {
      const reaches = await ownerReachesFolder(env, {
        app,
        personId: ownerId,
        teams,
        folderId: asked.folderId,
      });
      if (reaches === 'unavailable')
        return refused('index', asked.scope, fail(503, 'index_unavailable'));
      if (!reaches) return refused('not_found', asked.scope, notFound());
    }
    reach = { scope: 'workspace', itemId: null, folderId: asked.folderId };
    level = capLevel('edit', ceiling);
  } else {
    const access = await ownerItemAccess(env, {
      app,
      noun: dialect.noun,
      personId: ownerId,
      teams,
      itemId: asked.itemId,
    });
    if (!access.ok) return refused('access', asked.scope, fail(access.status, access.error));
    reach = { scope: 'item', itemId: asked.itemId, folderId: null };
    level = capLevel(access.level, ceiling);
  }

  const tabId = asked.scope === 'item' ? asked.tabId : null;
  const minted = await store.mintTicket({
    personId: ownerId,
    pairingId: pairing.id,
    reach,
    tabId,
    role: level,
    now,
    expiresAt: now + WORKBENCH_TICKET_TTL_MS,
  });
  // Unpaired between the two reads: ask again.
  if (!minted) return refused('unpaired', asked.scope, fail(409, 'pairing_changed'));
  console.info('[workbench] ticket-minted', {
    app,
    scope: reach.scope,
    itemId: reach.itemId,
    folderId: reach.folderId,
    tokenId: token.tokenId,
    role: level,
  });
  if (reach.scope === 'workspace') {
    const folderPath =
      reach.folderId === null ? '' : `/folder/${encodeURIComponent(reach.folderId)}`;
    return json(
      {
        url: `${base}/embed/workbench/explorer${folderPath}#ticket=${minted.ticket}`,
        scope: 'workspace',
        folderId: reach.folderId,
        expiresAt: minted.expiresAt,
      },
      201,
    );
  }
  return json(
    {
      url: `${base}/embed/workbench?d=${encodeURIComponent(reach.itemId)}#ticket=${minted.ticket}`,
      [dialect.idField]: reach.itemId,
      tabId,
      expiresAt: minted.expiresAt,
    },
    201,
  );
}

// ---------- Sessions ---------------------------------------------------------------------------------------------

const invalidTicket = (reason: 'unknown' | 'used' | 'expired') => {
  console.warn('[workbench] session-refused', { reason });
  return json({ error: 'invalid_ticket', reason }, 401);
};

export async function redeemTicket(ctx: WorkbenchContext): Promise<Response> {
  if (bearerOf(ctx.request)?.startsWith('lvw_')) return fail(403, 'workbench_confined');
  const body = await readBody(ctx.request);
  if (body instanceof Response) return body;
  const ticket = body.ticket;
  if (typeof ticket !== 'string' || !WORKBENCH_TICKET_PATTERN.test(ticket))
    return badRequest('invalid ticket');
  const app = appOfRequest(ctx.request, body);
  if (!app) return unknownApp();
  const dialect = dialectOf(app);
  const { env, now } = ctx;

  const store = workbenchStoreOfSecret(env.WORKBENCH!, ticket);
  if (!store) return invalidTicket('unknown');
  const consumed = await store.consumeTicket(ticket, app, now);
  if (!consumed.ok) return invalidTicket(consumed.reason);
  const t = consumed.ticket;
  // Its token must still work, and caps the level by its own read-only switch.
  const token = await liveTokenFacts(env.AUTH_DB, t.tokenId, t.ownerId, now);
  if (!token) return invalidTicket('unknown');

  let ceiling = t.role;
  if (t.scope === 'item') {
    const teams = (await teamsClaim(env.AUTH_DB, t.ownerId)).map((team) => team.id);
    const access = await ownerItemAccess(env, {
      app: app as App,
      noun: dialect.noun,
      personId: t.ownerId,
      teams,
      itemId: t.itemId,
    });
    if (!access.ok) {
      console.warn('[workbench] session-refused', {
        reason: 'access',
        scope: t.scope,
        itemId: t.itemId,
        tokenId: t.tokenId,
      });
      return fail(access.status, access.error);
    }
    ceiling = capLevel(t.role, access.level);
  }
  const role = capLevel(ceiling, token.readOnly ? 'view' : undefined);
  const reach: WorkbenchReach =
    t.scope === 'item'
      ? { scope: 'item', itemId: t.itemId, folderId: null }
      : { scope: 'workspace', itemId: null, folderId: t.folderId };
  const expiresAt = Math.min(now + WORKBENCH_SESSION_TTL_MS, token.expiresAt);
  const opened = await store.openSession({
    personId: t.ownerId,
    pairingId: t.pairingId,
    reach,
    tabId: t.tabId,
    role,
    now,
    expiresAt,
  });
  if (!opened) return invalidTicket('unknown');
  const [profile] = await readProfiles(env.AUTH_DB, [t.ownerId]);
  console.info('[workbench] session-opened', {
    app,
    scope: t.scope,
    itemId: t.itemId,
    tokenId: t.tokenId,
    sessionPrefix: sessionPrefixOf(opened.id),
    role,
  });
  const scoped =
    reach.scope === 'item'
      ? { scope: dialect.noun, [dialect.idField]: reach.itemId, folderId: null, tabId: t.tabId }
      : { scope: 'workspace', [dialect.idField]: null, folderId: reach.folderId, tabId: null };
  return json(
    {
      session: opened.secret,
      ...scoped,
      origin: t.origin,
      role,
      expiresAt,
      person: { id: t.ownerId, name: profile?.name ?? null, color: profile?.color ?? null },
    },
    201,
  );
}

// The frame ends its own session: after a renewal swaps in the next one, or when it unbinds.
export async function endCurrentSession(ctx: WorkbenchContext): Promise<Response> {
  const secret = bearerOf(ctx.request);
  if (!secret || !WORKBENCH_SESSION_PATTERN.test(secret))
    return fail(403, 'not_a_workbench_session');
  const store = workbenchStoreOfSecret(ctx.env.WORKBENCH!, secret);
  const session = store ? await store.readSession(secret) : null;
  if (!store || !session) return fail(401, 'invalid_session', { reason: 'unknown' });
  await store.endSession(session.id);
  console.info('[workbench] session-ended', {
    reason: 'ended',
    app: session.app,
    scope: session.scope,
    itemId: session.itemId,
    tokenId: session.tokenId,
    sessionPrefix: sessionPrefixOf(session.id),
  });
  return noContent();
}
