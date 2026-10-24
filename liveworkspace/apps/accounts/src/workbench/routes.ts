// /api/account/workbench/* (liveworkspace/docs/workbench.md "Addresses"): every app's workbench pairing, tickets
// and sessions. Each app's address keeps `/api/workbench/*` and forwards it here with its name, so the requests and
// answers are the app's own (apps.ts holds its words).
//
//   POST   tickets                          an API token: a ticket, or 428 pairing_required with the pairing URL
//   POST   sessions                         the ticket is the credential: a session
//   DELETE sessions/current                 a session ends itself
//   POST   pairing-requests                 an API token asks to pair (or is paired already)
//   GET    pairing-requests/:code/status    the token that asked waits
//   GET    pairing-requests/:code           the token's owner, signed in: the pairing page's question
//   POST   pairing-requests/:code/approve   …and its answer, once
//   POST   pairing-requests/:code/decline
//   GET    pairings                         the owner, signed in: Settings > API tokens
//   DELETE pairings/:id                     …and Unpair
//
// "Signed in" is liveworkspace.app's session cookie (same-origin writes only) or an account's access token for one of
// the apps. A token, a session or a guest never answers a pairing or unpairs.

import type { App } from '@liveworkspace/index-client';
import type { Auth } from '../auth.ts';
import { bearerOf, bearerPerson } from '../bearer.ts';
import type { Env } from '../env.ts';
import { readProfiles } from '../profiles.ts';
import { teamsClaim } from '../teams.ts';
import { verifyApiToken, type VerifiedToken } from '../tokens.ts';
import {
  appBaseUrl,
  appOfRequest,
  dialectOf,
  scopeOfWire,
  wireScope,
  type Dialect,
} from './apps.ts';
import { closeRooms, ownerItemAccess, ownerReachesFolder } from './index-access.ts';
import { liveTokenFacts } from './revoke.ts';
import {
  pairingCovers,
  sessionPrefixOf,
  WORKBENCH_CODE_PATTERN,
  WORKBENCH_SESSION_PATTERN,
  WORKBENCH_TICKET_PATTERN,
  workbenchStoreOf,
  workbenchStoreOfSecret,
  type WorkbenchLevel,
  type WorkbenchPairingRow,
  type WorkbenchReach,
} from './store.ts';

// ---------- Constants (each app's docs/specs/013-workspace/blueprints/workbench-embeds.md) ---------------------

export const WORKBENCH_TICKET_TTL_MS = 60_000;
export const WORKBENCH_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const WORKBENCH_TICKETS_PER_MINUTE = 30;
export const WORKBENCH_NAME_MAX_LENGTH = 40;
export const WORKBENCH_ORIGIN_MAX_LENGTH = 255;
// How often the waiting CLI asks again, in seconds (the device flow's).
export const WORKBENCH_POLL_INTERVAL_S = 5;
const ID_MAX = 64;

// ---------- Answers ----------------------------------------------------------------------------------------------

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  json({ error, ...extra }, status);
const noContent = () =>
  new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
const badRequest = (message: string) => fail(400, 'bad_request', { message });
const invalidValue = (message: string) => fail(400, 'invalid_value', { message });
const notFound = () => fail(404, 'not_found');
const signInRequired = () => fail(401, 'sign_in_required');
const tokenRequired = () => fail(403, 'token_required');
const rateLimited = () => fail(429, 'rate_limited');
const unknownApp = () => fail(400, 'invalid_value', { message: 'name the app' });

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= ID_MAX;

const LEVELS: readonly WorkbenchLevel[] = ['view', 'participate', 'edit'];
// The lower of two levels; no ceiling gives the level.
export const capLevel = (level: WorkbenchLevel, ceiling?: WorkbenchLevel): WorkbenchLevel =>
  ceiling && LEVELS.indexOf(ceiling) < LEVELS.indexOf(level) ? ceiling : level;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Exactly `scheme://host[:port]`: https anywhere, http on a loopback host only, as the browser reports an origin.
export function parseWorkbenchOrigin(input: unknown): string | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > WORKBENCH_ORIGIN_MAX_LENGTH)
    return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const schemeOk =
    url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
  if (!schemeOk || url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== '/' || input.endsWith('/') || input !== url.origin) return null;
  return input;
}

