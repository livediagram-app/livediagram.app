// The index's grant keys through the app's INDEX service binding (liveworkspace/docs/specs/004-index/
// one-explorer-contracts.md "Grants"): a Worker's fetch to another Worker's public route can stall, so the binding is
// asked first and the public route only when it throws. A room's Durable Object hands its Worker's env (binding
// included) to the same check, through openRoomTicket and renewRoomGrant.

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { openRoomTicket } from './room-ticket';
import { createIndexService, type IndexEnv } from './service';

const ORIGIN = 'https://keys-probe.example';
const JWKS_URL = `${ORIGIN}/api/index/jwks`;

let privateKey: CryptoKey;
let publicJwk: JsonWebKey & { kid: string; alg: string };

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  privateKey = pair.privateKey;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  publicJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, kid: 'g-bound', alg: 'ES256' };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const part = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

// An ES256 grant as the index signs one (WebCrypto's ECDSA signature is already JWS's r || s).
async function grant(item = 'item-1'): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = part({ alg: 'ES256', kid: 'g-bound' });
  const body = part({
    iss: `${ORIGIN}/api/index`,
    aud: 'livediagram',
    sub: 'user_1',
    item,
    level: 'edit',
    tab: null,
    team: null,
    iat: now,
    exp: now + 600,
    jti: 'j1',
  });
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`;
}

const binding = (answer: () => Promise<Response>) => {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => answer());
  return { fetch };
};

const noRoute = () =>
  vi.fn(async () => {
    throw new Error('the public route must not be asked');
  });

describe('verifyGrant with an INDEX binding', () => {
  it('fetches the keys through the binding, never over the public route', async () => {
    const routed = noRoute();
    vi.stubGlobal('fetch', routed);
    const service = createIndexService('livediagram');
    const bound = binding(async () => Response.json({ keys: [publicJwk] }));
    const env: IndexEnv = { INDEX_ORIGIN: ORIGIN, INDEX: bound };
    await expect(service.verifyGrant(env, await grant(), 'item-1')).resolves.toMatchObject({
      item: 'item-1',
    });
    // The verifier is kept: a second grant is checked against the cached keys.
    await expect(service.verifyGrant(env, await grant(), 'item-1')).resolves.not.toBeNull();
    expect(bound.fetch).toHaveBeenCalledTimes(1);
    expect(bound.fetch.mock.calls[0]![0]).toBe(JWKS_URL);
    expect(routed).not.toHaveBeenCalled();
  });

  it('falls back to the public route when the binding throws', async () => {
    const routed = vi.fn(async () => Response.json({ keys: [publicJwk] }));
    vi.stubGlobal('fetch', routed);
    const service = createIndexService('livediagram');
    const bound = binding(async () => {
      throw new Error('no local dev session for liveworkspace-index');
    });
    await expect(
      service.verifyGrant({ INDEX_ORIGIN: ORIGIN, INDEX: bound }, await grant(), 'item-1'),
    ).resolves.not.toBeNull();
    expect(bound.fetch).toHaveBeenCalledTimes(1);
    expect(routed).toHaveBeenCalled();
  });

  it('builds a verifier anew for another binding on the same index', async () => {
    vi.stubGlobal('fetch', noRoute());
    const service = createIndexService('livediagram');
    const first = binding(async () => Response.json({ keys: [publicJwk] }));
    const second = binding(async () => Response.json({ keys: [publicJwk] }));
    await service.verifyGrant({ INDEX_ORIGIN: ORIGIN, INDEX: first }, await grant(), 'item-1');
    await expect(
      service.verifyGrant({ INDEX_ORIGIN: ORIGIN, INDEX: second }, await grant(), 'item-1'),
    ).resolves.not.toBeNull();
    expect(first.fetch).toHaveBeenCalledTimes(1);
    expect(second.fetch).toHaveBeenCalledTimes(1);
  });

  it("checks a room's ticket through the room env's binding", async () => {
    const routed = noRoute();
    vi.stubGlobal('fetch', routed);
    const service = createIndexService('livediagram');
    const bound = binding(async () => Response.json({ keys: [publicJwk] }));
    // A Durable Object's env: its Worker's, spread with the room's own additions.
    const roomEnv = { INDEX_ORIGIN: ORIGIN, INDEX: bound, DOCUMENT_DB: {} };
    const opened = await openRoomTicket(service, roomEnv, await grant('item-9'), 'item-9');
    expect(opened?.claims.item).toBe('item-9');
    expect(bound.fetch).toHaveBeenCalledTimes(1);
    expect(routed).not.toHaveBeenCalled();
  });
});
