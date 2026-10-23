// Most Used: an open counts its UTC day once, days past the window are pruned, and Recent's first page can carry
// the person's most used items (distinct days, ties to the latest open), as one bounded query on use_days' person
// index, whatever the table holds.
import type { Item } from '@liveworkspace/index-client';
import { MOST_USED_MAX, USE_WINDOW_DAYS } from '@liveworkspace/index-client';
import type { SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Person } from './auth';
import { buildMostUsedQuery } from './lists';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const DAY = 86_400_000;
const TODAY = 20_400; // a UTC day number (2025-11-07)
type Page = { items: Item[]; nextCursor: string | null; mostUsed?: Item[] };

const recent = async (auth: string, query = 'used=4') =>
  body<Page>(await call(`/items?view=recent&${query}`, { auth }));
const use = (personId: string, itemId: string, day: number) =>
  h.db.sql
    .prepare('INSERT OR IGNORE INTO use_days (person_id, item_id, day) VALUES (?, ?, ?)')
    .run(personId, itemId, day);
const opened = (personId: string, itemId: string, at: number) =>
  h.db.sql
    .prepare('INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, ?, ?)')
    .run(personId, itemId, at);
const daysOf = (personId: string) =>
  (
    h.db.sql
      .prepare('SELECT item_id, day FROM use_days WHERE person_id = ? ORDER BY item_id, day')
      .all(personId) as { item_id: string; day: number }[]
  ).map((r) => `${r.item_id}@${r.day - TODAY}`);

afterEach(() => vi.useRealTimers());

describe('recording use days', () => {
  it('counts an open once a day, and prunes days that left the window once a day', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: TODAY * DAY + 3_600_000 });
    const ada = await person('user_mu1');
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    use('user_mu1', item.id, TODAY - USE_WINDOW_DAYS); // just outside the window
    use('user_mu1', item.id, TODAY - USE_WINDOW_DAYS + 1); // the window's first day
    const open = () => call(`/items/${item.id}/open`, { method: 'POST', auth: ada.auth });
    await open();
    vi.setSystemTime(TODAY * DAY + 7_200_000);
    await open();
    expect(daysOf('user_mu1')).toEqual([`${item.id}@-89`, `${item.id}@0`]);
    vi.setSystemTime((TODAY + 1) * DAY + 60_000);
    // A day on, with a fresh token.
    const later = await person('user_mu1');
    expect(
      (await call(`/items/${item.id}/open`, { method: 'POST', auth: later.auth })).status,
    ).toBe(204);
    expect(daysOf('user_mu1')).toEqual([`${item.id}@0`, `${item.id}@1`]);
  });
});

describe('Most Used beside Recent', () => {
  it('ranks by distinct days, ties to the latest open, live and reachable only', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: TODAY * DAY + 1000 });
    const ada = await person('user_mu2', { teams: [{ id: 'team1' }] });
    const [a, b, c, d, gone] = await Promise.all(
      ['A', 'B', 'C', 'D', 'Gone'].map((title) => makeItem(ada.auth, { title })),
    );
    const t = await makeItem(ada.auth, { title: 'Team', teamId: 'team1' });
    const eve = await person('user_mu_eve');
    const theirs = await makeItem(eve.auth, { title: 'Theirs' });
    for (let k = 0; k < 5; k++) use('user_mu2', a!.id, TODAY - k);
    for (let k = 0; k < 3; k++) use('user_mu2', b!.id, TODAY - k);
    for (let k = 0; k < 3; k++) use('user_mu2', c!.id, TODAY - 10 - k);
    use('user_mu2', t.id, TODAY);
    for (let k = 0; k < 9; k++) use('user_mu2', gone!.id, TODAY - k);
    for (let k = 0; k < 9; k++) use('user_mu2', theirs.id, TODAY - k); // no longer reachable
    for (let k = 0; k < 9; k++) use('user_mu2', d!.id, TODAY - USE_WINDOW_DAYS - k); // all outside the window
    opened('user_mu2', b!.id, 2000);
    opened('user_mu2', c!.id, 3000);
    await call(`/items/${gone!.id}`, { method: 'DELETE', auth: ada.auth });

    const page = await recent(ada.auth);
    expect(page.mostUsed!.map((i) => [i.title, i.useDays])).toEqual([
      ['A', 5],
      ['C', 3],
      ['B', 3],
      ['Team', 1],
    ]);
    // Recent's own page is unchanged by it.
    expect(page.items.map((i) => i.title)).toEqual(['C', 'B']);
    expect((await recent(ada.auth, 'used=1&team=team1')).mostUsed!.map((i) => i.title)).toEqual([
      'Team',
    ]);
    expect((await recent(ada.auth, 'used=2&app=livediagram')).mostUsed).toEqual([]);
    // Only asked for, and only on Recent's first page.
    expect((await recent(ada.auth, '')).mostUsed).toBeUndefined();
  });

  it('refuses a bad ask', async () => {
    const ada = await person('user_mu3');
    for (const q of [
      `view=recent&used=${MOST_USED_MAX + 1}`,
      'view=recent&used=0',
      'view=all&used=2',
    ]) {
      expect((await call(`/items?${q}`, { auth: ada.auth })).status, q).toBe(400);
    }
  });
});