// The workbench's name (shown, never enforced): trimmed, 1 to WORKBENCH_NAME_MAX_LENGTH characters.
export function normaliseWorkbenchName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= WORKBENCH_NAME_MAX_LENGTH ? trimmed : null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : badRequest('expected a JSON object');
  } catch {
    return badRequest('invalid json');
  }
}

// A pairing as the app's wire has always shown it, with its app for liveworkspace.app's list of every app's.
const pairingView = (dialect: Dialect, p: WorkbenchPairingRow) => ({
  id: p.id,
  tokenId: p.tokenId,
  origin: p.origin,
  name: p.name,
  scope: wireScope(dialect, p.scope),
  pairedAt: p.pairedAt,
  app: p.app,
});

const pairingUrlOf = (env: Env, code: string) => `${env.BASE_URL}/workbench/pair?code=${code}`;

// ---------- Who is asking -----------------------------------------------------------------------------------------

export type WorkbenchContext = {
  request: Request;
  env: Env;
  auth: Auth;
  waitUntil: (promise: Promise<unknown>) => void;
  now: number;
};

// The API token a request presents, checked in accounts' own table (one indexed read).
async function apiTokenOf(ctx: WorkbenchContext): Promise<VerifiedToken | null> {
  const bearer = bearerOf(ctx.request);
  if (!bearer?.startsWith('lwt_')) return null;
  return verifyApiToken(ctx.env.AUTH_DB, bearer, ctx.now);
}

// The account signed in: the site's session cookie (a write from the site itself only), or an account's access
// token for one of the apps (what an app's Settings sends). Never an API token or a workbench session.
async function signedInAccount(ctx: WorkbenchContext): Promise<string | null> {
  const bearer = bearerOf(ctx.request);
  if (bearer) {
    if (bearer.startsWith('lwt_') || bearer.startsWith('lvw_')) return null;
    const person = await bearerPerson(bearer, ctx.env, ctx.auth, ctx.now);
    return person?.kind === 'account' ? person.userId : null;
  }
  const site = new URL(ctx.env.BASE_URL).origin;
  if (ctx.request.method !== 'GET' && ctx.request.headers.get('origin') !== site) return null;
  const session = await ctx.auth.api.getSession({ headers: ctx.request.headers }).catch(() => null);
  return session?.user.id ?? null;
}

// The mint and the pairing request share one bucket per token.
async function limited(ctx: WorkbenchContext, tokenId: string): Promise<boolean> {
  const limiter = ctx.env.WORKBENCH_LIMITER;
  if (!limiter) return false;
  return !(await limiter.limit({ key: `workbench-ticket:${tokenId}` })).success;
}

// ---------- Routing ---------------------------------------------------------------------------------------------

export async function handleWorkbench(ctx: WorkbenchContext, parts: string[]): Promise<Response> {
  if (!ctx.env.WORKBENCH) return fail(503, 'workbench_unavailable');
  const method = ctx.request.method;
  const [section, code, action] = parts;
  const wrong = () => fail(405, 'method_not_allowed');

  if (section === 'tickets' && parts.length === 1)
    return method === 'POST' ? mintTicket(ctx) : wrong();
  if (section === 'sessions' && parts.length === 1)
    return method === 'POST' ? redeemTicket(ctx) : wrong();
  if (section === 'sessions' && code === 'current' && parts.length === 2)
    return method === 'DELETE' ? endCurrentSession(ctx) : wrong();

  if (section === 'pairing-requests') {
    if (parts.length === 1) return method === 'POST' ? openPairing(ctx) : wrong();
    if (!code || !WORKBENCH_CODE_PATTERN.test(code)) return notFound();
    if (parts.length === 2) return method === 'GET' ? readPairing(ctx, code) : wrong();
    if (parts.length === 3 && action === 'status')
      return method === 'GET' ? pollPairing(ctx, code) : wrong();
    if (parts.length === 3 && (action === 'approve' || action === 'decline'))
      return method === 'POST' ? answerPairing(ctx, code, action) : wrong();
  }

  if (section === 'pairings' && parts.length === 1)
    return method === 'GET' ? listPairings(ctx) : wrong();
  if (section === 'pairings' && code && parts.length === 2)
    return method === 'DELETE' ? unpair(ctx, code) : wrong();
  return notFound();
}

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

