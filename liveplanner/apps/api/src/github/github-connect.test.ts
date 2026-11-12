import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubConnectionResponse, GithubConnectStartResponse } from '@liveplanner/api-schema';
import { itemPersonId } from '@liveplanner/items';
import { ANONYMISED_ITEM_PERSON } from '../db/items';
import { USER } from '../plan-room/automations/test-automation-world';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { readConnection } from '../plan-room/github/github-store';
import { CONNECT_STATE_TTL_MS, CONNECT_STATES_MAX } from './github-config';
import {
  CLIENT_SECRET,
  connection,
  githubWorld,
  repo,
  type GithubWorld,
} from './test-github-world';

// Connecting a plan (docs/specs/026-plan/github-pull-requests.md "Connecting a repository"; blueprint "Part 2"): the
// start's one-time state, the callback that spends it, checks the installation as the person and as the App, revokes
// the person's token and keeps no token at all; choosing repositories again, checked against the installation; and
// disconnecting.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: GithubWorld;
let logged: string[];
beforeEach(async () => {
  logged = [];
  for (const level of ['info', 'warn', 'log', 'error', 'debug'] as const)
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(JSON.stringify(args));
    });
  w = await githubWorld(['A', 'B']);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

async function start(): Promise<string> {
  const res = await w.as('owner', 'POST', '/github/connect');
  expect(res.status).toBe(201);
  const { url } = await res.json<GithubConnectStartResponse>();
  const u = new URL(url);
  expect(`${u.origin}${u.pathname}`).toBe(
    'https://github.com/apps/liveplanner-test/installations/new',
  );
  return u.searchParams.get('state')!;
}

const callback = (query: Record<string, string>) =>
  w.raw(
    new Request(`https://api.test/api/github/callback?${new URLSearchParams(query).toString()}`),
  );

const back = async (state: string, extra: Record<string, string> = {}) => {
  const res = await callback({
    state,
    code: 'code123',
    installation_id: '7',
    setup_action: 'install',
    ...extra,
  });
  expect(res.status).toBe(302);
  expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  return res.headers.get('Location');
};

const view = async () =>
  (await (await w.as('owner', 'GET', '/github')).json<GithubConnectionResponse>()).connection;

// Every stored row of the plan, as text: where a token would show if one were kept.
const stored = (planId: string) => {
  const db = w.plans.get(planId)!.db;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  return JSON.stringify(tables.map((t) => db.prepare(`SELECT * FROM "${String(t.name)}"`).all()));
};

