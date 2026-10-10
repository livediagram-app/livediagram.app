// Minting a token and handing it to the MCP worker, for the consent and device pages (docs/specs/015-api/mcp-server.md
// §3 "Consent + mint", docs/specs/015-api/blueprints/cli.md "The device grant"). A token minted for a request that
// can no longer take it (the 10-minute session expired, the code was used, the MCP answered 429) would stay live for
// six months and count towards the per-account cap, so: the session is checked before the mint, and a token the MCP
// did not take is revoked straight away.

import { ApiError } from './api/core';

export type HandoverFailure = 'expired' | 'token_limit' | 'failed';
export type HandoverResult<T> = { ok: true; value: T } | { ok: false; reason: HandoverFailure };

export type HandoverSteps<T> = {
  // Whether the request can still take a token; checked before minting.
  sessionLive: () => Promise<boolean>;
  mint: () => Promise<{ token: string; id: string; expiresAt: number }>;
  // Hands the token over; null (or a throw) when the MCP refused it.
  complete: (token: string, expiresAt: number) => Promise<T | null>;
  revoke: (id: string) => Promise<void>;
};

// The api's answer when the account already holds the most live tokens it may.
const TOKEN_LIMIT_CODE = 'token_limit_reached';

export async function mintAndHandOver<T>(steps: HandoverSteps<T>): Promise<HandoverResult<T>> {
  if (!(await steps.sessionLive().catch(() => false))) return { ok: false, reason: 'expired' };
  let minted: { token: string; id: string; expiresAt: number };
  try {
    minted = await steps.mint();
  } catch (err) {
    const limit = err instanceof ApiError && err.status === 409 && err.code === TOKEN_LIMIT_CODE;
    return { ok: false, reason: limit ? 'token_limit' : 'failed' };
  }
  const value = await steps.complete(minted.token, minted.expiresAt).catch(() => null);
  if (value !== null) return { ok: true, value };
  // The MCP did not take it: nothing else holds this secret, so it must not stay live.
  await steps.revoke(minted.id).catch(() => {
    console.warn('[oauth] handover revoke failed');
  });
  console.info('[oauth] handover refused; minted token revoked');
  return { ok: false, reason: 'failed' };
}

// The line each page shows under its buttons for a failure (`restart` says how to start over).
export function handoverFailureCopy(reason: HandoverFailure, restart: string): string {
  switch (reason) {
    case 'expired':
      return `This request has expired. ${restart}`;
    case 'token_limit':
      return 'Your account has reached its limit of API tokens. Revoke one in Settings, under Account › API Tokens, then try again.';
    case 'failed':
      return 'Something went wrong. Please try again.';
  }
}