async function mintTicket(ctx: WorkbenchContext): Promise<Response> {
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
    console.log('[workbench] pairing-requested', {
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
  console.log('[workbench] ticket-minted', {
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

async function redeemTicket(ctx: WorkbenchContext): Promise<Response> {
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
  console.log('[workbench] session-opened', {
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
async function endCurrentSession(ctx: WorkbenchContext): Promise<Response> {
  const secret = bearerOf(ctx.request);
  if (!secret || !WORKBENCH_SESSION_PATTERN.test(secret))
    return fail(403, 'not_a_workbench_session');
  const store = workbenchStoreOfSecret(ctx.env.WORKBENCH!, secret);
  const session = store ? await store.readSession(secret) : null;
  if (!store || !session) return fail(401, 'invalid_session', { reason: 'unknown' });
  await store.endSession(session.id);
  console.log('[workbench] session-ended', {
    reason: 'ended',
    app: session.app,
    scope: session.scope,
    itemId: session.itemId,
    tokenId: session.tokenId,
    sessionPrefix: sessionPrefixOf(session.id),
  });
  return noContent();
}

// ---------- Pairing ----------------------------------------------------------------------------------------------

// `workbench pair` asks, by token, for one scope (absent: the item scope).
async function openPairing(ctx: WorkbenchContext): Promise<Response> {
  const token = await apiTokenOf(ctx);
  if (!token) return tokenRequired();
  if (await limited(ctx, token.tokenId)) return rateLimited();
  const body = await readBody(ctx.request);
  if (body instanceof Response) return body;
  const app = appOfRequest(ctx.request, body);
  if (!app) return unknownApp();
  const dialect = dialectOf(app);
  const origin = parseWorkbenchOrigin(body.origin);
  if (!origin) return fail(400, 'invalid_origin');
  const scope = scopeOfWire(dialect, body.scope);
  if (!scope) return invalidValue('invalid scope');

  const store = workbenchStoreOf(ctx.env.WORKBENCH!, token.userId);
  const pairing = await store.findPairing(app, token.tokenId, origin);
  if (pairing && pairingCovers(pairing.scope, scope)) {
    return json({ status: 'paired', pairing: pairingView(dialect, pairing) });
  }
  const request = await store.openPairingRequest({
    personId: token.userId,
    app,
    tokenId: token.tokenId,
    origin,
    scope,
    name: normaliseWorkbenchName(body.name),
    now: ctx.now,
  });
  console.log('[workbench] pairing-requested', {
    app,
    tokenId: token.tokenId,
    originHost: new URL(origin).hostname,
    scope,
    via: 'pair',
    reused: request.reused,
  });
  return json({
    status: 'pending',
    pairingUrl: pairingUrlOf(ctx.env, request.code),
    code: request.code,
    expiresAt: request.expiresAt,
    interval: WORKBENCH_POLL_INTERVAL_S,
  });
}

// The waiting CLI's poll, by the token that asked.
async function pollPairing(ctx: WorkbenchContext, code: string): Promise<Response> {
  const token = await apiTokenOf(ctx);
  if (!token) return tokenRequired();
  const status = await workbenchStoreOf(ctx.env.WORKBENCH!, token.userId).pairingRequestStatus(
    code,
    token.tokenId,
    ctx.now,
  );
  if (!status) return notFound();
  return json({ ...status, interval: WORKBENCH_POLL_INTERVAL_S });
}

// The pairing page's question, for the token's owner: what asks, from where, for which app and scope.
async function readPairing(ctx: WorkbenchContext, code: string): Promise<Response> {
  const userId = await signedInAccount(ctx);
  if (!userId) return signInRequired();
  const request = await workbenchStoreOf(ctx.env.WORKBENCH!, userId).readPairingRequest(
    code,
    ctx.now,
  );
  if (!request) return notFound();
  const app = appOfRequest(ctx.request) ?? request.app;
  if (app !== request.app) return notFound();
  const tokenName = await ctx.env.AUTH_DB.prepare(
    'SELECT name FROM api_token WHERE id = ? AND userId = ?',
  )
    .bind(request.tokenId, userId)
    .first<string>('name');
  return json({
    request: {
      origin: request.origin,
      name: request.name,
      tokenName: tokenName ?? null,
      scope: wireScope(dialectOf(request.app), request.scope),
      expiresAt: request.expiresAt,
      status: request.status,
      app: request.app,
    },
  });
}

// Answered once, by the token's owner.
async function answerPairing(
  ctx: WorkbenchContext,
  code: string,
  answer: 'approve' | 'decline',
): Promise<Response> {
  const userId = await signedInAccount(ctx);
  if (!userId) return signInRequired();
  const store = workbenchStoreOf(ctx.env.WORKBENCH!, userId);
  const asked = appOfRequest(ctx.request);
  if (asked) {
    const request = await store.readPairingRequest(code, ctx.now);
    if (request && request.app !== asked) return notFound();
  }
  const result = await store.answerPairingRequest({ code, answer, now: ctx.now });
  switch (result.outcome) {
    case 'missing':
      return notFound();
    case 'answered':
      return fail(409, 'pairing_answered');
    case 'expired':
      return fail(410, 'pairing_expired');
    case 'declined':
      console.log('[workbench] pairing-declined', { tokenId: result.tokenId, scope: result.asked });
      return noContent();
    case 'approved': {
      console.log('[workbench] paired', {
        app: result.pairing.app,
        tokenId: result.pairing.tokenId,
        pairingId: result.pairing.id,
        scope: result.asked,
      });
      const dialect = dialectOf(result.pairing.app);
      return json({ pairing: pairingView(dialect, result.pairing) });
    }
  }
}

// Settings > API tokens: this app's pairings on its address, every app's on liveworkspace.app, of live tokens only.
// A pairing whose token no longer works is ended as it is found.
async function listPairings(ctx: WorkbenchContext): Promise<Response> {
  const userId = await signedInAccount(ctx);
  if (!userId) return signInRequired();
  const app = appOfRequest(ctx.request);
  const store = workbenchStoreOf(ctx.env.WORKBENCH!, userId);
  const pairings = await store.listPairings(app);
  const tokenIds = [...new Set(pairings.map((p) => p.tokenId))];
  const live = await liveTokenIdsOf(ctx.env.AUTH_DB, userId, tokenIds, ctx.now);
  const dead = tokenIds.filter((id) => !live.has(id));
  if (dead.length > 0) {
    ctx.waitUntil(
      (async () => {
        for (const tokenId of dead) {
          const ended = await store.endAccess({ tokenId }, 'revoked');
          await closeRooms(ctx.env, ended.rooms);
        }
      })().catch((err: unknown) =>
        console.warn('[workbench] dead token cleanup failed', { error: String(err) }),
      ),
    );
  }
  return json({
    pairings: pairings
      .filter((p) => live.has(p.tokenId))
      .map((p) => pairingView(dialectOf(p.app), p)),
  });
}

// Unpair: that pairing goes, its sessions with it, and the rooms they had open close.
async function unpair(ctx: WorkbenchContext, id: string): Promise<Response> {
  const userId = await signedInAccount(ctx);
  if (!userId) return signInRequired();
  const store = workbenchStoreOf(ctx.env.WORKBENCH!, userId);
  const pairing = await store.readPairing(id);
  const app = appOfRequest(ctx.request);
  if (!pairing || (app && pairing.app !== app)) return notFound();
  const ended = await store.endAccess({ pairingId: id }, 'unpaired');
  ctx.waitUntil(closeRooms(ctx.env, ended.rooms));
  return noContent();
}

// Which of an account's tokens still work: one read.
async function liveTokenIdsOf(
  db: D1Database,
  userId: string,
  ids: string[],
  now: number,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { results } = await db
    .prepare(
      `SELECT id FROM api_token WHERE userId = ? AND id IN (${ids.map(() => '?').join(', ')})
         AND revokedAt IS NULL AND expiresAt > ?`,
    )
    .bind(userId, ...ids, now)
    .all<{ id: string }>();
  return new Set(results.map((r) => r.id));
}
