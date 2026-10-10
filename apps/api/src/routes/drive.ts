// /api/drive/* — the Google Drive mirror's token broker and bookkeeping
// (docs/specs/022-drive-mirror/drive-mirror.md; blueprint "Routes").
//
// The mirror itself runs in the user's browser, straight against Google. The
// worker only brokers tokens (the refresh token never leaves it) and stores a
// few small rows per user. Signed-in only, and only through a Clerk session:
// neither the guest header nor an API token reaches any of this.

import {
  DRIVE_ACCOUNT_SWITCH_TTL_MS,
  DRIVE_ITEM_KINDS,
  DRIVE_ITEMS_PUT_MAX,
  DRIVE_NAME_MAX,
  isDriveFileId,
  isDriveLeaseHolder,
  isLivediagramId,
  type DriveItem,
  type DriveItemKind,
} from '@livediagram/api-schema';
import {
  acquireDriveLease,
  createBrowserConnection,
  deleteDriveItem,
  DriveItemConflictError,
  getDriveConnection,
  getSealedRefreshToken,
  listDriveItems,
  putDriveItems,
  releaseDriveLease,
  setDriveConnectionStatus,
  updateDriveConnectionState,
  upsertBrokerConnection,
} from '../db/drive';
import {
  getDriveAccountId,
  recordDriveAccount,
  setPendingAccountSwitch,
} from '../db/drive-account';
import { cancelAccountSwitch, confirmAccountSwitch } from '../drive/account-switch';
import { driveMode } from '../drive/config';
import { importDriveKey, openRefreshToken, sealRefreshToken } from '../drive/crypto';
import { disconnectDrive } from '../drive/disconnect';
import { fetchGoogleAccountId } from '../drive/google-account';
import { exchangeCode, GoogleOAuthError, refreshAccessToken } from '../drive/google-oauth';
import { isAllowedRedirectUri, signDriveState, verifyDriveState } from '../drive/state';
import { json, noContent, notFound, signInRequired } from '../responses';
import type { RouteContext } from './context';

function driveError(status: number, error: string): Response {
  return json({ error }, { status });
}

const invalidRequest = () => driveError(400, 'invalid_request');
const notConnected = () => driveError(404, 'drive_not_connected');
const brokerUnavailable = () => driveError(503, 'drive_broker_unavailable');

function logOutcome(route: string, outcome: string): void {
  console.log(`drive: ${route} ${outcome}`);
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const isKind = (v: unknown): v is DriveItemKind =>
  typeof v === 'string' && (DRIVE_ITEM_KINDS as readonly string[]).includes(v);
const isName = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= DRIVE_NAME_MAX;
const isNullableId = (v: unknown): v is string | null => v === null || isDriveFileId(v);
const isNullableString = (v: unknown): v is string | null =>
  v === null || (typeof v === 'string' && v.length > 0 && v.length <= DRIVE_NAME_MAX);
const isNullableTime = (v: unknown): v is number | null =>
  v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

// One item off the wire, fully checked, or null.
function parseItem(raw: unknown): DriveItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    !isKind(r.kind) ||
    !isLivediagramId(r.ldId) ||
    !isDriveFileId(r.driveFileId) ||
    !isName(r.name) ||
    !isName(r.ldName) ||
    !isNullableId(r.parentId) ||
    typeof r.trashed !== 'boolean' ||
    !isNullableString(r.md5) ||
    !isNullableString(r.headRevisionId) ||
    !isNullableTime(r.mirroredSavedAt) ||
    !(r.notice === null || r.notice === 'unseen_folder') ||
    !isNullableId(r.noticeParentId)
  ) {
    return null;
  }
  return {
    kind: r.kind,
    ldId: r.ldId,
    driveFileId: r.driveFileId,
    name: r.name,
    ldName: r.ldName,
    parentId: r.parentId,
    trashed: r.trashed,
    md5: r.md5,
    headRevisionId: r.headRevisionId,
    mirroredSavedAt: r.mirroredSavedAt,
    notice: r.notice,
    noticeParentId: r.noticeParentId,
  };
}

// Which Drive route a request names, before any gate runs, so an unknown path
// is a plain 404 whatever the deployment's configuration.
type DriveRoute =
  'state' | 'connect' | 'account-switch' | 'token' | 'connection' | 'items' | 'item' | 'lease';

