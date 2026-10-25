// The apps' servers' doors into the workbench service (liveworkspace/docs/workbench.md "The handoff"), under
// /api/account/internal with their client credentials, each for the client's own app only:
//
//   POST workbench/session {session}                      a `lvw_` session as this app may use it, or 404 {reason}
//   POST workbench/rooms   {ownerId, sessionId, itemId}    a workspace session joined an item's room
//   POST allowance         {personId, kind, max, windowMs, count}  take from a sender's allowance; answers {taken}

import { appOfSite, type SiteId } from '@liveworkspace/sites';
import { GUEST_ID, USER_ID } from '../ids.ts';
import type { Env } from '../env.ts';
import { teamsClaim } from '../teams.ts';
import { liveTokenFacts } from './revoke.ts';
import {
  WORKBENCH_QUOTA_MAX,
  WORKBENCH_SESSION_PATTERN,
  workbenchStoreOf,
  workbenchStoreOfSecret,
} from './store.ts';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const error = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  json({ error: code, ...extra }, status);
const refused = (reason: 'unknown' | 'revoked' | 'expired') =>
  error(404, 'invalid_session', { reason });

const ID_MAX = 64;
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= ID_MAX;
// An allowance's kind: a short word of the app's own.
const KIND = /^[a-z][a-z0-9-]{0,39}$/;

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => ({}));
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

// Null for a route that isn't one of these.
export async function handleWorkbenchInternal(
  request: Request,
  env: Env,
  // The client's app as accounts records it: its site (`liveplanner.app`).
  clientSite: string | null,
  route: string,
  now = Date.now(),
): Promise<Response | null> {
  if (
    route !== 'POST workbench/session' &&
    route !== 'POST workbench/rooms' &&
    route !== 'POST allowance'
  )
    return null;
  const app = clientSite ? appOfSite(clientSite as SiteId) : null;
  if (!app) return error(403, 'client_has_no_app');
  const ns = env.WORKBENCH;
  if (!ns) return error(503, 'workbench_unavailable');
  const body = await readBody(request);

  // A session as the app's API checks it: the store's row, its token still live (and its read-only switch), and the
  // account's teams now. Another app's session is unknown here, as a forged one is.
  if (route === 'POST workbench/session') {
    const secret = body.session;
    if (typeof secret !== 'string' || !WORKBENCH_SESSION_PATTERN.test(secret))
      return refused('unknown');
    const store = workbenchStoreOfSecret(ns, secret);
    const session = store ? await store.readSession(secret) : null;
    if (!session || session.app !== app) return refused('unknown');
    const [token, teams] = await Promise.all([
      liveTokenFacts(env.AUTH_DB, session.tokenId, session.ownerId, now),
      teamsClaim(env.AUTH_DB, session.ownerId),
    ]);
    if (!token) return refused('revoked');
    if (session.expiresAt <= now) return refused('expired');
    return json({
      sessionId: session.id,
      ownerId: session.ownerId,
      tokenId: session.tokenId,
      pairingId: session.pairingId,
      scope: session.scope,
      itemId: session.itemId,
      folderId: session.folderId,
      tabId: session.tabId,
      origin: session.origin,
      level: token.readOnly ? 'view' : session.role,
      expiresAt: Math.min(session.expiresAt, token.expiresAt),
      teams,
    });
  }

  if (route === 'POST workbench/rooms') {
    const { ownerId, sessionId, itemId } = body;
    if (typeof ownerId !== 'string' || !USER_ID.test(ownerId)) return error(400, 'invalid_owner');
    if (!isId(sessionId) || !isId(itemId)) return error(400, 'invalid_value');
    const noted = await workbenchStoreOf(ns, ownerId).noteSessionRoom(sessionId, app, itemId);
    return noted ? new Response(null, { status: 204 }) : error(404, 'not_found');
  }

  // The sender's allowance, kept per app in their store: `<app>:<kind>`.
  const { personId, kind, max, windowMs, count } = body;
  if (typeof personId !== 'string' || !(USER_ID.test(personId) || GUEST_ID.test(personId)))
    return error(400, 'invalid_person');
  if (typeof kind !== 'string' || !KIND.test(kind)) return error(400, 'invalid_kind');
  if (
    typeof max !== 'number' ||
    !Number.isInteger(max) ||
    max < 1 ||
    max > WORKBENCH_QUOTA_MAX ||
    typeof windowMs !== 'number' ||
    !(windowMs > 0) ||
    windowMs > 7 * 24 * 60 * 60 * 1000
  )
    return error(400, 'invalid_allowance');
  const uses = count === undefined ? 1 : count;
  if (typeof uses !== 'number' || !Number.isInteger(uses) || uses < 1 || uses > WORKBENCH_QUOTA_MAX)
    return error(400, 'invalid_count');
  const taken = await workbenchStoreOf(ns, personId).takeQuota({
    personId,
    kind: `${app}:${kind}`,
    max,
    windowMs,
    now,
    count: uses,
  });
  return json({ taken });
}
