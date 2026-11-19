import { describe, expect, it, vi } from 'vitest';
import {
  ASSISTANT_CALLS_PER_RUN,
  ASSISTANT_GIVE_UP_MS,
  ASSISTANT_ITEMS_PER_CALL,
  ASSISTANT_RETRY_AFTER_MS,
  drainAssistantNotices,
} from './assistant-notices';
import { body, call, h, settle, useHarness } from './test-support';

useHarness();

const ADA = 'user_ada';
const BEA = 'user_bea';

const revoked = (payload: unknown, auth: string | null = 'merge-key', method = 'POST') =>
  call('/internal/assistant-revoked', { method, auth, body: payload });

const run = (query: string, ...args: (string | number | null)[]) =>
  h.db.sql.prepare(query).run(...args);
const rows = (query: string, ...args: (string | number | null)[]) =>
  h.db.sql.prepare(query).all(...args) as Record<string, unknown>[];
const count = (query: string, ...args: (string | number | null)[]) =>
  Number((h.db.sql.prepare(query).get(...args) as { n: number }).n);

function addItem(
  id: string,
  owner: string,
  options: { team?: string; trashed?: boolean; app?: string } = {},
) {
  const app = options.app ?? 'liveplanner';
  run(
    `INSERT INTO items (id, app, kind, owner_id, team_id, scope, title, created_at, updated_at, trashed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
    id,
    app,
    app === 'liveplanner' ? 'plan' : 'canvas',
    owner,
    options.team ?? null,
    options.team ? `t:${options.team}` : `p:${owner}`,
    id,
    options.trashed ? 1 : null,
  );
}

// Ada's plans and what else she reaches, beside things she never met.
function arrange() {
  addItem('ada-own', ADA);
  addItem('ada-trashed', ADA, { trashed: true });
  addItem('ada-diagram', ADA, { app: 'livediagram' });
  addItem('team-plan', BEA, { team: 'T' });
  addItem('team-trashed', BEA, { team: 'T', trashed: true });
  addItem('other-team', BEA, { team: 'U' });
  addItem('bea-shared', BEA);
  addItem('bea-opened', BEA);
  addItem('bea-edited', BEA);
  addItem('bea-alone', BEA);
  run(
    `INSERT INTO shared_with (person_id, item_id, share_code, last_seen) VALUES (?, 'bea-shared', 'c1', 1)`,
    ADA,
  );
  run(`INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, 'bea-opened', 1)`, ADA);
  run(`INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, 'bea-alone', 1)`, BEA);
  for (const id of ['e1', 'e2'])
    run(
      `INSERT INTO events (id, app, item_id, actor_id, actor_name, type, title, occurred_at)
       VALUES (?, 'liveplanner', 'bea-edited', ?, 'Ada', 'edited', 'x', 1)`,
      id,
      ADA,
    );
}

const toldPeople = () => h.appCalls.filter((c) => c.url.includes('/assistant-revoked'));

describe('POST /internal/assistant-revoked', () => {
  it('records every plan she may have reached with the tool, and tells liveplanner after the answer', async () => {
    arrange();
    const res = await revoked({ personId: ADA, client: ' Claude ', teamIds: ['T'] });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ items: 6 });
    await settle();
    const told = toldPeople();
    expect(told).toHaveLength(1);
    expect(told[0]!.url).toBe(
      'https://liveplanner.app/api/internal/people/user_ada/assistant-revoked',
    );
    expect(told[0]!.headers.get('Authorization')).toBe('Bearer lp-key');
    // Her own (Trash included), her team's live plan, and those shared with, opened or edited by her. Never another
    // app's item, another team's, or one only someone else reached.
    expect(told[0]!.body).toEqual({
      client: 'Claude',
      items: ['ada-own', 'ada-trashed', 'bea-edited', 'bea-opened', 'bea-shared', 'team-plan'],
    });
    expect(count('SELECT COUNT(*) AS n FROM assistant_notices')).toBe(0);
  });

  it('records a revoke told twice once, and tells nobody for a tool that never reached a plan', async () => {
    arrange();
    h.appAnswer = () => new Response(null, { status: 503 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await revoked({ personId: ADA, client: 'Claude' });
    expect(await body(await revoked({ personId: ADA, client: 'Claude' }))).toEqual({ items: 0 });
    expect(count('SELECT COUNT(*) AS n FROM assistant_notices')).toBe(5);
    await settle();

    h.appCalls = [];
    const res = await revoked({ personId: 'user_nobody', client: 'Claude', teamIds: [] });
    expect(await body(res)).toEqual({ items: 0 });
    await settle();
    expect(toldPeople()).toHaveLength(0);
  });

  it('answers the revoke even when telling the apps fails at once', async () => {
    arrange();
    const db = h.db.env.INDEX_DB;
    const prepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
      if (query.startsWith('DELETE FROM assistant_notices WHERE created_at'))
        throw new Error('down');
      return prepare(query);
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await revoked({ personId: ADA, client: 'Claude' })).status).toBe(200);
    await settle();
    expect(warn).toHaveBeenCalledWith('[index] assistant notices', 'Error: down');
    expect(count('SELECT COUNT(*) AS n FROM assistant_notices')).toBe(5);
  });

  it('refuses a caller without accounts’ key, another method and a body it cannot read', async () => {
    expect((await revoked({ personId: ADA, client: 'Claude' }, null)).status).toBe(401);
    expect((await revoked({ personId: ADA, client: 'Claude' }, 'lp-key')).status).toBe(401);
    expect((await revoked(undefined, 'merge-key', 'GET')).status).toBe(404);
    for (const bad of [
      { personId: 'guest_ada', client: 'Claude' },
      { personId: ADA },
      { personId: ADA, client: '   ' },
      { personId: ADA, client: 'x'.repeat(81) },
      { personId: ADA, client: 'Claude', teamIds: 'T' },
      { personId: ADA, client: 'Claude', teamIds: [7] },
      { personId: ADA, client: 'Claude', teamIds: Array.from({ length: 201 }, (_, i) => `t${i}`) },
    ]) {
      expect((await revoked(bad)).status).toBe(400);
    }
    expect(count('SELECT COUNT(*) AS n FROM assistant_notices')).toBe(0);
  });
});

describe('drainAssistantNotices', () => {
  const notice = (item: string, person = ADA, client = 'Claude', created = Date.now()) =>
    run(
      `INSERT INTO assistant_notices (person_id, client, app, item_id, created_at)
       VALUES (?, ?, 'liveplanner', ?, ?)`,
      person,
      client,
      item,
      created,
    );

  it('keeps what an app did not take, tries again an hour later, and gives up after a week', async () => {
    const now = Date.now();
    notice('p1', ADA, 'Claude', now);
    h.appAnswer = () => new Response(null, { status: 503 });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await drainAssistantNotices(h.db.env, now)).toBe(0);
    expect(rows('SELECT attempts, last_attempt_at FROM assistant_notices')).toEqual([
      { attempts: 1, last_attempt_at: now },
    ]);
    h.appCalls = [];
    await drainAssistantNotices(h.db.env, now + 1000);
    expect(toldPeople()).toHaveLength(0);
    h.appAnswer = () => new Response(null, { status: 200 });
    expect(await drainAssistantNotices(h.db.env, now + ASSISTANT_RETRY_AFTER_MS + 1)).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM assistant_notices')).toBe(0);

    notice('p2', BEA, 'Claude', 1);
    h.appAnswer = () => new Response(null, { status: 503 });
    await drainAssistantNotices(h.db.env, 1 + ASSISTANT_GIVE_UP_MS + 1);
    expect(count('SELECT COUNT(*) AS n FROM assistant_notices')).toBe(0);
    expect(warn).toHaveBeenCalledWith('[index] assistant notices given up', { rows: 1 });
  });

  it('tells each tool on its own, in calls of 100, and stops at the run’s call budget', async () => {
    const now = Date.now();
    for (let i = 0; i < ASSISTANT_ITEMS_PER_CALL + 5; i++) notice(`p${String(i).padStart(3, '0')}`);
    notice('p000', ADA, 'Cursor');
    expect(await drainAssistantNotices(h.db.env, now)).toBe(3);
    const told = toldPeople().map((c) => [
      (c.body as { client: string }).client,
      (c.body as { items: string[] }).items.length,
    ]);
    expect(told.sort()).toEqual([
      ['Claude', 100],
      ['Claude', 5],
      ['Cursor', 1],
    ]);

    h.appCalls = [];
    for (let i = 0; i < (ASSISTANT_CALLS_PER_RUN + 2) * ASSISTANT_ITEMS_PER_CALL; i++)
      notice(`q${String(i).padStart(5, '0')}`);
    expect(await drainAssistantNotices(h.db.env, now)).toBe(ASSISTANT_CALLS_PER_RUN);
    expect(count('SELECT COUNT(*) AS n FROM assistant_notices')).toBe(2 * ASSISTANT_ITEMS_PER_CALL);
  });

  it('counts an app this deployment does not run as told', async () => {
    const now = Date.now();
    notice('p1');
    expect(
      await drainAssistantNotices({ ...h.db.env, APP_ORIGIN_LIVEPLANNER: undefined }, now),
    ).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM assistant_notices')).toBe(0);
  });

  it('runs every 15 minutes', async () => {
    notice('p1', ADA, 'Claude', Date.now());
    const { default: worker } = await import('./index');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await worker.scheduled({ cron: '*/15 * * * *' } as ScheduledController, h.db.env);
    expect(count('SELECT COUNT(*) AS n FROM assistant_notices')).toBe(0);
  });
});
