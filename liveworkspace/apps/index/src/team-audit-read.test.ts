// The team audit log's read (team-audit-log.md "Who reads it"): a team's admins alone, checked against accounts
// now; filters by person, kind and date, keyset pages, people named by accounts (members who left included), and the
// CSV export, its cap and where the next file starts.
import {
  TEAM_AUDIT_CSV_MAX,
  type TeamAuditEvent,
  type TeamAuditPage,
} from '@liveworkspace/index-client';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import type { SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Person } from './auth';
import type { PersonContext } from './context';
import {
  CSV_READ_CHUNK,
  handleTeamAudit,
  pageQuery,
  type TeamAuditFilter,
} from './team-audit-read';
import { body, call, h, makeItem, person, useHarness, type AppCall } from './test-support';
import { accountsPeopleNames, NAMES_PER_CALL } from './webhooks/access';
import { answerWorld, newWorld, type World } from './webhooks/test-webhooks';

useHarness();

let world: World;
// Each account's display name as accounts answers now; an id missing is unknown to it.
let names: Record<string, string>;
let namesDown: boolean;
const namesCalls = () => h.appCalls.filter((c) => c.url.endsWith('/api/account/index/people'));

beforeEach(() => {
  world = newWorld();
  names = {};
  namesDown = false;
  answerWorld(world, (c: AppCall) => {
    if (c.url.endsWith('/api/account/index/people')) {
      if (namesDown) return new Response(null, { status: 503 });
      const ids = (c.body as { ids: string[] }).ids;
      expect(ids.length).toBeLessThanOrEqual(NAMES_PER_CALL);
      return Response.json({
        people: ids.filter((id) => id in names).map((id) => ({ id, name: names[id] })),
      });
    }
    return new Response(null);
  });
});

afterEach(() => vi.useRealTimers());

const TEAM = 'team_rd';

type Seed = {
  id: string;
  type?: string;
  actor?: string | null;
  actorName?: string | null;
  subject?: string | null;
  title?: string;
  detail?: Record<string, string | null> | null;
  at: number;
  team?: string;
  item?: string | null;
};

