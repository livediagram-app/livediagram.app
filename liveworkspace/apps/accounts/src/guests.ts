// Guests: one identity across every app (liveworkspace/docs/one-explorer-contracts.md "Guests").
// An app sends the browser to GET /api/auth/guest; this Worker keeps the guest's id in its own
// long-lived `lw_guest` cookie and hands the app a guest token in the redirect's fragment. When
// someone signs in with that cookie, the guest's settings move to the account and the index is told
// to move the guest's things too.
import type { GenericEndpointContext } from 'better-auth';
import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { GUEST_ID } from './ids.ts';
import { mergeGuestSettings } from './settings.ts';

export const GUEST_PATH = '/guest';
export const GUEST_COOKIE = 'lw_guest';
export const GUEST_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;
// Browsers cap a cookie's life (Chrome at 400 days), so the cookie is set again on every hand-off
// and only lapses after that long without one.
const COOKIE_MAX_AGE_SECONDS = 10 * 365 * 24 * 60 * 60;
const STATE_MAX_LENGTH = 200;
const MERGE_TIMEOUT_MS = 5_000;

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// `guest_<uuid>.<HMAC>`: the signature keeps anyone from claiming another guest's id (and with
// it, at sign-up, their items). Prefixed so this MAC can't stand in for any other use of the secret.
export async function signGuestCookie(guestId: string, secret: string): Promise<string> {
  const mac = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(`${GUEST_COOKIE}:${guestId}`),
  );
  return `${guestId}.${base64url(mac)}`;
}

// The guest id a cookie value carries, or null when it is missing, malformed or not ours.
export async function readGuestCookie(
  value: string | null | undefined,
  secret: string,
): Promise<string | null> {
  const dot = value?.lastIndexOf('.') ?? -1;
  if (!value || dot < 0) return null;
  const guestId = value.slice(0, dot);
  const mac = fromBase64url(value.slice(dot + 1));
  if (!GUEST_ID.test(guestId) || !mac) return null;
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    mac,
    encoder.encode(`${GUEST_COOKIE}:${guestId}`),
  );
  return valid ? guestId : null;
}

function cookieValue(header: string | null, name: string): string | null {
  for (const part of header?.split(';') ?? []) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function guestCookie(value: string, maxAge: number, secure: boolean): string {
  return `${GUEST_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

type Client = { redirectUris: string[]; resources: string[] };

// Straight from the OAuth provider's tables, as registered (clients.ts).
async function findClient(db: D1Database, clientId: string): Promise<Client | null> {
  const [client, resources] = await db.batch<{ redirectUris?: string; resourceId?: string }>([
    db
      .prepare(
        'SELECT redirectUris FROM oauthClient WHERE clientId = ? AND (disabled IS NULL OR disabled = 0)',
      )
      .bind(clientId),
    db.prepare('SELECT resourceId FROM oauthClientResource WHERE clientId = ?').bind(clientId),
  ]);
  const row = client?.results[0];
  if (!row?.redirectUris) return null;
  let redirectUris: unknown;
  try {
    redirectUris = JSON.parse(row.redirectUris);
  } catch {
    return null;
  }
  return {
    redirectUris: Array.isArray(redirectUris)
      ? redirectUris.filter((uri): uri is string => typeof uri === 'string')
      : [],
    resources: (resources?.results ?? []).flatMap((r) => (r.resourceId ? [r.resourceId] : [])),
  };
}

const refuse = (error: string) =>
  Response.json({ error }, { status: 400, headers: { 'cache-control': 'no-store' } });

// GET /api/auth/guest?client_id=&redirect_uri=&state=[&resource=]. Never redirects anywhere but
// one of the client's registered URIs, matched exactly; anything wrong is a 400 instead.
export async function guestHandoff(request: Request, env: Env, auth: Auth): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const state = params.get('state') ?? '';

  const client = clientId ? await findClient(env.AUTH_DB, clientId) : null;
  if (!client || client.resources.length === 0) return refuse('invalid_client');
  if (!client.redirectUris.includes(redirectUri)) return refuse('invalid_redirect_uri');
  if (!state || state.length > STATE_MAX_LENGTH) return refuse('invalid_state');

  // A client with one API gets that one; a client with several names which.
  const resource =
    params.get('resource') ?? (client.resources.length === 1 ? client.resources[0] : null);
  if (!resource || !client.resources.includes(resource)) return refuse('invalid_resource');

  const secret = env.BETTER_AUTH_SECRET;
  const guestId =
    (await readGuestCookie(cookieValue(request.headers.get('cookie'), GUEST_COOKIE), secret)) ??
    `guest_${crypto.randomUUID()}`;

  const now = Math.floor(Date.now() / 1000);
  // The jwt plugin's own signer, so the token is signed with the keys at /api/auth/jwks and
  // apps check it exactly as they check access tokens.
  const { token } = await auth.api.signJWT({
    body: {
      payload: {
        iss: `${env.BASE_URL}${AUTH_BASE_PATH}`,
        aud: resource,
        sub: guestId,
        kind: 'guest',
        iat: now,
        exp: now + GUEST_TOKEN_TTL_SECONDS,
      },
    },
  });

  const fragment = new URLSearchParams({ guest_token: token, state });
  const headers = new Headers({
    location: `${redirectUri}#${fragment}`,
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  });
  headers.append(
    'set-cookie',
    guestCookie(
      await signGuestCookie(guestId, secret),
      COOKIE_MAX_AGE_SECONDS,
      env.ENVIRONMENT !== 'development',
    ),
  );
  return new Response(null, { status: 302, headers });
}

