// Suites every product's api runs over its own modules: the tests were the same file in each, differing only in the
// product's name, what it calls its items and which room binding it has. A product's test file calls one with its
// facts and keeps nothing else.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** GET /api/teams/invites (each product's docs/specs/013-workspace/teams.md "Invitations"): the invitations waiting
 *  on liveworkspace.app, read through pendingInvitationsFor. Each test asks for its own account, since the answer is
 *  remembered per account for 30 seconds. */
export function describeTeamInvites<Ctx>(f: {
  /** The product's accounts client id: its name. */
  app: string;
  handleTeams: (ctx: Ctx) => Promise<Response>;
  makeTestRouteContext(method: string, path: string, opts: Record<string, unknown>): Ctx;
}): void {
  type Env = Record<string, string>;
  const ACCOUNTS = {
    ACCOUNTS_URL: 'https://accounts.test',
    ACCOUNTS_CLIENT_ID: f.app,
    ACCOUNTS_CLIENT_SECRET: 'secret',
  };

  const waiting = {
    id: 'member_1',
    teamId: 'team_1',
    teamName: 'Design',
    organisation: 'Acme',
    memberCount: 3,
    role: 'member',
    invitedByName: 'Ada',
    createdAt: 1000,
  };

  let calls: { url: string; body: unknown }[];
  let answer: () => Response;

  beforeEach(() => {
    calls = [];
    answer = () => Response.json({ invitations: [waiting] });
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return answer();
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const ask = (user: string, opts: { session?: boolean; env?: Env } = {}) =>
    f.handleTeams(
      f.makeTestRouteContext('GET', '/api/teams/invites', {
        owner: user,
        accountUserId: opts.session === false ? null : user,
        verifiedUserId: user,
        env: opts.env ?? ACCOUNTS,
      }),
    );

  describe('GET /api/teams/invites', () => {
    it('lists the invitations waiting on liveworkspace.app, as the Invites view reads them', async () => {
      const res = await ask('user_a');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        invites: [
          {
            memberId: 'member_1',
            team: {
              id: 'team_1',
              name: 'Design',
              organisation: 'Acme',
              createdAt: 1000,
              updatedAt: 1000,
            },
            memberCount: 3,
            invitedAt: 1000,
            role: 'member',
            invitedByName: 'Ada',
          },
        ],
      });
      expect(calls).toEqual([
        {
          url: 'https://accounts.test/api/account/internal/invitations',
          body: { userId: 'user_a' },
        },
      ]);
    });

    it('asks liveworkspace once for an Explorer load, however many surfaces ask', async () => {
      await Promise.all([ask('user_b'), ask('user_b')]);
      await ask('user_b');
      expect(calls).toHaveLength(1);
    });

    it('answers an API token’s owner too', async () => {
      const res = await ask('user_c', { session: false });
      const body: { invites: unknown[] } = await res.json();
      expect(body.invites).toHaveLength(1);
    });

    it('is empty, not an error, without accounts or with liveworkspace out of reach', async () => {
      expect(await (await ask('user_d', { env: {} })).json()).toEqual({ invites: [] });
      expect(calls).toHaveLength(0);
      answer = () => new Response(null, { status: 503 });
      const res = await ask('user_e');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ invites: [] });
    });

    it('takes no other method', async () => {
      const res = await f.handleTeams(
        f.makeTestRouteContext('POST', '/api/teams/invites', {
          owner: 'user_f',
          accountUserId: 'user_f',
          env: ACCOUNTS,
          body: {},
        }),
      );
      expect(res.status).toBe(404);
    });
  });
}

/** The two doors no identity opens (each product's docs/specs/013-workspace/automations.md; blueprint automations.md
 *  "Routes"): an Incoming Webhook call and a rule email's unsubscribe, answered by the worker before identity.
 *  Everything a stranger can get wrong is refused before the item's room is asked anything. */
