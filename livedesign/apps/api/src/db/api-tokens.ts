// API tokens are the liveworkspace account's (liveworkspace/docs/accounts.md "API tokens"): made and
// revoked on liveworkspace.app, and good on every app. This app checks a presented `lwt_` token with
// liveworkspace and keeps `api_tokens` as its MIRROR of the tokens it has seen: the rows workbench
// pairings and sessions hang off (docs/specs/013-workspace/workbench-embeds.md), the CLI's
// "current token" reads, and the Timeline's expiry warnings. Only the SHA-256 hash is ever stored.

import {
  createTokenChecker,
  liveTokenIds,
  MAX_LIVE_TOKEN_IDS,
  mintAccountToken,
  revokeAccountToken,
  type ClientCredentials,
  type TeamClaim,
  type TokenAccount,
} from '@liveworkspace/auth-client';
import { accountCredentials } from '../auth/accounts';
import { hashApiToken } from '../auth/api-token';
import { rowToApiToken, type ApiTokenRow } from '../api-token-row';
import type { ApiTokenDTO, Env } from '../types';

const COLS =
  'id, owner_id, token_hash, name, created_at, last_used_at, expires_at, revoked, read_only';

// The mirror rows for one account's live tokens, newest first.
export async function listApiTokensByOwner(env: Env, ownerId: string): Promise<ApiTokenDTO[]> {
  const result = await env.DB.prepare(
    `SELECT ${COLS} FROM api_tokens WHERE owner_id = ? AND revoked = 0 ORDER BY created_at DESC`,
  )
    .bind(ownerId)
    .all<ApiTokenRow>();
  return (result.results ?? []).map(rowToApiToken);
}

// One checker per client for the life of the isolate: it remembers each answer for a minute (an
// unknown token for ten seconds), so a burst of MCP tool calls asks liveworkspace once.
type Check = ReturnType<typeof createTokenChecker>;
const checkers = new Map<string, Check>();

function checkerFor(credentials: ClientCredentials): Check {
  const key = `${credentials.accountsUrl} ${credentials.clientId}`;
  let check = checkers.get(key);
  if (!check) {
    check = createTokenChecker(credentials);
    checkers.set(key, check);
  }
  return check;
}

// How often one isolate rewrites a token's mirror row: the row only has to exist and stay current
// for the workbench joins, and `last_used_at` is read at a day's grain. Safe range: 1 s to 1 h.
export const MIRROR_REFRESH_MS = 60_000;
const MIRRORED_MAX = 1000;
const mirrored = new Map<string, number>();

async function mirrorToken(
  env: Env,
  token: { id: string; ownerId: string; name: string | null; secret: string },
  t: { readOnly: boolean; expiresAt: number },
  now: number,
): Promise<void> {
  if ((mirrored.get(token.id) ?? 0) > now) return;
  await env.DB.prepare(
    `INSERT INTO api_tokens (id, owner_id, token_hash, name, created_at, last_used_at, expires_at, revoked, read_only)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, 0, ?7)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, last_used_at = excluded.last_used_at,
       expires_at = excluded.expires_at, read_only = excluded.read_only, revoked = 0`,
  )
    .bind(
      token.id,
      token.ownerId,
      await hashApiToken(token.secret),
      token.name,
      now,
      t.expiresAt,
      t.readOnly ? 1 : 0,
    )
    .run();
  if (mirrored.size >= MIRRORED_MAX) mirrored.clear();
  mirrored.set(token.id, now + MIRROR_REFRESH_MS);
}

// liveworkspace couldn't answer, so a token can be neither accepted nor refused: the caller answers 503.
export class AccountsUnavailable extends Error {}

export type ResolvedApiToken = {
  ownerId: string;
  tokenId: string;
  readOnly: boolean;
  // The account's teams, a nudge for the teams mirror (db/team-sync.ts).
  teams: TeamClaim[];
};

