import { exportJWK, generateKeyPair } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOUND_KEYS_TIMEOUT_MS, remoteKeySet, remoteKeySetAt } from './verify';

// The accounts key set while the move to www. lasts (liveworkspace/docs/specs/003-accounts/accounts.md "The move to www."): from the
// configured host, else from its twin's, so a check pointed at www. works before www. routes to accounts.

async function keyPair() {
  const { publicKey } = await generateKeyPair('EdDSA', { extractable: true });
  return { jwk: { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'EdDSA' } };
}

// A fetch answering the key set only on `servedAt`, recording every URL asked.
function serveKeysAt(servedAt: string, jwk: object) {
  const asked: string[] = [];
  vi.stubGlobal('fetch', async (input: Request | URL | string) => {
    const url = input instanceof Request ? input.url : String(input);
    asked.push(url);
    return url === servedAt
      ? Response.json({ keys: [jwk] })
      : new Response('not found', { status: 404 });
  });
  return asked;
}

const header = { alg: 'EdDSA', kid: 'k1' };

afterEach(() => vi.unstubAllGlobals());

describe('remoteKeySet', () => {
  it('reads the keys from the configured host, never asking the twin when it answers', async () => {
    const { jwk } = await keyPair();
    const asked = serveKeysAt('https://www.liveworkspace.app/api/auth/jwks', jwk);
    const keys = remoteKeySet('https://www.liveworkspace.app/api/auth');
    await expect(keys(header, { payload: '', signature: '' } as never)).resolves.toBeDefined();
    expect(asked).toEqual(['https://www.liveworkspace.app/api/auth/jwks']);
  });

  it("falls back to the twin's keys when www. does not answer yet", async () => {
    const { jwk } = await keyPair();
    const asked = serveKeysAt('https://liveworkspace.app/api/auth/jwks', jwk);
    const keys = remoteKeySet('https://www.liveworkspace.app/api/auth');
    await expect(keys(header, { payload: '', signature: '' } as never)).resolves.toBeDefined();
    expect(asked).toEqual([
      'https://www.liveworkspace.app/api/auth/jwks',
      'https://liveworkspace.app/api/auth/jwks',
    ]);
  });

  it("throws the configured host's own error when neither answers", async () => {
    const { jwk } = await keyPair();
    serveKeysAt('https://nowhere.example/jwks', jwk);
    const keys = remoteKeySetAt('https://liveworkspace.app/api/index/grant-keys');
    await expect(keys(header, { payload: '', signature: '' } as never)).rejects.toThrow();
  });

  it('has no twin to ask on staging', async () => {
    const { jwk } = await keyPair();
    const asked = serveKeysAt('https://nowhere.example/jwks', jwk);
    const keys = remoteKeySet('https://staging.liveworkspace.app/api/auth');
    await expect(keys(header, { payload: '', signature: '' } as never)).rejects.toThrow();
    expect(asked).toEqual(['https://staging.liveworkspace.app/api/auth/jwks']);
  });
});

describe('remoteKeySetAt through a binding', () => {
  afterEach(() => vi.useRealTimers());

  it('falls back to the public route once a stalled binding passes the shorter timeout', async () => {
    vi.useFakeTimers();
    const { jwk } = await keyPair();
    const url = 'https://liveworkspace.app/api/index/grant-keys';
    const asked = serveKeysAt(url, jwk);
    let boundCalls = 0;
    // A binding that never answers, until jose aborts it.
    const via = {
      fetch: (_url: string, init?: RequestInit) => {
        boundCalls += 1;
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      },
    };
    const keys = remoteKeySetAt(url, via as never);
    let settled = false;
    const result = Promise.resolve(keys(header, { payload: '', signature: '' } as never)).then(
      (key) => {
        settled = true;
        return key;
      },
    );
    await vi.advanceTimersByTimeAsync(BOUND_KEYS_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    expect(asked).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBeDefined();
    expect(boundCalls).toBe(1);
    expect(asked).toEqual([url]);
    expect(BOUND_KEYS_TIMEOUT_MS).toBeLessThan(5000);
  });
  // jose's cooldown only starts once a key set has loaded: a binding that failed has loaded nothing, so it is
  // asked again on the next check; a binding that answered is not asked again inside the cooldown for an unknown kid.
  it('asks a stalled binding again on the next check, as a failure starts no cooldown', async () => {
    vi.useFakeTimers();
    const { jwk } = await keyPair();
    const url = 'https://liveworkspace.app/api/index/grant-keys';
    serveKeysAt(url, jwk);
    let boundCalls = 0;
    const via = {
      fetch: (_url: string, init?: RequestInit) => {
        boundCalls += 1;
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      },
    };
    const keys = remoteKeySetAt(url, via as never);
    for (let n = 1; n <= 2; n += 1) {
      const result = Promise.resolve(keys(header, { payload: '', signature: '' } as never));
      await vi.advanceTimersByTimeAsync(BOUND_KEYS_TIMEOUT_MS);
      await expect(result).resolves.toBeDefined();
      expect(boundCalls).toBe(n);
    }
  });

  it('does not ask a binding that answered again for an unknown kid inside the cooldown', async () => {
    const { jwk } = await keyPair();
    const url = 'https://liveworkspace.app/api/index/grant-keys';
    const asked = serveKeysAt(url, { ...jwk, kid: 'other' });
    const via = { fetch: vi.fn(async () => Response.json({ keys: [jwk] })) };
    const keys = remoteKeySetAt(url, via as never);
    await keys(header, { payload: '', signature: '' } as never);
    expect(via.fetch).toHaveBeenCalledTimes(1);
    await keys({ alg: 'EdDSA', kid: 'other' }, { payload: '', signature: '' } as never);
    expect(via.fetch).toHaveBeenCalledTimes(1);
    expect(asked).toEqual([url]);
  });
});
