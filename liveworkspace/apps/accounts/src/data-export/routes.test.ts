// Download Your Data's doors on accounts (liveworkspace/docs/specs/003-accounts/data-export.md): who may start and see
// which export, one at a time, the emailed link's checks, the service's call back and the email, and an account
// closing.
import type { ExportView, StartExportCall } from '@liveworkspace/data-export';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAccountApi } from '../account-api.ts';
import type { Auth } from '../auth.ts';
import type { Env } from '../env.ts';
import { addUser, testD1 } from '../test-d1.ts';
import { linkUrl } from './link.ts';
import {
  handleDataExport,
  handleDataExportDownload,
  handleDataExportReady,
  removePersonalExport,
  type Signed,
} from './routes.ts';
import { exportService, ServiceError, type ExportService } from './service.ts';

const BASE = 'https://liveworkspace.app';
const SECRET = 'better-auth-secret';
const NOW = Date.UTC(2026, 10, 1, 12);
const DAY = 24 * 60 * 60 * 1000;

let env: Env;
let sql: ReturnType<typeof testD1>['sql'];
let sent: { to: string; subject: string; text: string; html: string }[];
let signedIn: { id: string; name: string; email: string; emailVerified: boolean } | null;

const ADA: Signed = { id: 'user_ada', name: 'Ada', email: 'ada@example.com' };
const BEA: Signed = { id: 'user_bea', name: 'Bea', email: 'bea@example.com' };

function view(overrides: Partial<ExportView> = {}): ExportView {
  return {
    id: 'ex_1',
    status: 'ready',
    phase: null,
    requestedBy: 'user_ada',
    startedAt: NOW - 1000,
    finishedAt: NOW - 500,
    expiresAt: NOW + 3 * DAY,
    itemsTotal: 3,
    itemsDone: 3,
    imagesTotal: 1,
    imagesDone: 1,
    bytes: 2_400_000,
    leftOut: 0,
    problems: 0,
    ...overrides,
  };
}

// The export service as a map of key to view, with its calls recorded.
function fakeService(views: Record<string, ExportView | null> = {}) {
  const started: StartExportCall[] = [];
  const removed: string[] = [];
  const service: ExportService & {
    views: typeof views;
    started: typeof started;
    removed: typeof removed;
  } = {
    views,
    started,
    removed,
    async start(call) {
      if (views[call.key]?.status === 'running') return { ok: false, error: 'export_running' };
      started.push(call);
      const v = view({
        status: 'running',
        phase: 'listing',
        requestedBy: call.requestedBy,
        expiresAt: null,
      });
      views[call.key] = v;
      return { ok: true, view: v };
    },
    async status(keys) {
      return Object.fromEntries(keys.map((k) => [k, views[k] ?? null]));
    },
    async file(key) {
      const v = views[key];
      if (!v || v.status !== 'ready') return null;
      return { body: new Blob(['PK-zip']).stream(), size: 6, exportId: v.id };
    },
    async remove(key) {
      removed.push(key);
    },
  };
  return service;
}

function addTeam(
  id: string,
  name: string,
  members: { userId: string; role: 'admin' | 'member' }[],
  deleted = false,
) {
  sql
    .prepare(
      `INSERT INTO team (id, name, createdAt, updatedAt, rev, deletedAt) VALUES (?, ?, 1, 1, 1, ?)`,
    )
    .run(id, name, deleted ? 2 : null);
  for (const m of members) {
    sql
      .prepare(
        `INSERT INTO team_member (id, teamId, userId, email, role, status, createdAt, updatedAt, rev)
         VALUES (?, ?, ?, ?, ?, 'joined', 1, 1, 1)`,
      )
      .run(`${id}-${m.userId}`, id, m.userId, `${m.userId}@example.com`, m.role);
  }
}

