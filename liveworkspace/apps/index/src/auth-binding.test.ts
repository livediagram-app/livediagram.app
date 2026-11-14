// Accounts' key set through the ACCOUNTS service binding (liveworkspace/docs/specs/004-index/index-service.md
// "Who calls it"): a fetch to accounts' route on this zone can stall, so the binding is asked first, the public route
// only when it throws; and the grant keys at /jwks never wait on a token's check.

import { describe, expect, it, vi } from 'vitest';
import { accountsKeySet, AUDIENCE, call, h, person, useHarness } from './test-support';

useHarness();

// Each test its own audience list, so it builds its own verifier (one is kept per issuer and audience list).
const envWith = (extraAudience: string, accounts?: Fetcher) => ({
  ...h.db.env,
  INDEX_AUDIENCES: `${AUDIENCE},${extraAudience}`,
  ...(accounts ? { ACCOUNTS: accounts } : {}),
});

describe("accounts' keys through the binding", () => {
  it('checks a token with keys from the binding, never asking the public route', async () => {
    const routed = vi.fn(async () => {
      throw new Error('the public route must not be asked');
    });
    vi.stubGlobal('fetch', routed);
    const bound = vi.fn(async (_url: string) => Response.json(accountsKeySet()));
    const env = envWith('https://bound.example/api', { fetch: bound } as unknown as Fetcher);
    const ada = await person('user_bound');
    const res = await call('/placement-defaults', { auth: ada.auth, env });
    expect(res.status).toBe(200);
    expect(bound).toHaveBeenCalledTimes(1);
    expect(bound.mock.calls[0]![0]).toBe('https://liveworkspace.app/api/auth/jwks');
    expect(routed).not.toHaveBeenCalled();
  });

  it('falls back to the public route when the binding throws', async () => {
    const bound = vi.fn(async () => {
      throw new Error('no local dev session for liveworkspace-accounts');
    });
    const env = envWith('https://fallback.example/api', { fetch: bound } as unknown as Fetcher);
    const ada = await person('user_fallback');
    const res = await call('/placement-defaults', { auth: ada.auth, env });
    expect(res.status).toBe(200);
    expect(bound).toHaveBeenCalledTimes(1);
  });
});

describe('the grant keys', () => {
  it('answer /jwks without checking the bearer, so a stalled accounts never holds them', async () => {
    // Accounts never answers: a token check would hang here.
    vi.stubGlobal('fetch', () => new Promise<Response>(() => {}));
    const env = envWith('https://stalled.example/api');
    const ada = await person('user_stalled');
    const res = await call('/jwks', { auth: ada.auth, env });
    expect(res.status).toBe(200);
    expect((await res.json()) as { keys: unknown[] }).toMatchObject({ keys: [{ kid: 'grant-1' }] });
  });
});