export function describeAutomationDoors(f: {
  worker: { fetch(request: Request, env: never): Response | Promise<Response> };
  /** The room's Durable Object binding, as the product's wrangler.toml names it (`DOCUMENT_ROOM`). */
  roomBinding: string;
}): void {
  afterEach(() => vi.restoreAllMocks());

  function world(limited = false) {
    const calls: unknown[][] = [];
    const room = {
      incomingHook: async (...args: unknown[]) => {
        calls.push(['incomingHook', ...args]);
        return { status: 202, body: { queued: 1 } };
      },
      emailOptOut: async (...args: unknown[]) => {
        calls.push(['emailOptOut', ...args]);
        return args[1] === 'good-token';
      },
    };
    const limiter: string[] = [];
    const env = {
      [f.roomBinding]: { idFromName: (name: string) => name, get: () => room },
      WRITE_RATE_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          limiter.push(key);
          return { success: !limited };
        },
      },
    };
    const send = (path: string, init: RequestInit = {}) =>
      f.worker.fetch(new Request(`https://api.test${path}`, init), env as never);
    return { calls, limiter, send };
  }

  const JSON_POST = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer lwh_secret' },
    body: JSON.stringify({ version: '2.4' }),
  };

  describe('POST /api/hooks/automations/:itemId/:ruleId', () => {
    it('hands the call to the item’s room and answers what it says, never read as a person', async () => {
      const w = world();
      vi.spyOn(console, 'info').mockImplementation(() => undefined);
      const res = await w.send('/api/hooks/automations/doc-1/rule-1', JSON_POST);
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ queued: 1 });
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      const [method, itemId, ruleId, call] = w.calls[0] as [
        string,
        string,
        string,
        { body: Uint8Array; authorization: string },
      ];
      expect([method, itemId, ruleId]).toEqual(['incomingHook', 'doc-1', 'rule-1']);
      expect(new TextDecoder().decode(call.body)).toBe('{"version":"2.4"}');
      expect(call.authorization).toBe('Bearer lwh_secret');
      // One network's calls share a budget of their own.
      expect(w.limiter).toHaveLength(1);
      expect(w.limiter[0]).toMatch(/^hook:/);
    });

    it('refuses the wrong address, method, type and size before the room is asked', async () => {
      const w = world();
      const refusals: [string, RequestInit, number][] = [
        ['/api/hooks/automations/doc-1', JSON_POST, 404],
        ['/api/hooks/automations/doc-1/rule-1/more', JSON_POST, 404],
        ['/api/hooks/other/doc-1/rule-1', JSON_POST, 404],
        ['/api/hooks/automations/doc-1/rule-1', { method: 'GET' }, 405],
        [
          '/api/hooks/automations/doc-1/rule-1',
          { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hi' },
          415,
        ],
        [
          '/api/hooks/automations/doc-1/rule-1',
          { ...JSON_POST, body: JSON.stringify({ big: 'x'.repeat(17 * 1024) }) },
          413,
        ],
      ];
      for (const [path, init, status] of refusals)
        expect((await w.send(path, init)).status, `${init.method} ${path}`).toBe(status);
      expect(w.calls).toEqual([]);
    });

    it('answers 429 past the network’s limit, with Retry-After, before the room is asked', async () => {
      const w = world(true);
      const res = await w.send('/api/hooks/automations/doc-1/rule-1', JSON_POST);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
      expect(w.calls).toEqual([]);
    });
  });

  describe('POST /api/email-optout/:itemId/:token', () => {
    it('unsubscribes the token’s address, and answers 404 for a token the item never made', async () => {
      const w = world();
      vi.spyOn(console, 'info').mockImplementation(() => undefined);
      const done = await w.send('/api/email-optout/doc-1/good-token', { method: 'POST' });
      expect(done.status).toBe(200);
      expect(await done.json()).toEqual({ unsubscribed: true });
      const missing = await w.send('/api/email-optout/doc-1/bad-token', { method: 'POST' });
      expect(missing.status).toBe(404);
      expect(await missing.json()).toEqual({ error: 'optout_not_found' });
      expect(w.limiter.every((key) => key.startsWith('optout:'))).toBe(true);
    });

    it('refuses a GET (a link scanner unsubscribes nobody), a wrong address, and a network past its limit', async () => {
      const w = world();
      expect((await w.send('/api/email-optout/doc-1/good-token')).status).toBe(405);
      expect((await w.send('/api/email-optout/doc-1', { method: 'POST' })).status).toBe(404);
      expect(w.calls).toEqual([]);
      const limited = world(true);
      const res = await limited.send('/api/email-optout/doc-1/good-token', { method: 'POST' });
      expect(res.status).toBe(429);
      expect(limited.calls).toEqual([]);
    });
  });
}

