import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { createItemGrant, ITEM_GRANT_HEADER, itemSourceOf, resolveItemGrant } from './request';
import { createIndexService, GRANT_CACHE_MAX } from './service';

const NOW_S = Math.floor(Date.now() / 1000);
const grantOf = (claims: Partial<GrantClaims>) =>
  `G.${btoa(JSON.stringify({ item: 'I', sub: 'user_a', level: 'edit', tab: null, team: null, exp: NOW_S + 600, ...claims }))}`;
const ENV = { INDEX_ORIGIN: 'https://index.test', INDEX_KEY: 'k' };

const service = createIndexService('livedocuments');
let calls: Request[] = [];
let answer: (req: Request) => Response;

beforeEach(() => {
  calls = [];
  service.clearGrantCacheForTests();
  answer = (req) =>
    Response.json({
      grant: grantOf({ item: new URL(req.url).pathname.split('/')[4] ?? 'I', level: 'view' }),
      level: 'view',
      tabId: null,
      expiresAt: (NOW_S + 600) * 1000,
    });
  service.setGrantVerifierForTests(async (token) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    calls.push(req);
    return answer(req);
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  service.setGrantVerifierForTests(null);
});

const req = (headers: Record<string, string> = {}) =>
  new Request('https://app.test/api/x', { headers });

describe('resolveItemGrant', () => {
  it("checks the editor's own grant offline", async () => {
    const grant = await resolveItemGrant(
      service,
      ENV,
      req({ [ITEM_GRANT_HEADER]: grantOf({}) }),
      { kind: 'bearer', token: 't' },
      'I',
    );
    expect(grant).toMatchObject({ item: 'I', level: 'edit' });
    expect(calls).toHaveLength(0);
  });

  it('refuses a grant for another item, then asks for its own', async () => {
    const grant = await resolveItemGrant(
      service,
      ENV,
      req({ [ITEM_GRANT_HEADER]: grantOf({ item: 'J' }) }),
      { kind: 'bearer', token: 't' },
      'I',
    );
    expect(grant).toMatchObject({ item: 'I', level: 'view' });
    expect(calls).toHaveLength(1);
  });

  it('asks as a delegate with the app key, once per caller and item', async () => {
    const caller = { kind: 'delegate', personId: 'user_a', teams: ['team_b', 'team_a'] } as const;
    await resolveItemGrant(service, ENV, req(), caller, 'I');
    await resolveItemGrant(service, ENV, req(), caller, 'I');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer k');
    expect(calls[0]!.headers.get('X-Index-App')).toBe('livedocuments');
  });

  it('asks nothing for nobody, and answers a password refusal', async () => {
    expect(
      await resolveItemGrant(service, ENV, req(), { kind: 'bearer', token: null }, 'I'),
    ).toBeNull();
    answer = () => Response.json({ error: 'password_required' }, { status: 401 });
    const res = await resolveItemGrant(
      service,
      ENV,
      req({ 'X-Share-Code': 'c' }),
      { kind: 'bearer', token: null },
      'I',
    );
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
    answer = () => Response.json({ error: 'not_found' }, { status: 404 });
    expect(
      await resolveItemGrant(service, ENV, req(), { kind: 'bearer', token: 'x' }, 'I2'),
    ).toBeNull();
  });

  it('keeps the grant cache bounded', async () => {
    const caller = { kind: 'bearer', token: 't' } as const;
    for (let i = 0; i <= GRANT_CACHE_MAX; i++)
      await service.requestGrant(ENV, caller, `I${i}`, null);
    calls = [];
    await service.requestGrant(ENV, caller, 'I0', null);
    expect(calls).toHaveLength(1);
    await service.requestGrant(ENV, caller, `I${GRANT_CACHE_MAX}`, null);
    expect(calls).toHaveLength(1);
  });

  it('has no index without an origin', async () => {
    expect(await service.requestGrant({}, { kind: 'bearer', token: 't' }, 'I', null)).toEqual({
      ok: false,
      status: 503,
      error: 'index_unavailable',
    });
    expect(service.appClient({ INDEX_ORIGIN: 'https://x' })).toBeNull();
  });
});

describe('createItemGrant', () => {
  const caller = { kind: 'delegate', personId: 'user_a', teams: [] } as const;
  const created = (req: Request) =>
    new URL(req.url).pathname.endsWith('/items')
      ? Response.json(
          {
            item: { id: 'N' },
            grant: { grant: grantOf({ item: 'N' }), level: 'edit', tabId: null, expiresAt: 0 },
          },
          { status: 201 },
        )
      : answer(req);

  it('makes the item under the minted id and answers its grant', async () => {
    const before = answer;
    answer = created;
    const grant = await createItemGrant(service, ENV, req(), caller, 'N', {
      title: 'Plan',
      intent: 'kanban',
      source: itemSourceOf('mcp'),
    });
    answer = before;
    expect(grant).toMatchObject({
      grant: { item: 'N', level: 'edit', shareCode: null },
      item: { id: 'N' },
    });
    expect(calls).toHaveLength(1);
    expect(await calls[0]!.json()).toEqual({
      title: 'Plan',
      intent: 'kanban',
      source: 'ai',
      id: 'N',
      app: 'livedocuments',
    });
  });

  it("re-committing the caller's own id reads its grant; another refusal is answered", async () => {
    answer = (r) =>
      new URL(r.url).pathname.endsWith('/items')
        ? Response.json({ error: 'item_exists' }, { status: 409 })
        : Response.json({
            grant: grantOf({ item: 'N', level: 'edit' }),
            level: 'edit',
            tabId: null,
            expiresAt: (NOW_S + 600) * 1000,
          });
    expect(await createItemGrant(service, ENV, req(), caller, 'N', {})).toEqual({
      grant: expect.objectContaining({ item: 'N', level: 'edit' }),
      item: null,
    });
    answer = () => Response.json({ error: 'not_team_member' }, { status: 403 });
    const res = await createItemGrant(service, ENV, req(), caller, 'M', { teamId: 't' });
    expect((res as Response).status).toBe(403);
    expect(await (res as Response).json()).toEqual({ error: 'not_team_member' });
  });

  it('answers 503 without an index, and when it cannot be reached', async () => {
    expect(((await createItemGrant(service, {}, req(), caller, 'N', {})) as Response).status).toBe(
      503,
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    answer = () => {
      throw new TypeError('network');
    };
    expect(((await createItemGrant(service, ENV, req(), caller, 'N', {})) as Response).status).toBe(
      503,
    );
  });

  it('maps provenance', () => {
    expect(itemSourceOf('mcp')).toBe('ai');
    expect(itemSourceOf('cli')).toBe('import');
    expect(itemSourceOf('drive')).toBeNull();
    expect(itemSourceOf(undefined)).toBeNull();
  });
});
