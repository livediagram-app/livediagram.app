// What the index's tests share: accounts' keys and tokens, a stand-in for the network (accounts' JWKS
// and each app's internal routes), the grant key, and a caller. Not a `.test.ts` file, so vitest doesn't
// collect it.

import { clearFreshTeamsForTests } from './fresh-teams';
import { clearVisitorMemoryForTests } from './visitors';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import worker from './index';
import { testDb, type TestDb } from './test-sqlite-d1';
import type { Env } from './env';

export const BASE = 'https://liveworkspace.app/api/index';
export const ISSUER = 'https://liveworkspace.app/api/auth';
export const AUDIENCE = 'https://liveplanner.app/api';

let accountsKey: CryptoKey;
let accountsJwk: JWK;
export let grantSecret: string;

export type AppCall = { method: string; url: string; body: unknown; headers: Headers };

export type Harness = {
  db: TestDb;
  appCalls: AppCall[];
  // What an app's internal route answers; 200 by default.
  appAnswer: (call: AppCall) => Response | Promise<Response>;
  pending: Promise<unknown>[];
};

export const h: Harness = {
  db: undefined as unknown as TestDb,
  appCalls: [],
  appAnswer: () => new Response(null, { status: 200 }),
  pending: [],
};

export function useHarness(overrides: Partial<Env> = {}) {
  beforeAll(async () => {
    const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    accountsKey = pair.privateKey;
    accountsJwk = { ...(await exportJWK(pair.publicKey)), kid: 'acc1', alg: 'EdDSA' };
    const grantPair = await generateKeyPair('ES256', { extractable: true });
    grantSecret = JSON.stringify({ ...(await exportJWK(grantPair.privateKey)), kid: 'grant-1' });
  });

  beforeEach(() => {
    h.db = testDb({ GRANT_SIGNING_KEY: grantSecret, ...overrides });
    h.appCalls = [];
    h.appAnswer = () => new Response(null, { status: 200 });
    h.pending = [];
    clearFreshTeamsForTests();
    clearVisitorMemoryForTests();
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url === `${ISSUER}/jwks`) return Response.json({ keys: [accountsJwk] });
      const call: AppCall = {
        method: init.method ?? 'GET',
        url,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        headers: new Headers(init.headers),
      };
      h.appCalls.push(call);
      return h.appAnswer(call);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
}

export type TokenOptions = {
  teams?: { id: string; name?: string; role?: 'admin' | 'member' }[];
  guest?: boolean;
  aud?: string;
  exp?: string;
};

export function token(sub: string, options: TokenOptions = {}): Promise<string> {
  const claims: Record<string, unknown> = {};
  if (options.guest) claims.kind = 'guest';
  if (options.teams) {
    claims.teams = options.teams.map((t) => ({
      id: t.id,
      name: t.name ?? t.id,
      role: t.role ?? 'member',
    }));
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', kid: 'acc1' })
    .setIssuer(ISSUER)
    .setAudience(options.aud ?? AUDIENCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(options.exp ?? '5m')
    .sign(accountsKey);
}

const ctx = {
  waitUntil: (promise: Promise<unknown>) => {
    h.pending.push(promise);
  },
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

export type CallOptions = {
  method?: string;
  body?: unknown;
  // A bearer: a token, or an app's or accounts' key.
  auth?: string | null;
  headers?: Record<string, string>;
  env?: Env;
};

export async function call(path: string, options: CallOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.auth) headers.set('Authorization', `Bearer ${options.auth}`);
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }
  return worker.fetch(
    new Request(`${BASE}${path}`, { method: options.method ?? 'GET', headers, body }),
    options.env ?? h.db.env,
    ctx,
  );
}

// Every waitUntil so far, finished.
export async function settle(): Promise<void> {
  while (h.pending.length > 0) await Promise.all(h.pending.splice(0));
}

export async function body<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

// A person: their id and a token, for calls.
export async function person(sub: string, options: TokenOptions = {}) {
  return { id: sub, auth: await token(sub, options) };
}

export async function makeItem(
  auth: string,
  input: Record<string, unknown> = {},
): Promise<{ id: string; [k: string]: unknown }> {
  const res = await call('/items', {
    method: 'POST',
    auth,
    body: { app: 'liveplanner', ...input },
  });
  if (res.status !== 201) throw new Error(`create failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { item: { id: string } }).item;
}
