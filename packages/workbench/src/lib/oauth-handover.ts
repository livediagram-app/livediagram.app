// Minting a token and handing it to the MCP worker, for the consent and device pages (docs/specs/015-api/mcp-server.md
// §3 "Consent + mint", docs/specs/015-api/blueprints/cli.md "The device grant"). A token minted for a request that
// can no longer take it (the 10-minute session expired, the code was used, the MCP answered 429) would stay live for
// six months and count towards the per-account cap, so: the session is checked before the mint, and a token the MCP
// did not take is revoked straight away. A reconnect's earlier token goes too, but only once the new one has been
// handed over (`retire`, mcp-server.md "A reconnect replaces the client's earlier token").

import { MAX_API_TOKENS_PER_ACCOUNT } from '@liveworkspace/api-schema/api-tokens';
import { ApiError } from './api/api-error';
import { debugLog } from './debug-log';

export type HandoverFailure = 'expired' | 'token_limit' | 'failed';
type HandoverResult<T> = { ok: true; value: T } | { ok: false; reason: HandoverFailure };

export type HandoverSteps<T> = {
  // Whether the request can still take a token; checked before minting.
  sessionLive: () => Promise<boolean>;
  mint: () => Promise<{ token: string; id: string; expiresAt: number }>;
  // Hands the token over (with its id, so the MCP can note which token this client holds); null (or a throw) when
  // the MCP refused it.
  complete: (token: string, expiresAt: number, id: string) => Promise<T | null>;
  // Ends the minted token, presenting the token itself (DELETE /api/tokens/current).
  revoke: (token: string) => Promise<void>;
  // After a handover that went through: ends what the new token replaces (the consent page's reconnect). Never run
  // for a failed one, never fails the connect, and waited for at most RETIRE_WAIT_MS, so it can't hold the redirect.
  retire?: (value: T, id: string) => Promise<void>;
};

// How long a successful connect waits for its earlier token's revoke before moving on.
export const RETIRE_WAIT_MS = 3000;

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
  const value = await steps.complete(minted.token, minted.expiresAt, minted.id).catch(() => null);
  if (value !== null) {
    if (steps.retire) await retireWithin(steps.retire(value, minted.id));
    return { ok: true, value };
  }
  // The MCP did not take it: nothing else holds this secret, so it must not stay live.
  await steps.revoke(minted.token).catch(() => {
    console.warn('[oauth] handover revoke failed');
  });
  debugLog('[oauth] handover refused; minted token revoked');
  return { ok: false, reason: 'failed' };
}

// The earlier token's revoke, waited for no longer than RETIRE_WAIT_MS; a failure leaves it live, which is only what
// a connect did before reconnects replaced anything.
async function retireWithin(retiring: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, RETIRE_WAIT_MS);
  });
  await Promise.race([
    retiring.catch(() => {
      console.warn('[oauth] replaced token revoke failed');
    }),
    late,
  ]);
  clearTimeout(timer);
}

// The line each page shows under its buttons for a failure (`restart` says how to start over).
export function handoverFailureCopy(reason: HandoverFailure, restart: string): string {
  switch (reason) {
    case 'expired':
      return `This request has expired. ${restart}`;
    case 'token_limit':
      return `Your account has reached its limit of ${MAX_API_TOKENS_PER_ACCOUNT} API tokens. Revoke one below, then connect.`;
    case 'failed':
      return 'Something went wrong. Please try again.';
  }
}
