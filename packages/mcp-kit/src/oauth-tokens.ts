// The one MCP's own tokens (liveworkspace/docs/specs/021-mcp/mcp.md "Tokens"; Work Tracker 1447, 1448). A client
// never holds a credential an app's api accepts: it gets a short-lived access token (`lwm_`) for this server's
// resource alone and a refresh token (`lwr_`) rotated on every use. The account token the consent page minted stays
// here, sealed under a key only the client's own tokens derive, so the store alone opens nothing.
//
// Records, each with a KV expiration so nothing outlives its token:
//   mcp-fam:<id>   one sign-in: the current pair's hashes, the account token sealed under the refresh token
//   mcp-at:<hash>  one live access token: its sign-in and the account token sealed under the access token
// A refresh token carries its sign-in's id, so a spent one is caught against the sign-in's record without a record
// of its own.
import { base64ToBytes, bytesToBase64Url, randomBase64Url } from '@liveworkspace/api-kit/bytes';

export const ACCESS_TOKEN_TTL_S = 60 * 60;
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 90;
// When the consent page sent no expiry for the account token: its fixed six months.
export const UPSTREAM_DEFAULT_TTL_S = 60 * 60 * 24 * 180;
// KV refuses an expiry under a minute.
const KV_MIN_TTL_S = 60;

export const ACCESS_PREFIX = 'lwm_';
export const REFRESH_PREFIX = 'lwr_';
const FAMILY_ID_CHARS = 32;
const SECRET_BYTES = 32;
// A client that sends two refreshes at once presents the same token twice: the second, within this, is refused on its
// own; after it, a spent token is a stolen one.
export const REUSE_GRACE_MS = 30 * 1000;

type SignIn = {
  aud: string;
  clientId: string;
  // SHA-256 hex of the current refresh and access tokens.
  refresh: string;
  access: string;
  // The account token, sealed under the current refresh token.
  sealed: string;
  upstreamEndsAt: number;
  refreshEndsAt: number;
  // The refresh token this pair replaced, and when: the same one again within seconds is a client's own two calls at
  // once, refused without ending the sign-in (REUSE_GRACE_MS).
  previous?: string;
  rotatedAt?: number;
};

type Access = {
  aud: string;
  clientId: string;
  family: string;
  // The account token, sealed under this access token.
  sealed: string;
  endsAt: number;
};

export type TokenAnswer = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
};

export type RefreshRefusal = { error: 'invalid_grant'; error_description: string };

const familyKey = (id: string) => `mcp-fam:${id}`;
const accessKey = (hash: string) => `mcp-at:${hash}`;

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** A token's SHA-256 in hex: how the store names it, never the token itself. */
export async function tokenHash(token: string): Promise<string> {
  return hex(await sha256(token));
}

// The seal's key: a different hash of the token than the one the store is keyed by, so a key name opens nothing.
async function sealKey(token: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', await sha256(`lw-seal:${token}`), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function seal(secret: string, token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await sealKey(token),
    new TextEncoder().encode(secret),
  );
  const out = new Uint8Array(iv.length + cipher.byteLength);
  out.set(iv);
  out.set(new Uint8Array(cipher), iv.length);
  return bytesToBase64Url(out);
}

/** The sealed secret, or null when this token can't open it (another token's seal, a damaged record). */
export async function unseal(sealed: string, token: string): Promise<string | null> {
  const bytes = base64ToBytes(sealed);
  if (!bytes || bytes.length < 13) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.subarray(0, 12) },
      await sealKey(token),
      bytes.subarray(12),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

const ttlUntil = (endsAt: number, now: number) =>
  Math.max(KV_MIN_TTL_S, Math.ceil((endsAt - now) / 1000));

/** Whether a Bearer is shaped as this server's access token. */
export function isMcpAccessToken(token: string): boolean {
  return token.startsWith(ACCESS_PREFIX);
}

// The sign-in id inside a refresh token, or null when it isn't one of ours.
function familyOf(refreshToken: string): string | null {
  if (!refreshToken.startsWith(REFRESH_PREFIX)) return null;
  const id = refreshToken.slice(REFRESH_PREFIX.length, REFRESH_PREFIX.length + FAMILY_ID_CHARS);
  if (id.length !== FAMILY_ID_CHARS || !/^[0-9a-f]+$/.test(id)) return null;
  return refreshToken.length > REFRESH_PREFIX.length + FAMILY_ID_CHARS ? id : null;
}