beforeEach(() => {
  const d1 = testD1();
  sql = d1.sql;
  addUser(sql, { id: 'user_ada', email: 'Ada@Example.com', name: 'Ada' });
  addUser(sql, { id: 'user_bea', email: 'bea@example.com', name: 'Bea' });
  addUser(sql, { id: 'user_cy', email: 'cy@example.com', name: 'Cy', verified: false });
  addTeam('team-design', 'Design', [
    { userId: 'user_ada', role: 'admin' },
    { userId: 'user_bea', role: 'member' },
  ]);
  addTeam('team-gone', 'Gone', [{ userId: 'user_ada', role: 'admin' }], true);
  sent = [];
  env = {
    BASE_URL: BASE,
    BETTER_AUTH_SECRET: SECRET,
    EMAIL_FROM: 'sign-in@liveworkspace.app',
    ENVIRONMENT: 'production',
    AUTH_DB: d1.db,
    EXPORT_KEY_ACCOUNTS: 'export-key',
    EMAIL: {
      send: async (m: { to: string; subject: string; text: string; html: string }) => {
        sent.push(m);
        return { messageId: 'm' };
      },
    } as unknown as SendEmail,
  } as unknown as Env;
  signedIn = { id: 'user_ada', name: 'Ada', email: 'ada@example.com', emailVerified: true };
});

afterEach(() => vi.restoreAllMocks());

const get = (path = '/api/account/data-export') => new Request(`${BASE}${path}`);
const post = (body: unknown = {}) =>
  new Request(`${BASE}/api/account/data-export`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('the state Settings draws', () => {
  it('answers my export with its link, and each team I run, never one I only belong to', async () => {
    const service = fakeService({
      'personal:user_ada': view(),
      'team:team-design': view({ id: 'ex_t', requestedBy: 'user_zed' }),
    });
    const res = await handleDataExport(get(), env, ADA, { service, now: NOW });
    const state = (await res.json()) as {
      personal: ExportView;
      teams: { id: string; name: string; export: ExportView }[];
    };
    expect(state.personal.downloadUrl).toContain(
      '/api/account/data-export/download?key=personal%3Auser_ada&id=ex_1',
    );
    expect(state.teams).toHaveLength(1);
    expect(state.teams[0]).toMatchObject({ id: 'team-design', name: 'Design' });
    // Any admin may download the team's, whoever started it.
    expect(state.teams[0]!.export.downloadUrl).toContain('team%3Ateam-design');

    const bea = await handleDataExport(get(), env, BEA, { service, now: NOW });
    expect(await bea.json()).toEqual({ personal: null, teams: [] });
  });

  it('gives no link to one running, failed or lapsed', async () => {
    for (const v of [
      view({ status: 'running', expiresAt: null }),
      view({ status: 'failed' }),
      view({ expiresAt: NOW }),
    ]) {
      const service = fakeService({ 'personal:user_ada': v });
      const state = (await (
        await handleDataExport(get(), env, ADA, { service, now: NOW })
      ).json()) as {
        personal: ExportView;
      };
      expect(state.personal.downloadUrl).toBeUndefined();
    }
  });

  it('answers 503 without the service, and 404 for another method', async () => {
    expect((await handleDataExport(get(), env, ADA, { service: null })).status).toBe(503);
    expect((await handleDataExport(get(), env, ADA)).status).toBe(503);
    const put = new Request(`${BASE}/api/account/data-export`, { method: 'PUT' });
    expect((await handleDataExport(put, env, ADA, { service: fakeService() })).status).toBe(404);
  });
});

describe('starting an export', () => {
  it('starts mine with my profile, teams and settings', async () => {
    const service = fakeService();
    const res = await handleDataExport(post(), env, ADA, { service, now: NOW });
    expect(res.status).toBe(202);
    expect(service.started[0]).toMatchObject({
      key: 'personal:user_ada',
      requestedBy: 'user_ada',
      scope: { kind: 'personal', personId: 'user_ada' },
      profile: {
        account: { id: 'user_ada', name: 'Ada', email: 'Ada@Example.com' },
        teams: [{ id: 'team-design', name: 'Design', role: 'admin' }],
        settings: {},
      },
    });
  });

  it('starts a team’s for its admin, and refuses a member, a deleted team and a bad id', async () => {
    const service = fakeService();
    expect(
      (await handleDataExport(post({ team: 'team-design' }), env, ADA, { service })).status,
    ).toBe(202);
    expect(service.started[0]).toEqual({
      key: 'team:team-design',
      requestedBy: 'user_ada',
      scope: { kind: 'team', teamId: 'team-design', teamName: 'Design' },
    });
    expect(
      (await handleDataExport(post({ team: 'team-design' }), env, BEA, { service })).status,
    ).toBe(403);
    expect(
      (await handleDataExport(post({ team: 'team-gone' }), env, ADA, { service })).status,
    ).toBe(403);
    expect((await handleDataExport(post({ team: 'bad id' }), env, ADA, { service })).status).toBe(
      400,
    );
    expect((await handleDataExport(post({ team: 5 }), env, ADA, { service })).status).toBe(400);
    // A body that isn't JSON starts mine.
    expect((await handleDataExport(post('nope'), env, BEA, { service })).status).toBe(202);
  });

  it('refuses a second while one I started runs, in any scope, and while another admin’s runs there', async () => {
    const service = fakeService({
      'team:team-design': view({ status: 'running', expiresAt: null }),
    });
    expect((await handleDataExport(post(), env, ADA, { service })).status).toBe(409);
    // Bea runs no team, so her own goes ahead.
    expect((await handleDataExport(post(), env, BEA, { service })).status).toBe(202);
    service.views['team:team-design'] = view({
      status: 'running',
      requestedBy: 'user_zed',
      expiresAt: null,
    });
    const res = await handleDataExport(post({ team: 'team-design' }), env, ADA, { service });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'export_running' });
    // Mine may start meanwhile: the running one isn't mine.
    expect((await handleDataExport(post(), env, ADA, { service })).status).toBe(202);
  });
});