function seed(rows: Seed[]) {
  const insert = h.db.sql.prepare(
    `INSERT INTO team_audit_events (team_id, id, type, app, actor_id, actor_name, subject_id, item_id, title,
       detail, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of rows) {
    insert.run(
      r.team ?? TEAM,
      r.id,
      r.type ?? 'shared',
      'liveplanner',
      r.actor === undefined ? 'user_ad' : r.actor,
      r.actorName ?? null,
      r.subject ?? null,
      r.item === undefined ? 'item1' : r.item,
      r.title ?? 'Budget',
      r.detail === undefined
        ? JSON.stringify({ level: 'view' })
        : r.detail && JSON.stringify(r.detail),
      r.at,
    );
  }
}

async function admin(id = 'user_ad') {
  world.roles[id] = [{ id: TEAM, role: 'admin' }];
  return person(id);
}

const read = async (auth: string, query: string) =>
  call(`/team-audit?team=${TEAM}${query}`, { auth });
const page = async (auth: string, query = '') => {
  const res = await read(auth, query);
  expect(res.status, await res.clone().text()).toBe(200);
  return body<TeamAuditPage>(res);
};
const ids = (events: TeamAuditEvent[]) => events.map((e) => e.id);

describe('who may read it', () => {
  it("lets a team's admin read, and refuses a member and anyone outside, asking accounts rather than the token", async () => {
    seed([{ id: 'e1', at: 1000 }]);
    const ad = await admin();
    expect(ids((await page(ad.auth)).events)).toEqual(['e1']);

    // The token says admin; accounts says member now.
    const me = await person('user_me', { teams: [{ id: TEAM, role: 'admin' }] });
    world.roles.user_me = [{ id: TEAM, role: 'member' }];
    const outsider = await person('user_out');
    for (const auth of [me.auth, outsider.auth]) {
      const res = await read(auth, '');
      expect(res.status).toBe(403);
      expect(await body(res)).toEqual({ error: 'not_team_admin' });
    }
    // An admin of another team reads nothing of this one.
    world.roles.user_out = [{ id: 'team_other', role: 'admin' }];
    expect((await read(outsider.auth, '')).status).toBe(403);
    expect((await call(`/team-audit?team=${TEAM}`)).status).toBe(401);
  });

  it("answers 503 when accounts can't say who runs the team, never the token's claim", async () => {
    const ad = await person('user_ad', { teams: [{ id: TEAM, role: 'admin' }] });
    world.accountsDown = true;
    const res = await read(ad.auth, '');
    expect(res.status).toBe(503);
    expect(await body(res)).toEqual({ error: 'team_audit_unavailable' });
  });

  it('refuses a guest, an app, the Drive mirror and the data export acting for an admin', async () => {
    const asked: string[] = [];
    const deps = {
      adminTeams: async (id: string) => (asked.push(id), new Set([TEAM])),
      names: async () => new Map<string, string>(),
    };
    const ctx = (who: Partial<Person>): PersonContext =>
      ({
        request: new Request('https://x/team-audit'),
        env: h.db.env,
        url: new URL(`https://x/team-audit?team=${TEAM}`),
        segments: ['team-audit'],
        person: { id: 'user_ad', kind: 'account', teams: [TEAM], ...who },
      }) as unknown as PersonContext;
    for (const who of [
      { kind: 'guest' as const },
      { app: 'liveplanner' as const },
      { drive: true as const },
      { export: true as const },
    ]) {
      const res = await handleTeamAudit(ctx(who), deps);
      expect(res.status).toBe(403);
    }
    expect(asked).toEqual([]);
    expect((await handleTeamAudit(ctx({}), deps)).status).toBe(200);
  });

  it('answers only GET /team-audit', async () => {
    const ad = await admin();
    expect((await call(`/team-audit?team=${TEAM}`, { method: 'POST', auth: ad.auth })).status).toBe(
      404,
    );
    expect((await call(`/team-audit/x?team=${TEAM}`, { auth: ad.auth })).status).toBe(404);
  });
});