export interface MergeConfig {
  secret: string;
  secure: boolean;
  indexUrl?: string;
  // The index Worker's service binding; plain fetch to indexUrl without one (tests, other hosts).
  indexService?: Fetcher;
  indexMergeKey?: string;
  // The accounts database, where the guest's settings move to the account (settings.ts).
  db?: D1Database;
}

let warnedUnconfigured = false;

// Better Auth's session.create.after hook: a session made by a request carrying a valid guest
// cookie asks the index to hand the guest's things to the account, then clears the cookie so the
// next guest visit starts a fresh guest. A failed merge never fails the sign-in.
export async function mergeGuestOnSignIn(
  config: MergeConfig,
  userId: string,
  ctx: GenericEndpointContext | null,
): Promise<void> {
  const header = ctx?.request?.headers.get('cookie') ?? ctx?.headers?.get('cookie') ?? null;
  const guestId = await readGuestCookie(cookieValue(header, GUEST_COOKIE), config.secret);
  if (!ctx || !guestId) return;
  // Settings live here, not in the index, so they move whatever the index says. Idempotent, and a
  // failure is only logged: the guest's rows stay for the next sign-in to try again.
  if (config.db) {
    await mergeGuestSettings(config.db, guestId, userId).catch((error: unknown) =>
      console.error('Guest settings merge failed:', error),
    );
  }
  if (!config.indexUrl || !config.indexMergeKey) {
    // Without an index to tell, the cookie stays, so the guest isn't lost before it is set up.
    if (!warnedUnconfigured)
      console.warn('Guest merge skipped: INDEX_URL or INDEX_MERGE_KEY unset');
    warnedUnconfigured = true;
    return;
  }

  // Awaited, so the cookie is cleared only once the index has the guest's things: a merge that
  // fails keeps the cookie, and the next sign-in tries again (the merge is idempotent). It adds one
  // request to signing in, capped at MERGE_TIMEOUT_MS.
  const send = config.indexService ? config.indexService.fetch.bind(config.indexService) : fetch;
  const merged = await send(`${config.indexUrl}/internal/merge`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.indexMergeKey}`,
    },
    body: JSON.stringify({ guestId, userId }),
    signal: AbortSignal.timeout(MERGE_TIMEOUT_MS),
  }).then(
    (response) => {
      if (!response.ok) console.error(`Guest merge failed: ${response.status}`);
      return response.ok;
    },
    (error: unknown) => {
      console.error('Guest merge failed:', error);
      return false;
    },
  );
  if (!merged) return;

  // Appended beside the session cookie, not in place of it.
  ctx.setCookie(GUEST_COOKIE, '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secure,
  });
}