describe('the emailed link', () => {
  const session = (who: Signed | null) => async () => who;
  const link = (
    facts: Partial<{ forPerson: string; key: string; exportId: string; expiresAt: number }> = {},
  ) =>
    linkUrl(BASE, SECRET, {
      forPerson: 'user_ada',
      key: 'personal:user_ada',
      exportId: 'ex_1',
      expiresAt: NOW + DAY,
      ...facts,
    });
  const open = async (
    url: string,
    who: Signed | null = ADA,
    service = fakeService({ 'personal:user_ada': view() }),
  ) => handleDataExportDownload(new Request(url), env, session(who), { service, now: NOW });
  const refusedFor = async (res: Response) =>
    new URL(res.headers.get('Location')!).searchParams.get('export');

  it('streams the zip to the person it was made for', async () => {
    const res = await open(await link());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="liveworkspace-data-2026-11-01.zip"',
    );
    expect(res.headers.get('Content-Length')).toBe('6');
    expect(await res.text()).toBe('PK-zip');
  });

  it('sends someone signed out to sign in, and back', async () => {
    const url = await link();
    const res = await open(url, null);
    expect(res.status).toBe(302);
    const to = new URL(res.headers.get('Location')!);
    expect(to.pathname).toBe('/sign-in');
    expect(to.searchParams.get('return')).toBe(new URL(url).pathname + new URL(url).search);
  });

  it('sends a link for someone else, a changed one, a lapsed one and a replaced one to Settings', async () => {
    expect(await refusedFor(await open(await link(), BEA))).toBe('other-account');
    const changed = (await link()).replace('ex_1', 'ex_2');
    expect(await refusedFor(await open(changed))).toBe('other-account');
    expect(await refusedFor(await open(await link({ expiresAt: NOW })))).toBe('expired');
    const replaced = fakeService({ 'personal:user_ada': view({ id: 'ex_9' }) });
    expect(await refusedFor(await open(await link(), ADA, replaced))).toBe('missing');
    expect(await refusedFor(await open(await link(), ADA, fakeService()))).toBe('expired');
    expect(await refusedFor(await open(`${BASE}/api/account/data-export/download?key=x`))).toBe(
      'missing',
    );
    expect(await refusedFor(await open(`${BASE}/api/account/data-export/download`))).toBe(
      'missing',
    );
    const res = await open(await link());
    expect(res.headers.get('Location')).toBeNull();
  });

  it('opens a team’s for an admin still, never for someone who isn’t one now', async () => {
    const service = fakeService({ 'team:team-design': view({ id: 'ex_t' }) });
    const team = { key: 'team:team-design', exportId: 'ex_t' };
    expect((await open(await link(team), ADA, service)).status).toBe(200);
    expect(
      await refusedFor(await open(await link({ ...team, forPerson: 'user_bea' }), BEA, service)),
    ).toBe('other-account');
    // Someone else's personal key, signed for me, is still not mine.
    expect(
      await refusedFor(await open(await link({ key: 'personal:user_bea' }), ADA, service)),
    ).toBe('other-account');
  });

  it('answers 503 without the service', async () => {
    const res = await handleDataExportDownload(new Request(await link()), env, session(ADA), {
      service: null,
    });
    expect(res.status).toBe(503);
  });
});