describe('what it answers', () => {
  it('names who did it and whom it was about as accounts does now, members who have left included', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: 20_000_000_000 });
    world.roles.user_ad = [{ id: TEAM, role: 'admin' }];
    const ad = await person('user_ad', { teams: [{ id: TEAM, role: 'admin' }] });
    // A real write: a team item shared, logged by part 1's path.
    const item = await makeItem(ad.auth, { title: 'Roadmap', teamId: TEAM });
    await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: ad.auth,
      body: { level: 'view' },
    });
    // A member who has left (in no team now) removed by the admin, named as they were sent.
    seed([
      {
        id: 'acc1',
        type: 'team_member_removed',
        actor: 'user_ad',
        actorName: 'Ada (then)',
        subject: 'user_gone',
        item: null,
        title: 'Design',
        detail: { teamId: TEAM, personId: 'user_gone', memberName: 'Gone (then)' },
        at: 1,
      },
    ]);
    names = { user_ad: 'Ada Lovelace', user_gone: 'Grace Hopper' };
    const { events, nextCursor } = await page(ad.auth);
    expect(nextCursor).toBeNull();
    expect(events).toEqual([
      {
        id: expect.any(String),
        type: 'shared',
        app: 'liveplanner',
        actor: { id: 'user_ad', name: 'Ada Lovelace' },
        subject: null,
        itemId: item.id,
        title: 'Roadmap',
        detail: { level: 'view' },
        occurredAt: 20_000_000_000,
      },
      {
        id: 'acc1',
        type: 'team_member_removed',
        app: 'liveplanner',
        actor: { id: 'user_ad', name: 'Ada Lovelace' },
        subject: { id: 'user_gone', name: 'Grace Hopper' },
        itemId: null,
        title: 'Design',
        detail: { teamId: TEAM, personId: 'user_gone', memberName: 'Gone (then)' },
        occurredAt: 1,
      },
    ]);
    // One call names the page's people.
    expect(namesCalls()).toHaveLength(1);
    expect((namesCalls()[0]!.body as { ids: string[] }).ids.sort()).toEqual([
      'user_ad',
      'user_gone',
    ]);
  });

  it("falls back to the names the event carried when accounts can't name, and names a closed account nobody", async () => {
    const ad = await admin();
    seed([
      {
        id: 'e2',
        type: 'team_role_changed',
        actor: 'user_x',
        actorName: 'Xavier',
        subject: 'user_y',
        detail: { personId: 'user_y', memberName: 'Yolanda' },
        at: 2,
      },
      { id: 'e1', actor: 'deleted', subject: 'deleted', detail: null, at: 1 },
      { id: 'e0', actor: null, at: 0 },
      { id: 'e00', actor: null, at: 0 },
    ]);
    h.db.sql.prepare("UPDATE team_audit_events SET detail = 'not json' WHERE id = 'e0'").run();
    h.db.sql.prepare("UPDATE team_audit_events SET detail = '[1]' WHERE id = 'e00'").run();
    namesDown = true;
    const { events } = await page(ad.auth);
    expect(events.map((e) => [e.actor, e.subject, e.detail])).toEqual([
      [
        { id: 'user_x', name: 'Xavier' },
        { id: 'user_y', name: 'Yolanda' },
        { personId: 'user_y', memberName: 'Yolanda' },
      ],
      [{ id: 'deleted', name: null }, { id: 'deleted', name: null }, null],
      [null, null, null],
      [null, null, null],
    ]);
    // The closed account's id is never sent to accounts.
    expect(namesCalls().flatMap((c) => (c.body as { ids: string[] }).ids)).not.toContain('deleted');
  });

  it('reads an empty log without asking accounts for names', async () => {
    const ad = await admin();
    expect(await page(ad.auth)).toEqual({ events: [], nextCursor: null });
    expect(namesCalls()).toEqual([]);
  });
});

describe('filters and pages', () => {
  beforeEach(() => {
    seed([
      { id: 'a', actor: 'user_p1', type: 'shared', at: 100 },
      { id: 'b', actor: 'user_p2', type: 'trashed', at: 200 },
      { id: 'c', actor: 'user_p1', type: 'trashed', at: 300 },
      { id: 'd', actor: 'user_p1', type: 'shared', at: 300 },
      { id: 'e', actor: 'user_p2', type: 'shared', at: 400 },
      { id: 'f', actor: 'user_p1', type: 'webhook_added', at: 500 },
      { id: 'g', actor: 'user_p1', type: 'shared', at: 600 },
      { id: 'z', actor: 'user_p1', type: 'shared', at: 650, team: 'team_other' },
    ]);
  });

  it('filters by person, kind and date, each alone and together, newest first', async () => {
    const ad = await admin();
    const got = async (q: string) => ids((await page(ad.auth, q)).events);
    expect(await got('')).toEqual(['g', 'f', 'e', 'd', 'c', 'b', 'a']);
    expect(await got('&person=user_p2')).toEqual(['e', 'b']);
    expect(await got('&kind=shared')).toEqual(['g', 'e', 'd', 'a']);
    expect(await got('&from=300&to=500')).toEqual(['e', 'd', 'c']);
    expect(await got('&person=user_p1&kind=shared&from=200')).toEqual(['g', 'd']);
    expect(await got('&person=&kind=&from=&to=&format=json')).toHaveLength(7);
  });

  it('pages with a cursor, ties on time broken by id, and every row once', async () => {
    const ad = await admin();
    const seen: string[] = [];
    let cursor: string | null = '';
    let pages = 0;
    while (cursor !== null) {
      const res: TeamAuditPage = await page(
        ad.auth,
        `&limit=2${cursor ? `&cursor=${cursor}` : ''}`,
      );
      seen.push(...ids(res.events));
      cursor = res.nextCursor;
      pages += 1;
    }
    expect(seen).toEqual(['g', 'f', 'e', 'd', 'c', 'b', 'a']);
    expect(pages).toBe(4);
    // A full last page says there is no more.
    expect((await page(ad.auth, '&kind=shared&limit=4')).nextCursor).toBeNull();
  });

  it('refuses a malformed query before asking accounts', async () => {
    const ad = await admin();
    const before = h.appCalls.length;
    for (const q of [
      '&kind=token_created',
      '&kind=nope',
      '&person=bad%20id',
      '&from=-1',
      '&to=1.5',
      '&from=99999999999999999',
      '&to=9999999999999999',
      '&limit=0',
      '&limit=101',
      '&limit=x',
      '&format=xml',
    ]) {
      const res = await read(ad.auth, q);
      expect(res.status, q).toBe(400);
      expect(await body(res)).toEqual({ error: 'invalid_query' });
    }
    expect((await call('/team-audit', { auth: ad.auth })).status).toBe(400);
    const bad = await read(ad.auth, '&cursor=nope!');
    expect(await body(bad)).toEqual({ error: 'invalid_cursor' });
    expect(h.appCalls.length).toBe(before);
  });
});