// A new pair for a sign-in, written over its record; the earlier access token stays good until its hour ends.
async function writePair(
  kv: KVNamespace,
  family: string,
  base: Omit<SignIn, 'refresh' | 'access' | 'sealed' | 'refreshEndsAt' | 'previous' | 'rotatedAt'>,
  replaced: string | null,
  upstream: string,
  now: number,
): Promise<TokenAnswer> {
  const access = `${ACCESS_PREFIX}${randomBase64Url(SECRET_BYTES)}`;
  const refresh = `${REFRESH_PREFIX}${family}${randomBase64Url(SECRET_BYTES)}`;
  const accessEndsAt = Math.min(now + ACCESS_TOKEN_TTL_S * 1000, base.upstreamEndsAt);
  const refreshEndsAt = Math.min(now + REFRESH_TOKEN_TTL_S * 1000, base.upstreamEndsAt);
  const [accessHash, refreshHash, accessSealed, refreshSealed] = await Promise.all([
    tokenHash(access),
    tokenHash(refresh),
    seal(upstream, access),
    seal(upstream, refresh),
  ]);
  const record: SignIn = {
    ...base,
    refresh: refreshHash,
    access: accessHash,
    sealed: refreshSealed,
    refreshEndsAt,
    ...(replaced ? { previous: replaced, rotatedAt: now } : {}),
  };
  const accessRecord: Access = {
    aud: base.aud,
    clientId: base.clientId,
    family,
    sealed: accessSealed,
    endsAt: accessEndsAt,
  };
  await Promise.all([
    kv.put(familyKey(family), JSON.stringify(record), {
      expirationTtl: ttlUntil(refreshEndsAt, now),
    }),
    kv.put(accessKey(accessHash), JSON.stringify(accessRecord), {
      expirationTtl: ttlUntil(accessEndsAt, now),
    }),
  ]);
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: Math.max(0, Math.floor((accessEndsAt - now) / 1000)),
    refresh_token: refresh,
  };
}

/** A new sign-in's tokens, for `aud` (this server's `<origin>/mcp`), holding the account token the consent minted. */
export async function issueTokens(
  kv: KVNamespace,
  grant: { aud: string; clientId: string; upstream: string; upstreamEndsAt?: number },
  now = Date.now(),
): Promise<TokenAnswer> {
  const family = hex(crypto.getRandomValues(new Uint8Array(FAMILY_ID_CHARS / 2)));
  const upstreamEndsAt = grant.upstreamEndsAt ?? now + UPSTREAM_DEFAULT_TTL_S * 1000;
  return writePair(
    kv,
    family,
    { aud: grant.aud, clientId: grant.clientId, upstreamEndsAt },
    null,
    grant.upstream,
    now,
  );
}

/** Ends a sign-in: its record and its current access token go, and every earlier access token fails its check. */
export async function revokeSignIn(kv: KVNamespace, family: string): Promise<void> {
  const record = await kv.get<SignIn>(familyKey(family), 'json');
  await Promise.all([
    kv.delete(familyKey(family)),
    record?.access ? kv.delete(accessKey(record.access)) : Promise.resolve(),
  ]);
}

const refusal = (description: string): RefreshRefusal => ({
  error: 'invalid_grant',
  error_description: description,
});

/**
 * The refresh grant: a new pair, the presented refresh token spent. A spent one presented again ends the whole
 * sign-in (OAuth 2.1 §4.3.1, refresh token rotation for public clients); one past its time ends it too.
 */
export async function refreshTokens(
  kv: KVNamespace,
  request: { refreshToken: string; clientId: string },
  now = Date.now(),
): Promise<TokenAnswer | RefreshRefusal> {
  const family = familyOf(request.refreshToken);
  const record = family ? await kv.get<SignIn>(familyKey(family), 'json') : null;
  if (!family || !record)
    return refusal('This refresh token is unknown, revoked or expired. Sign in again.');
  if (record.clientId !== request.clientId)
    return refusal('This refresh token was issued to another client.');
  const presented = await tokenHash(request.refreshToken);
  if (
    presented === record.previous &&
    record.rotatedAt !== undefined &&
    now - record.rotatedAt < REUSE_GRACE_MS
  )
    return refusal('This refresh token was just used. Use the tokens that call returned.');
  if (presented !== record.refresh) {
    console.warn('[oauth] spent refresh token presented: ending the sign-in', { family });
    await revokeSignIn(kv, family);
    return refusal(
      'This refresh token was already used, so this sign-in has ended. Sign in again.',
    );
  }
  if (now >= record.refreshEndsAt || now >= record.upstreamEndsAt) {
    await revokeSignIn(kv, family);
    return refusal('This sign-in has expired. Sign in again.');
  }
  const upstream = await unseal(record.sealed, request.refreshToken);
  if (!upstream) {
    await revokeSignIn(kv, family);
    return refusal('This sign-in can no longer be read. Sign in again.');
  }
  return writePair(
    kv,
    family,
    { aud: record.aud, clientId: record.clientId, upstreamEndsAt: record.upstreamEndsAt },
    presented,
    upstream,
    now,
  );
}

export type ResolvedAccess =
  | { ok: true; upstream: string; family: string; clientId: string }
  | { ok: false; reason: 'unknown' | 'audience' | 'expired' };

/**
 * An access token presented at `aud`: the account token it holds, or why it is refused. Two reads, the token's record
 * and its sign-in's, so a sign-in ended by a spent refresh token stops every access token it handed out.
 */
export async function resolveAccessToken(
  kv: KVNamespace,
  token: string,
  aud: string,
  now = Date.now(),
): Promise<ResolvedAccess> {
  if (!isMcpAccessToken(token)) return { ok: false, reason: 'unknown' };
  const record = await kv.get<Access>(accessKey(await tokenHash(token)), 'json');
  if (!record) return { ok: false, reason: 'unknown' };
  if (record.aud !== aud) return { ok: false, reason: 'audience' };
  if (now >= record.endsAt) return { ok: false, reason: 'expired' };
  const signIn = await kv.get<SignIn>(familyKey(record.family), 'json');
  if (!signIn) return { ok: false, reason: 'unknown' };
  const upstream = await unseal(record.sealed, token);
  if (!upstream) return { ok: false, reason: 'unknown' };
  return { ok: true, upstream, family: record.family, clientId: record.clientId };
}