// The auth hot path: the account behind a presented token, or null when liveworkspace doesn't know
// it (unknown, revoked or expired all read as "not authenticated"). A token liveworkspace refuses is
// marked revoked in the mirror too, so the workbench sessions made from it stop with it.
export async function resolveApiToken(env: Env, token: string): Promise<ResolvedApiToken | null> {
  const credentials = accountCredentials(env);
  if (!credentials) return null;
  let account: TokenAccount | null;
  try {
    account = await checkerFor(credentials)(token);
  } catch (err) {
    console.error('[tokens] liveworkspace unreachable', err);
    throw new AccountsUnavailable();
  }
  const now = Date.now();
  if (!account) {
    await env.DB.prepare('UPDATE api_tokens SET revoked = 1 WHERE token_hash = ? AND revoked = 0')
      .bind(await hashApiToken(token))
      .run();
    return null;
  }
  await mirrorToken(
    env,
    { id: account.tokenId, ownerId: account.userId, name: account.name, secret: token },
    account,
    now,
  );
  return {
    ownerId: account.userId,
    tokenId: account.tokenId,
    readOnly: account.readOnly,
    teams: account.teams,
  };
}

/**
 * An account token for an AI tool someone is connecting here (docs/specs/015-api/mcp-server.md),
 * made by liveworkspace for whoever `accessToken` belongs to, so it works on every app and shows on
 * liveworkspace.app with the rest. Null when the account is at the token cap. The plaintext
 * `secret` comes back once, here.
 */
export async function mintApiToken(
  env: Env,
  t: { accessToken: string; name: string; readOnly: boolean },
): Promise<{ secret: string; id: string; expiresAt: number } | null> {
  const credentials = accountCredentials(env);
  if (!credentials) return null;
  const minted = await mintAccountToken(credentials, t);
  if (!minted) {
    console.info('[api-tokens] mint refused: account at the token cap');
    return null;
  }
  return { secret: minted.secret, id: minted.id, expiresAt: minted.expiresAt };
}

// A token revoking itself (the CLI's auth logout), at liveworkspace and in the mirror.
export async function revokePresentedToken(
  env: Env,
  token: { id: string; secret: string },
): Promise<void> {
  const credentials = accountCredentials(env);
  if (credentials) await revokeAccountToken(credentials, token.secret);
  await env.DB.prepare('UPDATE api_tokens SET revoked = 1 WHERE id = ?').bind(token.id).run();
  mirrored.delete(token.id);
}

// Tokens checked per run of the token sweep: the most recently used first, since those are the
// ones with workbench sessions to end. The rest lapse on their own expiry.
export const TOKEN_SWEEP_MAX = 1000;

// The five-minute run: asks liveworkspace which mirrored tokens still work, and marks the rest
// revoked, so a token revoked on liveworkspace.app ends its workbench sessions within five minutes
// even if nobody presents it here again. Returns the ids it marked.
export async function sweepRevokedTokens(env: Env, now = Date.now()): Promise<string[]> {
  const credentials = accountCredentials(env);
  if (!credentials) return [];
  const { results } = await env.DB.prepare(
    `SELECT id FROM api_tokens WHERE revoked = 0 AND expires_at > ?
      ORDER BY last_used_at DESC LIMIT ?`,
  )
    .bind(now, TOKEN_SWEEP_MAX)
    .all<{ id: string }>();
  const ids = (results ?? []).map((r) => r.id);
  const gone: string[] = [];
  for (let i = 0; i < ids.length; i += MAX_LIVE_TOKEN_IDS) {
    const batch = ids.slice(i, i + MAX_LIVE_TOKEN_IDS);
    const live = new Set(await liveTokenIds(credentials, batch));
    gone.push(...batch.filter((id) => !live.has(id)));
  }
  if (gone.length > 0) {
    await env.DB.batch(
      gone.map((id) => env.DB.prepare('UPDATE api_tokens SET revoked = 1 WHERE id = ?').bind(id)),
    );
    for (const id of gone) mirrored.delete(id);
  }
  return gone;
}