function matchRoute(segments: string[], method: string): DriveRoute | null {
  if (segments.length === 3) {
    if (segments[2] === 'state' && method === 'POST') return 'state';
    if (segments[2] === 'connect' && method === 'POST') return 'connect';
    if (segments[2] === 'account-switch' && (method === 'POST' || method === 'DELETE')) {
      return 'account-switch';
    }
    if (segments[2] === 'token' && method === 'POST') return 'token';
    if (segments[2] === 'connection' && ['GET', 'PUT', 'DELETE'].includes(method)) {
      return 'connection';
    }
    if (segments[2] === 'items' && (method === 'GET' || method === 'PUT')) return 'items';
    if (segments[2] === 'lease' && (method === 'POST' || method === 'DELETE')) return 'lease';
  }
  if (segments.length === 5 && segments[2] === 'items' && method === 'DELETE') return 'item';
  return null;
}

export async function handleDrive(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  const method = request.method;
  if (segments[1] !== 'drive') return notFound();
  const route = matchRoute(segments, method);
  if (!route) return notFound();
  const mode = driveMode(env);
  if (mode === 'off') return driveError(503, 'drive_not_configured');
  // A Clerk session only: never the unsigned guest header, and never an API
  // token (docs/specs/022-drive-mirror/drive-mirror.md, "Tokens").
  const owner = ctx.clerkUserId;
  if (!owner) return signInRequired();
  const now = Date.now();

  if (route === 'state') {
    if (mode !== 'broker') return brokerUnavailable();
    const body = await readJson(request);
    if (!isAllowedRedirectUri(body?.redirectUri)) {
      return driveError(400, 'invalid_redirect_uri');
    }
    const state = await signDriveState(env.DRIVE_TOKEN_KEY!, owner, body.redirectUri, now);
    return json({ state });
  }

  if (route === 'connect') {
    if (mode !== 'broker') return brokerUnavailable();
    const body = await readJson(request);
    const code = body?.code;
    const stateValue = body?.state;
    if (typeof code !== 'string' || !code || typeof stateValue !== 'string' || !stateValue) {
      return invalidRequest();
    }
    const redirectUri = await verifyDriveState(env.DRIVE_TOKEN_KEY!, stateValue, owner, now);
    if (!redirectUri) {
      logOutcome('connect', 'invalid_state');
      return driveError(400, 'invalid_state');
    }
    let refreshToken: string | null;
    let accountId: string;
    try {
      let accessToken: string;
      ({ accessToken, refreshToken } = await exchangeCode(env, code, redirectUri, now));
      // Which Google account consented: a different one than before must not
      // inherit the first account's root folder, page token and items.
      accountId = await fetchGoogleAccountId(env, accessToken);
    } catch (err) {
      logOutcome(
        'connect',
        `exchange_failed ${err instanceof GoogleOAuthError ? err.kind : 'error'}`,
      );
      return driveError(502, 'drive_exchange_failed');
    }
    const recorded = await getDriveAccountId(env, owner);
    const otherAccount = recorded !== null && recorded !== accountId;
    if (!refreshToken) {
      // Google sends a refresh token only on the first consent (or with
      // prompt=consent). Without one and nothing stored, the broker cannot
      // mint tokens later, so the connection would be hollow. A stored one
      // from another Google account would mint tokens for the wrong account.
      if (!(await getSealedRefreshToken(env, owner))) {
        logOutcome('connect', 'no_refresh_token');
        return driveError(502, 'drive_no_refresh_token');
      }
      if (otherAccount) {
        logOutcome('connect', 'no_refresh_token account_changed');
        return driveError(502, 'drive_no_refresh_token');
      }
    }
    const key = (await importDriveKey(env.DRIVE_TOKEN_KEY))!;
    if (otherAccount) {
      // Another Google account: nothing changes until the owner confirms the
      // switch (POST /drive/account-switch) or cancels it.
      await setPendingAccountSwitch(
        env,
        owner,
        await sealRefreshToken(key, owner, refreshToken!),
        accountId,
        now + DRIVE_ACCOUNT_SWITCH_TTL_MS,
      );
      logOutcome('connect', 'account_switch_pending');
      return json({ connection: await getDriveConnection(env, owner, now) });
    }
    if (refreshToken) {
      await upsertBrokerConnection(
        env,
        owner,
        await sealRefreshToken(key, owner, refreshToken),
        now,
      );
    }
    await recordDriveAccount(env, owner, accountId);
    await setDriveConnectionStatus(env, owner, 'connected');
    logOutcome('connect', 'ok');
    return json({ connection: await getDriveConnection(env, owner) });
  }

  if (route === 'account-switch') {
    if (mode !== 'broker') return brokerUnavailable();
    if (method === 'DELETE') {
      logOutcome('account-switch', (await cancelAccountSwitch(env, owner)) ? 'cancelled' : 'none');
      return noContent();
    }
    if (!(await confirmAccountSwitch(env, owner, now))) {
      logOutcome('account-switch', 'expired');
      return driveError(409, 'drive_account_switch_expired');
    }
    logOutcome('account-switch', 'confirmed');
    return json({ connection: await getDriveConnection(env, owner, now) });
  }

  if (route === 'token') {
    if (mode !== 'broker') return brokerUnavailable();
    // Its own bound: a token is good for an hour, so a browser needs about one
    // an hour; anything near the limit is a loop, and each call reaches Google.
    if (
      env.DRIVE_TOKEN_RATE_LIMITER &&
      !(await env.DRIVE_TOKEN_RATE_LIMITER.limit({ key: owner })).success
    ) {
      logOutcome('token', 'rate_limited');
      return driveError(429, 'drive_token_rate_limited');
    }
    const connection = await getDriveConnection(env, owner);
    const sealed = await getSealedRefreshToken(env, owner);
    if (!connection || !sealed) return notConnected();
    // Already known to be dead: say so without asking Google again.
    if (connection.status === 'needs_reconnect') return driveError(409, 'drive_needs_reconnect');
    const key = (await importDriveKey(env.DRIVE_TOKEN_KEY))!;
    const refreshToken = await openRefreshToken(key, owner, sealed);
    if (!refreshToken) {
      // The key changed since the token was sealed: only a new consent helps.
      await setDriveConnectionStatus(env, owner, 'needs_reconnect');
      logOutcome('token', 'unreadable');
      return driveError(409, 'drive_needs_reconnect');
    }
    try {
      const token = await refreshAccessToken(env, refreshToken, now);
      logOutcome('token', 'ok');
      return json(token);
    } catch (err) {
      if (err instanceof GoogleOAuthError && err.kind === 'invalid_grant') {
        await setDriveConnectionStatus(env, owner, 'needs_reconnect');
        logOutcome('token', 'invalid_grant');
        return driveError(409, 'drive_needs_reconnect');
      }
      logOutcome('token', 'refresh_failed');
      return driveError(502, 'drive_refresh_failed');
    }
  }

  if (route === 'connection') {
    if (method === 'GET') return json({ connection: await getDriveConnection(env, owner) });
    if (method === 'DELETE') {
      const { revoked } = await disconnectDrive(env, owner);
      logOutcome('disconnect', revoked ? 'revoked' : 'rows_only');
      return noContent();
    }
    if (method === 'PUT') {
      const body = await readJson(request);
      if (!body) return invalidRequest();
      const { rootFolderId, pageToken } = body;
      if (rootFolderId !== undefined && !isNullableId(rootFolderId)) return invalidRequest();
      if (pageToken !== undefined && !(typeof pageToken === 'string' && isName(pageToken))) {
        return invalidRequest();
      }
      if (!(await getDriveConnection(env, owner))) {
        if (mode !== 'browser') return notConnected();
        await createBrowserConnection(env, owner, now);
        logOutcome('connection', 'browser_created');
      }
      await updateDriveConnectionState(
        env,
        owner,
        {
          ...(rootFolderId !== undefined ? { rootFolderId } : {}),
          ...(pageToken !== undefined ? { pageToken } : {}),
        },
        now,
      );
      return json({ connection: await getDriveConnection(env, owner) });
    }
  }

  if (route === 'items') {
    if (method === 'GET') {
      return json({ items: await listDriveItems(env, owner) });
    }
    if (method === 'PUT') {
      const body = await readJson(request);
      const raw = body?.items;
      if (!Array.isArray(raw) || raw.length === 0 || raw.length > DRIVE_ITEMS_PUT_MAX) {
        return invalidRequest();
      }
      const items = raw.map(parseItem);
      if (items.some((i) => i === null)) return invalidRequest();
      if (!(await getDriveConnection(env, owner))) return notConnected();
      try {
        await putDriveItems(env, owner, items as DriveItem[]);
      } catch (err) {
        if (err instanceof DriveItemConflictError) {
          logOutcome('items', 'conflict');
          return driveError(409, 'drive_item_conflict');
        }
        throw err;
      }
      return json({ items });
    }
  }

  if (route === 'item') {
    const itemKind = segments[3];
    const ldId = segments[4];
    if (!isKind(itemKind) || !isLivediagramId(ldId)) return invalidRequest();
    await deleteDriveItem(env, owner, itemKind, ldId);
    return noContent();
  }

  if (route === 'lease') {
    if (method === 'POST') {
      const body = await readJson(request);
      if (!isDriveLeaseHolder(body?.holder)) return invalidRequest();
      const lease = await acquireDriveLease(env, owner, body.holder, now);
      if (!lease) return notConnected();
      if (!lease.acquired) logOutcome('lease', 'held_elsewhere');
      return json(lease);
    }
    if (method === 'DELETE') {
      const holder = ctx.url.searchParams.get('holder');
      if (!isDriveLeaseHolder(holder)) return invalidRequest();
      await releaseDriveLease(env, owner, holder);
      return noContent();
    }
  }

  return notFound();
}