/** Workbench sessions are liveworkspace's (liveworkspace/docs/specs/011-workbench/workbench.md): the api asks accounts
 *  about each with its client credentials and reads the answer in its own words. The checking, caching, refusals and
 *  room notes are @liveworkspace/auth-client's, tested there; this holds the api's names for what a session reaches. */
export function describeWorkbenchSession(f: {
  app: string;
  /** What the product calls its items in a session's reach: `document`, `project`, `design`. */
  item: string;
  resolveWorkbenchSession(env: Record<string, string>, secret: string): Promise<unknown>;
  AccountsUnavailable: new (...args: never[]) => Error;
}): void {
  const ENV = {
    ACCOUNTS_URL: 'https://accounts.test',
    ACCOUNTS_CLIENT_ID: f.app,
    ACCOUNTS_CLIENT_SECRET: 'secret',
  };

  const CHECKED = {
    sessionId: 'sess-1234567',
    ownerId: 'user_1',
    tokenId: 'tok1',
    pairingId: 'pair1',
    scope: 'item',
    itemId: 'doc1',
    folderId: null,
    tabId: 't1',
    origin: 'https://w.example',
    level: 'edit',
    expiresAt: 1_900_000_000_000,
    teams: [{ id: 'team1', name: 'T', role: 'member' }],
  };

  let secretN = 0;
  // A fresh secret per test: the checker remembers answers for the life of the isolate.
  const secret = () => `lvw_${String(++secretN).padStart(43, 'a')}.${'f'.repeat(64)}`;

  function stubAccounts(respond: (path: string, body: Record<string, unknown>) => Response) {
    const calls: { path: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
        string,
        unknown
      >;
      calls.push({ path: url.pathname, body });
      return respond(url.pathname, body);
    });
    return calls;
  }

  afterEach(() => vi.unstubAllGlobals());

  describe('resolveWorkbenchSession', () => {
    it('reads an item session in the api’s own words', async () => {
      const calls = stubAccounts(() => Response.json(CHECKED));
      const s = secret();
      expect(await f.resolveWorkbenchSession(ENV, s)).toEqual({
        ok: true,
        workbench: {
          sessionId: 'sess-1234567',
          ownerId: 'user_1',
          tokenId: 'tok1',
          pairingId: 'pair1',
          scope: f.item,
          [`${f.item}Id`]: 'doc1',
          folderId: null,
          tabId: 't1',
          origin: 'https://w.example',
          level: 'edit',
          expiresAt: CHECKED.expiresAt,
          teams: CHECKED.teams,
        },
      });
      expect(calls).toEqual([
        { path: '/api/account/internal/workbench/session', body: { session: s } },
      ]);
      // Asked once a minute at most, however many requests the frame makes.
      await f.resolveWorkbenchSession(ENV, s);
      expect(calls).toHaveLength(1);
    });

    it('reads a workspace session with its folder and no item', async () => {
      stubAccounts(() =>
        Response.json({
          ...CHECKED,
          scope: 'workspace',
          itemId: null,
          folderId: 'fold1',
          tabId: null,
        }),
      );
      expect(await f.resolveWorkbenchSession(ENV, secret())).toMatchObject({
        ok: true,
        workbench: { scope: 'workspace', [`${f.item}Id`]: null, folderId: 'fold1' },
      });
    });

    it('is unavailable, in this api’s error, when accounts fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      stubAccounts(() => new Response(null, { status: 503 }));
      await expect(f.resolveWorkbenchSession(ENV, secret())).rejects.toBeInstanceOf(
        f.AccountsUnavailable,
      );
    });
  });
}
