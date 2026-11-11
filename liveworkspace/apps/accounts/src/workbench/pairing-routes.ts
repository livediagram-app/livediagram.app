// The workbench's pairing (./routes): opening a pairing, polling, reading and answering it, listing the account's
// pairings and unpairing.
import { appOfRequest, dialectOf, scopeOfWire, wireScope } from './apps.ts';
import { closeRooms } from './index-access.ts';
import { pairingCovers, workbenchStoreOf } from './store.ts';
import {
  WORKBENCH_POLL_INTERVAL_S,
  type WorkbenchContext,
  apiTokenOf,
  fail,
  invalidValue,
  json,
  limited,
  noContent,
  normaliseWorkbenchName,
  notFound,
  pairingUrlOf,
  pairingView,
  parseWorkbenchOrigin,
  rateLimited,
  readBody,
  signInRequired,
  signedInAccount,
  tokenRequired,
  unknownApp,
} from './route-kit.ts';

// ---------- Pairing ----------------------------------------------------------------------------------------------

// `workbench pair` asks, by token, for one scope (absent: the item scope).
export async function openPairing(ctx: WorkbenchContext): Promise<Response> {
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
  console.info('[workbench] pairing-requested', {
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
export async function pollPairing(ctx: WorkbenchContext, code: string): Promise<Response> {
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
export async function readPairing(ctx: WorkbenchContext, code: string): Promise<Response> {
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
export async function answerPairing(
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
      console.info('[workbench] pairing-declined', {
        tokenId: result.tokenId,
        scope: result.asked,
      });
      return noContent();
    case 'approved': {
      console.info('[workbench] paired', {
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
export async function listPairings(ctx: WorkbenchContext): Promise<Response> {
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
export async function unpair(ctx: WorkbenchContext, id: string): Promise<Response> {
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
      `SELECT id FROM api_token WHERE userId = ? AND id IN (SELECT value FROM json_each(?))
         AND revokedAt IS NULL AND expiresAt > ?`,
    )
    .bind(userId, JSON.stringify(ids), now)
    .all<{ id: string }>();
  return new Set(results.map((r) => r.id));
}