describe('the service’s call back', () => {
  const ready = (body: unknown, key = 'export-key') =>
    handleDataExportReady(
      new Request(`${BASE}/api/account/internal/data-export/ready`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      }),
      env,
    );
  const call = {
    key: 'personal:user_ada',
    exportId: 'ex_1',
    requestedBy: 'user_ada',
    status: 'ready',
    bytes: 2_400_000,
    expiresAt: NOW + 3 * DAY,
    teamName: null,
  };

  it('emails the link when one is ready, to the account’s address', async () => {
    expect((await ready(call)).status).toBe(204);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('ada@example.com');
    expect(sent[0]!.subject).toBe('Your liveworkspace data is ready');
    expect(sent[0]!.text).toContain('2.4 MB');
    expect(sent[0]!.text).toContain(
      '/api/account/data-export/download?key=personal%3Auser_ada&id=ex_1',
    );
    expect(sent[0]!.text).toContain('only when you’re signed in as ada@example.com');
  });

  it('names the team, and says when one failed', async () => {
    await ready({ ...call, key: 'team:team-design', teamName: 'Design' });
    expect(sent[0]!.subject).toBe('Design’s liveworkspace data is ready');
    await ready({ ...call, status: 'failed', expiresAt: null });
    expect(sent[1]!.subject).toBe('Your liveworkspace data couldn’t be downloaded');
    expect(sent[1]!.text).toContain('/explorer?settings=data');
    await ready({ ...call, status: 'failed', expiresAt: null, teamName: 'Design' });
    expect(sent[2]!.subject).toBe('Design’s liveworkspace data couldn’t be downloaded');
    expect(sent[2]!.text).toContain('put together Design’s data');
  });

  it('sends nothing for an account that is gone or has no address', async () => {
    expect((await ready({ ...call, requestedBy: 'user_gone' })).status).toBe(204);
    expect((await ready({ ...call, requestedBy: 'user_cy' })).status).toBe(204);
    expect(sent).toHaveLength(0);
  });

  it('refuses a wrong key, a bad body, and is a 404 without its key or for GET', async () => {
    expect((await ready(call, 'nope')).status).toBe(401);
    expect((await ready({ ...call, status: 'odd' })).status).toBe(400);
    expect((await ready({ ...call, expiresAt: null })).status).toBe(400);
    expect((await ready({ ...call, key: 'x' })).status).toBe(400);
    expect((await ready(null)).status).toBe(400);
    expect((await ready({ ...call, bytes: 'x', teamName: 5 })).status).toBe(204);
    const noAuth = new Request(`${BASE}/api/account/internal/data-export/ready`, {
      method: 'POST',
      body: '{}',
    });
    expect((await handleDataExportReady(noAuth, env)).status).toBe(401);
    expect((await handleDataExportReady(new Request(`${BASE}/x`), env)).status).toBe(404);
    env.EXPORT_KEY_ACCOUNTS = undefined;
    expect((await ready(call)).status).toBe(404);
  });
});

describe('through the account API', () => {
  const auth = {
    api: { getSession: async () => (signedIn ? { user: signedIn, session: {} } : null) },
  } as unknown as Auth;
  const binding = (answer: (url: string, init?: RequestInit) => Response) =>
    ({
      fetch: vi.fn(async (url: string, init?: RequestInit) => answer(url, init)),
    }) as unknown as Fetcher;

  it('routes the state, the link and the call back', async () => {
    env.EXPORT = binding((url) =>
      url.endsWith('/status')
        ? Response.json({ exports: {} })
        : new Response(null, { status: 404 }),
    );
    const state = await handleAccountApi(get(), env, auth);
    expect(await state.json()).toEqual({
      personal: null,
      teams: [{ id: 'team-design', name: 'Design', export: null }],
    });
    signedIn = null;
    expect((await handleAccountApi(get(), env, auth)).status).toBe(401);
    const download = await handleAccountApi(
      get('/api/account/data-export/download?key=personal:user_ada'),
      env,
      auth,
    );
    expect(download.headers.get('Location')).toContain('/sign-in?return=');
    const ready = await handleAccountApi(
      new Request(`${BASE}/api/account/internal/data-export/ready`, {
        method: 'POST',
        headers: { Authorization: 'Bearer nope' },
      }),
      env,
      auth,
    );
    expect(ready.status).toBe(401);
  });
});

