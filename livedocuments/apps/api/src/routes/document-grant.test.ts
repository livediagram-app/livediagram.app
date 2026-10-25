import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INDEX_GRANT_HEADER } from '@livedocuments/api-schema';
import type { GrantClaims } from '@liveworkspace/index-client';
import { clearGrantCacheForTests, setGrantVerifierForTests } from '../index-service';
import type { Env } from '../types';
import { resolveDocumentGrant } from './document-grant';
import { makeTestRouteContext } from './test-route-context';

// How the worker settles the index's grant on a document (document-grant.ts): the editor's own grant is checked offline,
// with no call; anyone else's is fetched from the index once and kept until a minute before it lapses.

const NOW_S = Math.floor(Date.now() / 1000);
const grantOf = (claims: Partial<GrantClaims>) =>
  `G.${btoa(JSON.stringify({ item: 'P', sub: 'user_a', level: 'edit', tab: null, team: null, exp: NOW_S + 600, ...claims }))}`;

const ENV = { INDEX_ORIGIN: 'https://index.test', INDEX_KEY: 'k' } as unknown as Env;

// The index: each grant request recorded, answered with `answer`.
let calls: { url: string; headers: Headers }[] = [];
let answer: () => Response;

beforeEach(() => {
  calls = [];
  clearGrantCacheForTests();
  answer = () =>
    Response.json({
      grant: grantOf({ level: 'view' }),
      level: 'view',
      tabId: null,
      expiresAt: (NOW_S + 600) * 1000,
    });
  setGrantVerifierForTests(async (token) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    calls.push({ url: req.url, headers: req.headers });
    return answer();
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setGrantVerifierForTests(null);
});

const ctxWith = (opts: Parameters<typeof makeTestRouteContext>[2]) => {
  const ctx = makeTestRouteContext('GET', '/api/documents/P', { env: ENV, grant: null, ...opts });
  return ctx;
};

describe('resolveDocumentGrant', () => {
  it("checks the editor's own grant offline, asking the index nothing", async () => {
    const ctx = ctxWith({ headers: { [INDEX_GRANT_HEADER]: grantOf({}) } });
    const grant = await resolveDocumentGrant(ctx, 'P');
    expect(grant).toMatchObject({ item: 'P', level: 'edit', sub: 'user_a' });
    expect(calls).toEqual([]);
  });

  it('refuses a grant for another document, and asks the index for this one instead', async () => {
    const ctx = {
      ...ctxWith({ headers: { [INDEX_GRANT_HEADER]: grantOf({ item: 'Q' }) } }),
      bearer: 'tok',
    };
    const grant = await resolveDocumentGrant(ctx, 'P');
    expect(grant).toMatchObject({ item: 'P', level: 'view' });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://index.test/api/index/items/P/grant');
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('asks for an API token as its account, with this app key, once while the grant lasts', async () => {
    const ctx = ctxWith({ owner: 'user_a', verifiedUserId: 'user_a', token: { id: 'tok1' } });
    await resolveDocumentGrant(ctx, 'P');
    await resolveDocumentGrant(ctx, 'P');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer k');
  });

  it('passes a link visitor code and password on, and answers a password refusal as the index did', async () => {
    answer = () => Response.json({ error: 'password_required' }, { status: 401 });
    const ctx = ctxWith({
      owner: null,
      headers: { 'X-Share-Code': 'CODE2345', 'X-Share-Password': 'pw' },
    });
    const res = await resolveDocumentGrant(ctx, 'P');
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
    expect(await (res as Response).json()).toEqual({ error: 'password_required' });
    expect(calls[0]!.headers.get('X-Share-Code')).toBe('CODE2345');
    expect(calls[0]!.headers.get('X-Share-Password')).toBe('pw');
  });

  it('answers no grant for any other refusal, and asks nobody for a caller with nothing to show', async () => {
    answer = () => Response.json({ error: 'not_found' }, { status: 404 });
    expect(await resolveDocumentGrant({ ...ctxWith({}), bearer: 'tok' }, 'P')).toBeNull();
    calls = [];
    expect(await resolveDocumentGrant(ctxWith({ owner: null }), 'P')).toBeNull();
    expect(calls).toEqual([]);
  });
});
