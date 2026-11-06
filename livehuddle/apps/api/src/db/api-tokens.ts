// API tokens are the liveworkspace account's (liveworkspace/docs/specs/003-accounts/accounts.md "API tokens"): made and revoked on
// liveworkspace.app, and good on every app. This app checks a presented `lwt_` token with liveworkspace and keeps
// no copy of it.

import {
  createTokenChecker,
  revokeAccountToken,
  type ClientCredentials,
  type TeamClaim,
  type TokenAccount,
} from '@liveworkspace/auth-client';
import { accountCredentials } from '../auth/accounts';
import type { Env } from '../types';

// One checker per client for the life of the isolate: it remembers each answer for a minute (an
// unknown token for ten seconds), so a burst of script calls asks liveworkspace once.
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

// liveworkspace couldn't answer, so a token can be neither accepted nor refused: the caller answers 503.
export class AccountsUnavailable extends Error {}

export type ResolvedApiToken = {
  ownerId: string;
  tokenId: string;
  readOnly: boolean;
  // The token's name and expiry, for GET /api/tokens/current.
  name: string | null;
  expiresAt: number;
  // The account's teams.
  teams: TeamClaim[];
};

// The auth hot path: the account behind a presented token, or null when liveworkspace doesn't know
// it (unknown, revoked or expired all read as "not authenticated"). No database read or write.
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
  if (!account) return null;
  return {
    ownerId: account.userId,
    tokenId: account.tokenId,
    readOnly: account.readOnly,
    name: account.name,
    expiresAt: account.expiresAt,
    teams: account.teams,
  };
}

// A token revoking itself (`DELETE /api/tokens/current`), at liveworkspace.
export async function revokePresentedToken(env: Env, secret: string): Promise<void> {
  const credentials = accountCredentials(env);
  if (credentials) await revokeAccountToken(credentials, secret);
}