describe('the CSV export', () => {
  it('is the same read as a spreadsheet file, formula-safe, with names and labels', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 7) });
    const ad = await admin();
    names = { user_ad: 'Ada, "the admin"' };
    seed([
      {
        id: 'w1',
        type: 'webhook_added',
        title: '=HYPERLINK("x")',
        item: null,
        detail: { webhookId: 'wh1', kind: 'json', host: 'hooks.example.com' },
        at: Date.UTC(2026, 0, 2, 3, 4, 5),
      },
      {
        id: 'r1',
        type: 'team_member_removed',
        subject: 'user_bo',
        title: 'Design',
        item: null,
        detail: { personId: 'user_bo', memberName: 'Bo', left: 'true', role: null },
        at: Date.UTC(2026, 0, 1),
      },
    ]);
    const file = await read(ad.auth, '&format=csv');
    expect(file.status).toBe(200);
    expect(file.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(file.headers.get('Content-Disposition')).toBe(
      'attachment; filename="team-activity-2026-11-07.csv"',
    );
    expect(file.headers.get('Cache-Control')).toBe('private, no-store');
    expect(file.headers.get('X-Next-Cursor')).toBeNull();
    // A byte-order mark first, so a spreadsheet reads the names as UTF-8 (text() drops it).
    const bytes = new Uint8Array(await file.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = await file.text();
    expect(text.split('\r\n')).toEqual([
      'Time (UTC),Event,Kind,App,By,By ID,About,About ID,Name,Document ID,Detail',
      `2026-01-02T03:04:05.000Z,Webhook Added,webhook_added,liveplanner,"Ada, ""the admin""",user_ad,,,"'=HYPERLINK(""x"")",,webhookId=wh1; kind=json; host=hooks.example.com`,
      '2026-01-01T00:00:00.000Z,Removed or Left,team_member_removed,liveplanner,"Ada, ""the admin""",user_ad,Bo,user_bo,Design,,left=true',
      '',
    ]);
  });

  it('answers a header alone for an empty range, and blanks for nobody and no detail', async () => {
    const ad = await admin();
    seed([{ id: 'n1', actor: null, item: null, detail: null, at: Date.UTC(2026, 0, 1) }]);
    const empty = await read(ad.auth, '&format=csv&from=5&to=6');
    expect((await empty.text()).split('\r\n')).toHaveLength(2);
    expect(namesCalls()).toEqual([]);
    const one = await read(ad.auth, '&format=csv');
    expect((await one.text()).split('\r\n')[1]).toBe(
      '2026-01-01T00:00:00.000Z,Share Link Made,shared,liveplanner,,,,,Budget,,',
    );
  });

  it(`holds at most ${TEAM_AUDIT_CSV_MAX} rows a file and says where the next starts, within a CPU budget`, async () => {
    const ad = await admin();
    const total = TEAM_AUDIT_CSV_MAX + 5;
    // 250 people, so naming them takes several calls of at most NAMES_PER_CALL.
    seed(
      Array.from({ length: total }, (_, i) => ({
        id: `e${String(i).padStart(6, '0')}`,
        actor: `user_p${i % 250}`,
        at: 1_000_000 + i,
      })),
    );
    for (let i = 0; i < 250; i += 1) names[`user_p${i}`] = `Person ${i}`;
    let first: Response | null = null;
    const ms = await cpuMsOfAsync(async () => {
      first = await read(ad.auth, '&format=csv');
    });
    const res = first as unknown as Response;
    const lines = (await res.text()).split('\r\n');
    expect(lines).toHaveLength(TEAM_AUDIT_CSV_MAX + 2);
    // Newest first: the file starts at the newest row and stops 5 short of the oldest.
    expect(lines[1]!.split(',')[0]).toBe(new Date(1_000_000 + total - 1).toISOString());
    expect(lines.at(-2)!.split(',')[0]).toBe(new Date(1_000_000 + 5).toISOString());
    expect(namesCalls()).toHaveLength(Math.ceil(250 / NAMES_PER_CALL));
    expect(ms).toBeLessThan(cpuBudgetMs(1500));
    const next = res.headers.get('X-Next-Cursor');
    expect(next).toBeTruthy();
    const rest = await read(ad.auth, `&format=csv&cursor=${next}`);
    expect(rest.headers.get('X-Next-Cursor')).toBeNull();
    expect((await rest.text()).split('\r\n')).toHaveLength(5 + 2);
  });
});

