import { exportJWK, generateKeyPair } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { remoteKeySet, remoteKeySetAt } from './verify';

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