describe('the service client', () => {
  type Seen = { url: string; init?: RequestInit };
  const client = (answer: (seen: Seen) => Response) => {
    const seen: Seen[] = [];
    const service = exportService({
      EXPORT_KEY_ACCOUNTS: ' export-key ',
      EXPORT: {
        fetch: async (url: string, init?: RequestInit) => {
          seen.push({ url, init });
          return answer({ url, init });
        },
      } as unknown as Fetcher,
    })!;
    return { service, seen };
  };

  it('is none without its binding or key', () => {
    expect(exportService({})).toBeNull();
    expect(exportService({ EXPORT: {} as Fetcher, EXPORT_KEY_ACCOUNTS: ' ' })).toBeNull();
  });

  it('starts, reads, streams and removes, with its key', async () => {
    const { service, seen } = client(({ url, init }) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (url.endsWith('/status')) return Response.json({ exports: { 'personal:a': null } });
      if (url.endsWith('/file'))
        return new Response('zip', { headers: { 'Content-Length': '3', 'X-Export-Id': 'ex' } });
      return Response.json({ export: view() }, { status: 202 });
    });
    expect(
      await service.start({
        key: 'personal:a',
        requestedBy: 'a',
        scope: { kind: 'personal', personId: 'a' },
      }),
    ).toEqual({
      ok: true,
      view: view(),
    });
    expect(await service.status(['personal:a'])).toEqual({ 'personal:a': null });
    const file = (await service.file('team:t 1'))!;
    expect(file).toMatchObject({ size: 3, exportId: 'ex' });
    expect(await new Response(file.body).text()).toBe('zip');
    await service.remove('team:t');
    expect(seen.map((s) => s.url)).toEqual([
      'https://export/internal/exports',
      'https://export/internal/exports/status',
      'https://export/internal/exports/team%3At%201/file',
      'https://export/internal/exports/team%3At',
    ]);
    expect(new Headers(seen[0]!.init?.headers).get('Authorization')).toBe('Bearer export-key');
  });

  it('answers a running export, none ready, and fails on anything else', async () => {
    let status = 409;
    const { service } = client(() => new Response(status === 200 ? 'x' : null, { status }));
    expect(
      await service.start({
        key: 'personal:a',
        requestedBy: 'a',
        scope: { kind: 'personal', personId: 'a' },
      }),
    ).toEqual({
      ok: false,
      error: 'export_running',
    });
    status = 404;
    expect(await service.file('personal:a')).toBeNull();
    status = 500;
    await expect(
      service.start({
        key: 'personal:a',
        requestedBy: 'a',
        scope: { kind: 'personal', personId: 'a' },
      }),
    ).rejects.toThrow(ServiceError);
    await expect(service.status([])).rejects.toThrow('export service 500');
    await expect(service.remove('personal:a')).rejects.toThrow('export service 500');
    const { service: broken } = client(() => new Response('x', { status: 502 }));
    await expect(broken.file('personal:a')).rejects.toThrow('export service 502');
    const { service: bare } = client(() => new Response('zip'));
    expect(await bare.file('personal:a')).toMatchObject({ size: 0, exportId: '' });
  });

  it('removes a closed account’s export, and never throws', async () => {
    const { seen } = client(() => new Response(null, { status: 204 }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await removePersonalExport({}, 'user_ada');
    const fetcher = {
      fetch: async () => new Response(null, { status: 500 }),
    } as unknown as Fetcher;
    await removePersonalExport({ EXPORT: fetcher, EXPORT_KEY_ACCOUNTS: 'k' }, 'user_ada');
    expect(warn).toHaveBeenCalledWith('[data-export] removing a closed account’s export failed', {
      error: 'ServiceError',
    });
    const ok = {
      fetch: vi.fn(async () => new Response(null, { status: 204 })),
    } as unknown as Fetcher;
    await removePersonalExport({ EXPORT: ok, EXPORT_KEY_ACCOUNTS: 'k' }, 'user_ada');
    expect((ok.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      'https://export/internal/exports/personal%3Auser_ada',
    );
    expect(seen).toHaveLength(0);
  });
});