describe('the bound', () => {
  const ada: Person = { id: 'user_a', kind: 'account', teams: ['team1'] };

  it("reads use_days through the person's index and never scans items", () => {
    const { sql, args } = buildMostUsedQuery(ada, { limit: 4, app: 'liveplanner' });
    const lines = h.db.sql
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...(args as SQLInputValue[]))
      .map((r) => String((r as { detail: string }).detail));
    expect(
      lines.some((l) => /use_days_person_day|sqlite_autoindex_use_days_1/.test(l)),
      lines.join('\n'),
    ).toBe(true);
    expect(
      lines.filter((l) => /\bSCAN (i|items|use_days)\b(?! USING)/.test(l)),
      lines.join('\n'),
    ).toEqual([]);
  });

  it('answers within budget with 2,000 used items over the window among 100,000 other rows', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: TODAY * DAY + 1000 });
    const db = h.db.sql;
    const insert = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', ?, NULL, ?, NULL, ?, '{}', 1, 1)`,
    );
    const day = db.prepare('INSERT INTO use_days (person_id, item_id, day) VALUES (?, ?, ?)');
    db.exec('BEGIN');
    for (let i = 0; i < 4000; i++) {
      const owner = i < 2000 ? 'user_big' : `user_o${i % 50}`;
      const id = `mu-${String(i).padStart(5, '0')}`;
      insert.run(id, owner, `p:${owner}`, `Item ${i}`);
      // Ada's: a few days each, 2,000 items, ~10,000 rows; everyone else's: 50 days each, 100,000 rows.
      const n = i < 2000 ? 1 + (i % 9) : 50;
      for (let k = 0; k < n; k++) day.run(owner, id, TODAY - k);
    }
    db.exec('COMMIT');
    const big = await person('user_big');
    const started = performance.now();
    const page = await recent(big.auth, `used=${MOST_USED_MAX}`);
    const ms = performance.now() - started;
    expect(page.mostUsed).toHaveLength(MOST_USED_MAX);
    expect(page.mostUsed!.every((i) => i.useDays === 9)).toBe(true);
    console.info(`[most-used] 2,000 used items, ${ms.toFixed(1)} ms for Recent + Most Used`);
    expect(ms).toBeLessThan(250);
  });
});

describe('Hide from Recent', () => {
  it('takes an item out of Recent and Most Used for that person alone, and Show in Recent brings it back', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: TODAY * DAY + 1000 });
    const ada = await person('user_hr1', { teams: [{ id: 'team1' }] });
    const bob = await person('user_hr2', { teams: [{ id: 'team1' }] });
    const [a, b] = await Promise.all(
      ['A', 'B'].map((title) => makeItem(ada.auth, { title, teamId: 'team1' })),
    );
    for (const who of ['user_hr1', 'user_hr2']) {
      opened(who, a!.id, 3000);
      opened(who, b!.id, 2000);
      use(who, a!.id, TODAY);
    }
    const hide = (id: string, method: 'PUT' | 'DELETE') =>
      call(`/recent-hidden/${id}`, { method, auth: ada.auth });
    expect((await hide(a!.id, 'PUT')).status).toBe(204);
    const page = await recent(ada.auth);
    expect(page.items.map((i) => i.title)).toEqual(['B']);
    expect(page.mostUsed).toEqual([]);
    // Bob's Recent is his own.
    expect((await recent(bob.auth)).items.map((i) => i.title)).toEqual(['A', 'B']);
    // Everywhere else it stays, saying so; opening it again keeps it hidden.
    const one = await body<{ item: Item }>(await call(`/items/${a!.id}`, { auth: ada.auth }));
    expect(one.item).toMatchObject({ hiddenFromRecent: true, lastOpenedAt: 3000 });
    vi.setSystemTime(TODAY * DAY + 600_000);
    // Later, with a fresh token.
    const later = await person('user_hr1', { teams: [{ id: 'team1' }] });
    await call(`/items/${a!.id}/open`, { method: 'POST', auth: later.auth });
    expect((await recent(later.auth)).items.map((i) => i.title)).toEqual(['B']);
    const show = await call(`/recent-hidden/${a!.id}`, { method: 'DELETE', auth: later.auth });
    expect(show.status).toBe(204);
    expect((await recent(later.auth)).items.map((i) => i.title)).toEqual(['A', 'B']);
    expect((await call('/recent-hidden/missing', { method: 'PUT', auth: later.auth })).status).toBe(
      404,
    );
  });

  it('hides an item never opened without putting it in Recent, and showing it leaves no trace', async () => {
    const ada = await person('user_hr3');
    const item = await makeItem(ada.auth, { title: 'Never opened' });
    await call(`/recent-hidden/${item.id}`, { method: 'PUT', auth: ada.auth });
    const one = await body<{ item: Item }>(await call(`/items/${item.id}`, { auth: ada.auth }));
    expect(one.item).toMatchObject({ hiddenFromRecent: true, lastOpenedAt: null });
    await call(`/recent-hidden/${item.id}`, { method: 'DELETE', auth: ada.auth });
    expect((await recent(ada.auth)).items).toEqual([]);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM opens').get()).toEqual({ n: 0 });
  });

  it('reads Recent from the partial index', () => {
    const plan = h.db.sql
      .prepare(
        `EXPLAIN QUERY PLAN SELECT o.item_id FROM opens o WHERE o.person_id = ? AND o.hidden = 0
         ORDER BY o.last_opened_at DESC, o.item_id DESC LIMIT 12`,
      )
      .all('user_x') as { detail: string }[];
    expect(plan.map((r) => r.detail).join('\n')).toContain('opens_recent');
  });
});
