// The Bearer a request to `/mcp` carries, resolved to the account token behind it (liveworkspace/docs/specs/021-mcp/
// mcp.md "Tokens", "Existing connections"; Work Tracker 1447). Only that account token ever reaches an app: the
// client's own token stops here.
//
//   lwm_…  this server's access token: its record, its audience (this origin's /mcp) and its sign-in
//   lwt_…  an account token handed out before this server had its own (or `lvd_…`, one carried over from the old
//          livediagram.app, docs/migration.md), accepted until LEGACY_TOKENS_UNTIL
//   other  refused
//
// Either way the account token is then checked with liveworkspace, kept a minute per isolate, so a token revoked in
// Settings or made up can't even `initialize`.
import { hasApiTokenPrefix } from '@liveworkspace/api-kit/api-token';
import { resolveAccessToken, revokeSignIn, tokenHash } from '@liveworkspace/mcp-kit/oauth-tokens';
import type { Env } from './env';

// Owner, 2026-11-25 (Work Tracker 1447, answer A): old tokens keep working for 30 days, then are refused.
export const LEGACY_TOKENS_UNTIL = Date.UTC(2026, 11, 27);

export type Resolved =
  { ok: true; upstream: string; family: string | null } | { ok: false; description: string };

const MINUTE_MS = 60 * 1000;
const LEGACY_WARN_EVERY_MS = 10 * MINUTE_MS;
const MAX_KEPT = 500;

// Per isolate: liveworkspace's answer for an account token (a minute), and when each legacy token last warned.
const checked = new Map<string, { at: number; live: boolean }>();
const warned = new Map<string, number>();

/** Forgets what this isolate kept (tests). */
export function forgetBearers(): void {
  checked.clear();
  warned.clear();
}

function warnLegacy(key: string, now: number): void {
  const last = warned.get(key);
  if (last !== undefined && now - last < LEGACY_WARN_EVERY_MS) return;
  if (warned.size >= MAX_KEPT) warned.clear();
  warned.set(key, now);
  console.warn('[mcp] legacy token', {
    // Eight hex characters of its hash: enough to follow one connection through the logs, never the token.
    token: key.slice(0, 8),
    refusedFrom: new Date(LEGACY_TOKENS_UNTIL).toISOString(),
  });
}

/**
 * Whether liveworkspace still knows an account token: an app api's own `GET /api/tokens/current` answers 401 for an
 * unknown, revoked or expired one. Anything else lets the request on (liveworkspace out of reach must not lock
 * everyone out; the app's own call judges the token again).
 */
async function stillLive(env: Env, upstream: string, now: number): Promise<boolean> {
  if (!env.TOKEN_API) return true;
  const key = await tokenHash(upstream);
  const kept = checked.get(key);
  if (kept && now - kept.at < MINUTE_MS) return kept.live;
  let live: boolean;
  try {
    const response = await env.TOKEN_API.fetch('https://livediagram-api/api/tokens/current', {
      headers: { Authorization: `Bearer ${upstream}` },
    });
    live = response.status !== 401;
    if (!live) console.warn('[mcp] account token refused by liveworkspace');
  } catch (err) {
    console.error('[mcp] account token not checked', { err: String(err) });
    return true;
  }
  if (checked.size >= MAX_KEPT) checked.clear();
  checked.set(key, { at: now, live });
  return live;
}

const SIGN_IN_AGAIN = 'Sign in again.';

/** The account token a Bearer presented at `origin`'s `/mcp` stands for, or why it is refused. */
export async function resolveBearer(
  env: Env,
  token: string,
  origin: string,
  now = Date.now(),
): Promise<Resolved> {
  let upstream: string;
  let family: string | null = null;
  if (hasApiTokenPrefix(token)) {
    if (now >= LEGACY_TOKENS_UNTIL)
      return {
        ok: false,
        description: `This connection was made before ${new Date(LEGACY_TOKENS_UNTIL).toISOString().slice(0, 10)} and its token is no longer accepted. ${SIGN_IN_AGAIN}`,
      };
    warnLegacy(await tokenHash(token), now);
    upstream = token;
  } else {
    const access = await resolveAccessToken(env.OAUTH_KV, token, `${origin}/mcp`, now);
    if (!access.ok)
      return {
        ok: false,
        description:
          access.reason === 'audience'
            ? `This token was issued for another server. ${SIGN_IN_AGAIN}`
            : `This token is unknown, revoked or expired. ${SIGN_IN_AGAIN}`,
      };
    upstream = access.upstream;
    family = access.family;
  }
  if (!(await stillLive(env, upstream, now))) {
    // The account token behind a sign-in is gone, so its refresh token must stop too, or the client would refresh
    // into the same refusal for ever.
    if (family) await revokeSignIn(env.OAUTH_KV, family);
    return {
      ok: false,
      description: `This token is no longer accepted (revoked or expired). ${SIGN_IN_AGAIN}`,
    };
  }
  return { ok: true, upstream, family };
}
