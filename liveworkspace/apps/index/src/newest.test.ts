// Home's New beside the first page (`newest=N`, lists.ts buildNewestQuery): the person's own and their teams' live
// items, the most recently made first, in the app asked; never a link's, the Trash's or Archived; bounded per scope,
// one statement and three bound parameters whatever the number of teams.
import type { Item } from '@liveworkspace/index-client';
import { NEWEST_MAX } from '@liveworkspace/index-client';
import type { SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { Person } from './auth';
import { buildNewestQuery } from './lists';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

type Page = { items: Item[]; nextCursor: string | null; newest?: Item[] };
const list = async (auth: string, query: string) =>
  body<Page>(await call(`/items?${query}`, { auth }));
const titles = (items: Item[] | undefined) => (items ?? []).map((i) => i.title);
const madeAt = (id: string, at: number) =>
  h.db.sql.prepare('UPDATE items SET created_at = ? WHERE id = ?').run(at, id);

describe("Home's New", () => {
  it('lists the newest made first, in the app asked, with the team’s and AI-made ones', async () => {
    const ada = await person('user_nw_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_nw_b', { teams: [{ id: 'team1' }] });
    const made: [string, Record<string, unknown>, string][] = [
      ['P1', {}, ada.auth],
      ['P2', {}, ada.auth],
      ['P3', { source: 'ai', intent: 'plan:board:kanban' }, ada.auth],
      ['Team', { teamId: 'team1' }, bob.auth],
      ['P5', {}, ada.auth],
      ['Canvas', { app: 'livediagram' }, ada.auth],
      ["Bob's own", {}, bob.auth],
    ];
    let at = 1000;
    for (const [title, input, auth] of made) {
      const item = await makeItem(auth, { title, ...input });
      madeAt(item.id, at++);
    }
    // Opening and changing an item moves it in Recent and Edited, never in New.
    const p1 = (await list(ada.auth, 'view=all&app=liveplanner')).items.find(
      (i) => i.title === 'P1',
    )!;
    await call(`/items/${p1.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'P1 again' } });

    const home = await list(ada.auth, 'view=recent&limit=16&used=8&newest=4&app=liveplanner');
    expect(titles(home.newest)).toEqual(['P5', 'Team', 'P3', 'P2']);
    expect(home.newest!.find((i) => i.title === 'P3')!.source).toBe('ai');
    expect(home.newest!.find((i) => i.title === 'Team')!.teamId).toBe('team1');
    // Every app: the canvas too.
    expect(titles((await list(ada.auth, 'view=recent&newest=4')).newest)).toEqual([
      'Canvas',
      'P5',
      'Team',
      'P3',
    ]);
    // The limit, and the team filter.
    expect(titles((await list(ada.auth, 'view=recent&newest=1&app=liveplanner')).newest)).toEqual([
      'P5',
    ]);
    expect(titles((await list(ada.auth, 'view=all&team=team1&newest=4')).newest)).toEqual(['Team']);
  });

  it('leaves out what the person can no longer open: a team left, the Trash, Archived, links', async () => {
    const ada = await person('user_nw_c', { teams: [{ id: 'team2' }] });
    const eve = await person('user_nw_e');
    const team = await makeItem(ada.auth, { title: 'Team', teamId: 'team2' });
    const kept = await makeItem(ada.auth, { title: 'Kept' });
    const trashed = await makeItem(ada.auth, { title: 'Trashed' });
    const archived = await makeItem(ada.auth, { title: 'Archived' });
    for (const [k, item] of [team, kept, trashed, archived].entries()) madeAt(item.id, 2000 + k);
    await call(`/items/${trashed.id}`, { method: 'DELETE', auth: ada.auth });
    expect(
      (await call(`/items/${archived.id}/archive`, { method: 'POST', auth: ada.auth })).status,
    ).toBe(200);
    expect(titles((await list(ada.auth, 'view=recent&newest=8')).newest)).toEqual(['Kept', 'Team']);

    // Out of the team: its items are gone from the next read.
    const left = await person('user_nw_c');
    expect(titles((await list(left.auth, 'view=recent&newest=8')).newest)).toEqual(['Kept']);

    // A link Eve opened reaches the item, but it lives in Ada's space, not hers.
    const link = await body<{ link: { code: string } }>(
      await call(`/items/${kept.id}/share`, { method: 'POST', auth: ada.auth, body: {} }),
    );
    await call(`/share/${link.link.code}`, { auth: eve.auth });
    expect((await list(eve.auth, 'view=search&newest=8')).items.map((i) => i.title)).toContain(
      'Kept',
    );
    expect((await list(eve.auth, 'view=recent&newest=8')).newest).toEqual([]);
  });

  it('answers only when asked, on a first page, and refuses a bad ask', async () => {
    const ada = await person('user_nw_d');
    await makeItem(ada.auth, { title: 'One' });
    await makeItem(ada.auth, { title: 'Two' });
    expect((await list(ada.auth, 'view=recent')).newest).toBeUndefined();
    const first = await list(ada.auth, 'view=all&limit=1&newest=4');
    expect(first.newest).toHaveLength(2);
    const next = await list(ada.auth, `view=all&limit=1&newest=4&cursor=${first.nextCursor}`);
    expect(next.newest).toBeUndefined();
    for (const q of ['newest=0', `newest=${NEWEST_MAX + 1}`, 'newest=x', 'newest=1.5']) {
      expect((await call(`/items?view=recent&${q}`, { auth: ada.auth })).status, q).toBe(400);
    }
  });
});

describe('the bound', () => {
  const plan = (sql: string, args: unknown[]) =>
    h.db.sql
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...(args as SQLInputValue[]))
      .map((r) => String((r as { detail: string }).detail));
  const teams = Array.from({ length: 50 }, (_, k) => `team${k}`);
  const ada: Person = { id: 'user_big', kind: 'account', teams };

  it('walks each scope’s own index, never the table, with three parameters for 50 teams', () => {
    for (const [app, index] of [
      ['liveplanner', 'items_new_app'],
      [undefined, 'items_new'],
    ] as const) {
      const q = buildNewestQuery(ada, app ? { app } : {}, 4);
      expect(q.args.length).toBe(app ? 4 : 3);
      expect(q.sql).not.toMatch(/\bUNION\b/);
      const lines = plan(q.sql, q.args);
      console.info(`[newest] plan (${app ?? 'every app'}):\n  ${lines.join('\n  ')}`);
      expect(
        lines.some((l) => l.includes(`USING INDEX ${index}`)),
        lines.join('\n'),
      ).toBe(true);
      expect(lines.filter((l) => /\bSCAN (i|x|items)\b(?! USING)/.test(l))).toEqual([]);
    }
  });

  it('answers within budget for 50,000 items in 51 scopes among 100,000 rows', async () => {
    const db = h.db.sql;
    const insert = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at)
       VALUES (?, ?, 'plan', ?, ?, ?, NULL, ?, '{}', ?, ?)`,
    );
    const scopes = [
      { scope: 'p:user_big', team: null as string | null },
      ...teams.map((t) => ({ scope: `t:${t}`, team: t })),
    ];
    db.exec('BEGIN');
    for (let i = 0; i < 100_000; i++) {
      const mine = i % 2 === 0;
      const s = mine ? scopes[(i / 2) % scopes.length]! : null;
      const app = i % 4 < 2 ? 'liveplanner' : 'livediagram';
      insert.run(
        `nw-${String(i).padStart(6, '0')}`,
        app,
        s ? 'user_big' : `user_o${i % 500}`,
        s?.team ?? null,
        s ? s.scope : `p:user_o${i % 500}`,
        `Item ${i}`,
        i,
        100_000 - i,
      );
    }
    db.exec('COMMIT');
    const big = await person('user_big', { teams: teams.map((id) => ({ id })) });
    const started = performance.now();
    const home = await list(big.auth, 'view=recent&limit=16&used=8&newest=4&app=liveplanner');
    const ms = performance.now() - started;
    expect(home.newest!.map((i) => i.id)).toEqual([
      'nw-099996',
      'nw-099992',
      'nw-099988',
      'nw-099984',
    ]);
    console.info(
      `[newest] 50,000 items in 51 scopes among 100,000: ${ms.toFixed(1)} ms for Home's read`,
    );
    expect(ms).toBeLessThan(250);
  });
});