describe('naming through accounts', () => {
  it("names nobody without the key, when accounts throws, and skips what it can't read", async () => {
    expect(await accountsPeopleNames({ ...h.db.env, MERGE_KEY: ' ' })(['user_a'])).toBeNull();
    h.appAnswer = () => {
      throw new Error('offline');
    };
    expect(await accountsPeopleNames(h.db.env)(['user_a'])).toBeNull();
    h.appAnswer = () =>
      Response.json({
        people: [{ id: 'user_a', name: 'A' }, { id: 'user_b', name: null }, { id: 7 }],
      });
    expect([...(await accountsPeopleNames(h.db.env)(['user_a', 'user_a', 'user_b']))!]).toEqual([
      ['user_a', 'A'],
    ]);
    h.appAnswer = () => Response.json({});
    expect((await accountsPeopleNames(h.db.env)(['user_a']))!.size).toBe(0);
  });
});

describe('the bound', () => {
  const plan = ({ sql, args }: { sql: string; args: (string | number)[] }) =>
    h.db.sql
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...(args as SQLInputValue[]))
      .map((r) => String((r as { detail: string }).detail));

  it('reads one index range for every filter, never scanning the log or sorting it', () => {
    const filters: TeamAuditFilter[] = [
      { team: TEAM },
      { team: TEAM, person: 'user_p1' },
      { team: TEAM, kind: 'shared' },
      { team: TEAM, from: 1, to: 2 },
      { team: TEAM, person: 'user_p1', kind: 'shared', from: 1, to: 2 },
    ];
    for (const filter of filters) {
      for (const cursor of [undefined, { at: 5, id: 'x' }]) {
        const lines = plan(pageQuery(filter, cursor, CSV_READ_CHUNK));
        const text = JSON.stringify({ filter, cursor, lines });
        expect(
          lines.some((l) => /USING (COVERING )?INDEX team_audit_(time|actor|type)/.test(l)),
          text,
        ).toBe(true);
        expect(
          lines.some((l) => /TEMP B-TREE|SCAN team_audit_events$/.test(l)),
          text,
        ).toBe(false);
      }
    }
  });

  it('binds at most 9 parameters, far under D1’s 100', () => {
    const { args } = pageQuery(
      { team: TEAM, person: 'p', kind: 'shared', from: 1, to: 2 },
      { at: 1, id: 'x' },
      10,
    );
    expect(args).toHaveLength(9);
  });
});
