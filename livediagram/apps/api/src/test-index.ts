// liveworkspace's index for tests, the real one (liveworkspace/apps/index) in this process on an in-memory SQLite,
// with the accounts keys it and this api both verify against. Requests to INDEX_ORIGIN go to the index's own
// fetch handler; its calls back to this app (`/api/internal/*`) go to `appFetch`. Not a `.test.ts` file, so vitest
// doesn't collect it.

import indexWorker from '@liveworkspace/index-service';
import { testDb, type TestDb } from '@liveworkspace/index-service/testing';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { vi } from 'vitest';
import { clearGrantCacheForTests } from './index-service';
import type { Env } from './types';

export const TEST_INDEX_ORIGIN = 'https://index.test';
export const TEST_ACCOUNTS_URL = 'https://accounts.test';
export const TEST_API_RESOURCE = 'https://livediagram.test/api';
export const TEST_APP_ORIGIN = 'https://livediagram.test';
export const TEST_INDEX_KEY = 'test-index-key';

export type TestIndex = {
  db: TestDb;
  // An accounts access token (or, with `guest`, a guest token) for `sub`, as both the api and the index verify.
  tokenFor: (
    sub: string,
    options?: { guest?: boolean; teams?: { id: string; role?: 'admin' | 'member' }[] },
  ) => Promise<string>;
  // What the index's calls back to this app answer (`/api/internal/*`); 200 with no body by default.
  appFetch: (request: Request) => Response | Promise<Response>;
  // Every background task the index started, finished.
  settle: () => Promise<void>;
};

let keys: { privateKey: CryptoKey; jwk: JWK; grantSecret: string } | null = null;

async function testKeys() {
  if (keys) return keys;
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-accounts', alg: 'EdDSA' };
  const grantPair = await generateKeyPair('ES256', { extractable: true });
  const grantSecret = JSON.stringify({ ...(await exportJWK(grantPair.privateKey)), kid: 'grant-1' });
  keys = { privateKey: pair.privateKey, jwk, grantSecret };
  return keys;
}

// Points `env` at a fresh index and routes its calls there (and the accounts key set); any other URL goes to
// whatever `fetch` was before. Undo with vi.unstubAllGlobals().
export async function indexServiceFor(env: Partial<Env>): Promise<TestIndex> {
  const { privateKey, jwk, grantSecret } = await testKeys();
  clearGrantCacheForTests();
  env.INDEX_ORIGIN = TEST_INDEX_ORIGIN;
  env.INDEX_KEY = TEST_INDEX_KEY;
  env.ACCOUNTS_URL ??= TEST_ACCOUNTS_URL;
  env.API_RESOURCE ??= TEST_API_RESOURCE;
  const db = testDb({
    GRANT_SIGNING_KEY: grantSecret,
    ACCOUNTS_URL: env.ACCOUNTS_URL,
    INDEX_AUDIENCES: env.API_RESOURCE,
    INDEX_KEY_LIVEDIAGRAM: TEST_INDEX_KEY,
    APP_ORIGIN_LIVEDIAGRAM: TEST_APP_ORIGIN,
  });
  const pending: Promise<unknown>[] = [];
  const executionCtx = {
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const issuer = `${env.ACCOUNTS_URL.replace(/\/+$/, '')}/api/auth`;
  const index: TestIndex = {
    db,
    appFetch: () => new Response(null, { status: 200 }),
    tokenFor: (sub, options = {}) => {
      const claims: Record<string, unknown> = {};
      if (options.guest) claims.kind = 'guest';
      if (options.teams) {
        claims.teams = options.teams.map((t) => ({ id: t.id, name: t.id, role: t.role ?? 'member' }));
      }
      return new SignJWT(claims)
        .setProtectedHeader({ alg: 'EdDSA', kid: jwk.kid! })
        .setIssuer(issuer)
        .setAudience(env.API_RESOURCE!)
        .setSubject(sub)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
    },
    settle: async () => {
      while (pending.length > 0) await Promise.all(pending.splice(0));
    },
  };
  const before = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === TEST_INDEX_ORIGIN) {
      return indexWorker.fetch(request, db.env, executionCtx);
    }
    if (url.href === `${issuer}/jwks`) return Response.json({ keys: [jwk] });
    if (url.origin === TEST_APP_ORIGIN) return index.appFetch(request);
    return before(input, init);
  });
  return index;
}
