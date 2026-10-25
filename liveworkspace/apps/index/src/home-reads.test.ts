// Home's reads in one request: Recent's first page (with Most Used) can also carry My Work's count (`mine`, the
// hero's pill) and whether the person can open anything at all (`any`, the first run), each the same answer the
// list it stands for would give, counted in SQL rather than sent, and bounded however much the index holds.
import type { Item, MineCount } from '@liveworkspace/index-client';
import { LIST_LIMIT_MAX } from '@liveworkspace/index-client';
import type { SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { Person } from './auth';
import { buildAnyQuery, buildMineCountQuery } from './lists';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

type Page = { items: Item[]; nextCursor: string | null; mine?: MineCount; any?: boolean };
const list = async (auth: string, query: string) =>
  body<Page>(await call(`/items?${query}`, { auth }));

describe("Home's reads beside Recent", () => {
  it('count My Work as its first page would, in the app asked, and say whether anything opens', async () => {
    const ada = await person('user_hr_a', { teams: [{ id: 'team1' }] });
    const eve = await person('user_hr_e');
    await makeItem(ada.auth, { title: 'Mine 1' });
    await makeItem(ada.auth, { title: 'Mine 2' });
    await makeItem(ada.auth, { title: 'Canvas', app: 'livediagram' });
    await makeItem(ada.auth, { title: 'Team', teamId: 'team1' });
    const gone = await makeItem(ada.auth, { title: 'Gone' });
    await call(`/items/${gone.id}`, { method: 'DELETE', auth: ada.auth });

    const home = await list(ada.auth, 'view=recent&limit=8&used=4&mine=200&any=1&app=liveplanner');
    const myWork = await list(ada.auth, 'view=all&team=personal&limit=200&app=liveplanner');
    expect(home.mine).toEqual({ count: myWork.items.length, more: myWork.nextCursor !== null });
    expect(home.mine).toEqual({ count: 2, more: false });
    expect(home.any).toBe(true);
    // A cap it passes says so, as a full page does.
    expect((await list(ada.auth, 'view=recent&mine=1')).mine).toEqual({ count: 1, more: true });
    // Every app: the canvas counts too.
    expect((await list(ada.auth, 'view=recent&mine=200')).mine).toEqual({ count: 3, more: false });

    // Eve has nothing of her own; a link she opened is still something she can open.
    expect(await list(eve.auth, 'view=recent&mine=200&any=1')).toMatchObject({
      mine: { count: 0, more: false },
      any: false,
    });
    const theirs = await makeItem(ada.auth, { title: 'Shared' });
    const link = await body<{ link: { code: string } }>(
      await call(`/items/${theirs.id}/share`, { method: 'POST', auth: ada.auth, body: {} }),
    );
    await call(`/share/${link.link.code}`, { auth: eve.auth });
    const after = await list(eve.auth, 'view=recent&mine=200&any=1');
    expect(after).toMatchObject({ mine: { count: 0, more: false }, any: true });
    expect((await list(eve.auth, 'view=recent&any=1&app=livediagram')).any).toBe(false);
  });

  it('answers only what is asked, and only on a first page', async () => {
    const ada = await person('user_hr_b');
    await makeItem(ada.auth, { title: 'One' });
    await makeItem(ada.auth, { title: 'Two' });
    const plain = await list(ada.auth, 'view=recent');
    expect(plain.mine).toBeUndefined();
    expect(plain.any).toBeUndefined();
    const first = await list(ada.auth, 'view=all&limit=1&mine=5&any=1');
    expect(first).toMatchObject({ mine: { count: 2, more: false }, any: true });
    const next = await list(ada.auth, `view=all&limit=1&mine=5&any=1&cursor=${first.nextCursor}`);
    expect(next.items).toHaveLength(1);
    expect(next.mine).toBeUndefined();
    expect(next.any).toBeUndefined();
  });

  it('refuses a bad ask', async () => {
    const ada = await person('user_hr_c');
    for (const q of [
      'view=recent&mine=0',
      `view=recent&mine=${LIST_LIMIT_MAX + 1}`,
      'view=recent&mine=x',
      'view=recent&any=true',
      'view=recent&any=0',
    ]) {
      expect((await call(`/items?${q}`, { auth: ada.auth })).status, q).toBe(400);
    }
  });
});

describe('the bound', () => {
  const ada: Person = { id: 'user_big', kind: 'account', teams: ['team1'] };
  const plan = (sql: string, args: unknown[]) =>
    h.db.sql
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...(args as SQLInputValue[]))
      .map((r) => String((r as { detail: string }).detail));

  it("reads through the person's scopes and never scans the items table", () => {
    for (const { sql, args } of [
      buildMineCountQuery(ada, 'liveplanner', LIST_LIMIT_MAX),
      buildAnyQuery(ada, 'liveplanner'),
    ]) {
      const lines = plan(sql, args);
      expect(
        lines.filter((l) => /\bSCAN (i|li|items)\b(?! USING)/.test(l)),
        lines.join('\n'),
      ).toEqual([]);
    }
  });

  it('answers within budget beside 100,000 other rows', async () => {
    const db = h.db.sql;
    const insert = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', ?, NULL, ?, NULL, ?, '{}', 1, ?)`,
    );
    db.exec('BEGIN');
    for (let i = 0; i < 100_000; i++) {
      const owner = i < 5_000 ? 'user_big' : `user_o${i % 500}`;
      insert.run(`hr-${String(i).padStart(6, '0')}`, owner, `p:${owner}`, `Item ${i}`, i);
    }
    db.exec('COMMIT');
    const big = await person('user_big');
    const started = performance.now();
    const home = await list(big.auth, 'view=recent&limit=8&used=4&mine=200&any=1&app=liveplanner');
    const ms = performance.now() - started;
    expect(home.mine).toEqual({ count: 200, more: true });
    expect(home.any).toBe(true);
    console.info(
      `[home-reads] 5,000 own items among 100,000: ${ms.toFixed(1)} ms for Home's one read`,
    );
    expect(ms).toBeLessThan(250);
  });
});