describe('the round trip', () => {
  it('connects the installation’s repositories the person can reach, and keeps no token', async () => {
    const state = await start();
    expect(state.startsWith('A.')).toBe(true);
    expect(await back(state)).toBe('https://www.liveplanner.app/project/A#github=connected');
    const c = await view();
    expect(c).toMatchObject({
      installationId: 7,
      account: 'acme',
      connectedBy: { name: expect.any(String) },
      repositories: [
        { id: 11, fullName: 'acme/repo-11', private: false, chosen: true },
        { id: 12, fullName: 'acme/secret', private: true, chosen: true },
      ],
    });
    expect(w.kv.keys()).toEqual(['installation:7:A', 'repo:11:A', 'repo:12:A']);
    // The person's token was used once and revoked at GitHub, with the client's own credentials.
    const revoke = w.ghCalls.find((c) => c.method === 'DELETE')!;
    expect(revoke.url).toBe('https://api.github.com/applications/Iv1.client/token');
    expect(JSON.parse(revoke.body)).toEqual({ access_token: 'gho_person_token' });
    expect(w.ghCalls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      'POST /login/oauth/access_token',
      'GET /user/installations/7/repositories',
      'DELETE /applications/Iv1.client/token',
      'GET /app/installations/7',
    ]);
    const text = stored('A');
    for (const secret of ['gho_person_token', 'code123', state.split('.')[1]!, CLIENT_SECRET])
      expect(text).not.toContain(secret);
    expect(logged.join('\n')).not.toContain('gho_person_token');
    expect(logged.join('\n')).not.toContain('code123');
  });

  it('spends the state once: the same callback again fails and changes nothing', async () => {
    const state = await start();
    await back(state);
    w.gh.userRepositories = [repo(99)];
    expect(await back(state)).toBe('https://www.liveplanner.app/project/A#github=failed');
    expect((await view())!.repositories.map((r) => r.id)).toEqual([11, 12]);
  });

  it('a state is good for 10 minutes', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const state = await start();
    vi.spyOn(Date, 'now').mockReturnValue(now + CONNECT_STATE_TTL_MS);
    expect(await back(state)).toMatch(/#github=failed$/);
    expect(w.ghCalls).toEqual([]);
  });

  it('a plan keeps its newest states only', async () => {
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1));
    const first = await start();
    for (let i = 0; i < CONNECT_STATES_MAX; i += 1) await start();
    expect(await back(first)).toMatch(/#github=failed$/);
  });

  it('a state is the plan’s own: another plan’s object knows nothing of it', async () => {
    const state = await start();
    expect(await back(`B.${state.split('.')[1]}`)).toBe(
      'https://www.liveplanner.app/project/B#github=failed',
    );
    expect(await readConnection(w.planEnv('B').PLAN_DB, 'B')).toBeNull();
  });

  it('fails, connecting nothing, when the person can’t reach the installation', async () => {
    w.gh.userRepositories = null;
    expect(await back(await start())).toMatch(/#github=failed$/);
    expect(await view()).toBeNull();
    expect(w.kv.keys()).toEqual([]);
    // Their token is revoked all the same.
    expect(w.ghCalls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('fails when GitHub refuses the code, or the installation is suspended or not the App’s', async () => {
    w.gh.token = null;
    expect(await back(await start())).toMatch(/#github=failed$/);
    w.gh.token = 'gho_person_token';
    w.gh.installation = { account: { login: 'acme' }, suspended_at: '2026-11-01T00:00:00Z' };
    expect(await back(await start())).toMatch(/#github=failed$/);
    w.gh.installation = null;
    expect(await back(await start())).toMatch(/#github=failed$/);
    expect(await view()).toBeNull();
  });

  it('fails when GitHub can’t be reached', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('network down');
    });
    expect(await back(await start())).toMatch(/#github=failed$/);
  });

  it('with more than 20 repositories, chooses none until an Editor does', async () => {
    w.gh.userRepositories = Array.from({ length: 21 }, (_, i) => repo(100 + i));
    await back(await start());
    const c = await view();
    expect(c!.repositories).toHaveLength(21);
    expect(c!.repositories.every((r) => !r.chosen)).toBe(true);
    expect(w.kv.keys()).toEqual(['installation:7:A']);
  });

  it('leaves out a repository already connected to 20 other plans', async () => {
    for (let i = 0; i < 20; i += 1) await w.kv.kv.put(`repo:11:other${i}`, '');
    await back(await start());
    expect((await view())!.repositories.map((r) => [r.id, r.chosen])).toEqual([
      [11, false],
      [12, true],
    ]);
  });

  it('replaces an earlier connection, its keys with it', async () => {
    await w.seed('A', connection(5, [{ id: 50 }]));
    await back(await start());
    expect(w.kv.keys()).toEqual(['installation:7:A', 'repo:11:A', 'repo:12:A']);
  });

  it('an organisation install waiting for approval goes back to the plan without asking it', async () => {
    const state = await start();
    expect(await back(state, { setup_action: 'request', code: '' })).toBe(
      'https://www.liveplanner.app/project/A#github=requested',
    );
    // The state was not spent.
    expect(await back(state)).toMatch(/#github=connected$/);
  });

  it('refuses a callback whose state is not one, and fails one with no code or installation', async () => {
    for (const state of ['', 'A', '.abc', `A.${'x'.repeat(42)}`, `A/B.${'x'.repeat(43)}`]) {
      const res = await callback({ state, code: 'c', installation_id: '7' });
      expect(res.status, state).toBe(400);
    }
    const state = await start();
    expect(await back(state, { installation_id: 'x' })).toMatch(/#github=failed$/);
    expect(await back(state, { code: 'bad code' })).toMatch(/#github=failed$/);
    expect(
      (await w.raw(new Request('https://api.test/api/github/callback', { method: 'POST' }))).status,
    ).toBe(405);
  });
});

describe('choosing repositories', () => {
  beforeEach(async () => {
    w.gh.userRepositories = Array.from({ length: 21 }, (_, i) => repo(100 + i));
    w.gh.installationRepositories = w.gh.userRepositories;
    await back(await start());
    w.ghCalls.length = 0;
  });

  const choose = (ids: unknown) => w.as('owner', 'PUT', '/github/repositories', { ids });

  it('connects the ones chosen, checked against the installation as the App', async () => {
    const res = await choose([100, 101]);
    expect(res.status).toBe(200);
    const { connection: c } = await res.json<GithubConnectionResponse>();
    expect(c!.repositories.filter((r) => r.chosen).map((r) => r.id)).toEqual([100, 101]);
    expect(w.kv.keys()).toEqual(['installation:7:A', 'repo:100:A', 'repo:101:A']);
    expect(w.ghCalls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      'POST /app/installations/7/access_tokens',
      'GET /installation/repositories',
    ]);
    // The installation token asks for metadata alone, and is kept nowhere.
    expect(JSON.parse(w.ghCalls[0]!.body)).toEqual({ permissions: { metadata: 'read' } });
    expect(stored('A')).not.toContain('ghs_installation_token');
    // And choosing again moves the keys.
    await choose([102]);
    expect(w.kv.keys()).toEqual(['installation:7:A', 'repo:102:A']);
    await choose([]);
    expect(w.kv.keys()).toEqual(['installation:7:A']);
  });

  it('refuses ids it does not list, too many, repeats or odd shapes', async () => {
    for (const ids of [
      [999],
      Array.from({ length: 21 }, (_, i) => 100 + i),
      [100, 100],
      ['100'],
      100,
      [1.5],
      [-1],
    ]) {
      const res = await choose(ids);
      expect(res.status, JSON.stringify(ids)).toBe(400);
    }
    expect((await w.as('owner', 'PUT', '/github/repositories', 'nope')).status).toBe(400);
    expect(w.ghCalls).toEqual([]);
  });

  it('refuses a repository the installation no longer sees, or that is full', async () => {
    w.gh.installationRepositories = [repo(101)];
    const gone = await choose([100]);
    expect(gone.status).toBe(409);
    expect(await gone.json()).toEqual({ error: 'github_repository_gone' });
    for (let i = 0; i < 20; i += 1) await w.kv.kv.put(`repo:101:other${i}`, '');
    const full = await choose([101]);
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: 'github_repository_full' });
  });

  it('answers 502 when the installation can’t be read', async () => {
    w.gh.installationToken = null;
    expect((await choose([100])).status).toBe(502);
    w.gh.installationToken = 'ghs_installation_token';
    w.gh.installationRepositories = null;
    expect((await choose([100])).status).toBe(502);
  });

  it('needs a connection', async () => {
    await w.as('owner', 'DELETE', '/github');
    const res = await choose([100]);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'github_not_connected' });
  });
});

describe('disconnecting', () => {
  it('drops the connection and its keys; again, it is still 204', async () => {
    await back(await start());
    expect((await w.as('owner', 'DELETE', '/github')).status).toBe(204);
    expect(await view()).toBeNull();
    expect(w.kv.keys()).toEqual([]);
    expect((await w.as('owner', 'DELETE', '/github')).status).toBe(204);
  });

  it('a plan going for good takes its keys with it', async () => {
    await back(await start());
    await w.plans.get('A')!.room.purge('A');
    expect(w.kv.keys()).toEqual([]);
  });

  it('a closed account’s name leaves the connection', async () => {
    await back(await start());
    const by = (await view())!.connectedBy;
    expect(by.id).toBe(await itemPersonId(USER));
    expect(await w.plans.get('A')!.room.anonymise('A', USER)).toBeGreaterThan(0);
    expect((await view())!.connectedBy).toEqual({
      id: ANONYMISED_ITEM_PERSON.id,
      name: ANONYMISED_ITEM_PERSON.name,
    });
  });
});

describe('the routes', () => {
  it('answer 405 to a verb they lack and leave other paths alone', async () => {
    expect((await w.as('owner', 'POST', '/github')).status).toBe(405);
    expect((await w.as('owner', 'GET', '/github/connect')).status).toBe(405);
    expect((await w.as('owner', 'GET', '/github/repositories')).status).toBe(405);
    expect((await w.as('owner', 'GET', '/github/other')).status).toBe(404);
    expect((await w.as('owner', 'GET', '/github/a/b')).status).toBe(404);
  });
});
