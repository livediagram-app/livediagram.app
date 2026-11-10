// Space previews (Home's Spaces tiles): the person's own space then each team's, each its newest few items and its
// count, by app, in one batch that never scans the items table, and within budget for 51 spaces of 1,200 items each.
import type { SpacePreview } from '@liveworkspace/index-client';
import type { SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import type { Person } from './auth';
import { spacePreviewQueries } from './space-previews';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const previews = async (auth: string, app?: string) =>
  body<{ spaces: SpacePreview[] }>(
    await call(`/spaces/previews${app ? `?app=${app}` : ''}`, { auth }),
  );

describe('GET /spaces/previews', () => {
  it('gives My Work then each team its four newest live items and its count', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }, { id: 'team2' }] });
    const made = [];
    for (let i = 0; i < 6; i++) made.push(await makeItem(ada.auth, { title: `A${i}` }));
    await makeItem(ada.auth, { title: 'D', app: 'livediagram' });
    const t = await makeItem(ada.auth, { title: 'T', teamId: 'team1' });
    const set = h.db.sql.prepare('UPDATE items SET updated_at = ? WHERE id = ?');
    made.forEach((item, i) => set.run(1000 + i, item.id));
    set.run(2000, t.id);
    await call(`/items/${made[5]!.id}`, { method: 'DELETE', auth: ada.auth });

    const all = await previews(ada.auth);
    expect(all.spaces.map((s) => s.teamId)).toEqual([null, 'team1', 'team2']);
    const [mine, one, two] = all.spaces;
    // Six of Ada's plans and a diagram, one trashed: six live, the four newest shown.
    expect(mine!.itemCount).toBe(6);
    expect(mine!.items.map((i) => i.title)).toEqual(['D', 'A4', 'A3', 'A2']);
    expect(one!.itemCount).toBe(1);
    expect(one!.items.map((i) => i.title)).toEqual(['T']);
    expect(two).toEqual({ teamId: 'team2', itemCount: 0, items: [] });

    const plans = await previews(ada.auth, 'liveplanner');
    expect(plans.spaces[0]!.itemCount).toBe(5);
    expect(plans.spaces[0]!.items.map((i) => i.title)).toEqual(['A4', 'A3', 'A2', 'A1']);
    const diagrams = await previews(ada.auth, 'livediagram');
    expect(diagrams.spaces.map((s) => s.itemCount)).toEqual([1, 0, 0]);
  });

  it("answers only the person's own spaces, and refuses a bad app or another route", async () => {
    const ada = await person('user_a');
    const eve = await person('user_e', { teams: [{ id: 'team9' }] });
    await makeItem(eve.auth, { title: 'Secret' });
    await makeItem(eve.auth, { title: 'Team secret', teamId: 'team9' });
    const got = await previews(ada.auth);
    expect(got.spaces).toEqual([{ teamId: null, itemCount: 0, items: [] }]);

    expect((await call('/spaces/previews?app=nope', { auth: ada.auth })).status).toBe(400);
    expect((await call('/spaces', { auth: ada.auth })).status).toBe(404);
    expect((await call('/spaces/previews', { method: 'POST', auth: ada.auth })).status).toBe(404);
    expect((await call('/spaces/previews')).status).toBe(401);
  });

  it('walks the live indexes with two bound parameters at most, never scanning the items table', () => {
    const teams = Array.from({ length: 50 }, (_, i) => `team${i}`);
    const ada: Person = { id: 'user_a', kind: 'account', teams };
    for (const app of [null, 'liveplanner' as const]) {
      const q = spacePreviewQueries(ada, app);
      for (const { sql, args } of [q.items, q.counts]) {
        expect(args.length).toBeLessThanOrEqual(2);
        expect(sql).not.toMatch(/\bUNION\b/i);
        const lines = h.db.sql
          .prepare(`EXPLAIN QUERY PLAN ${sql}`)
          .all(...(args as SQLInputValue[]))
          .map((r) => String((r as { detail: string }).detail));
        expect(
          lines.filter((l) => /\bSCAN (i|x|items)\b/.test(l)),
          lines.join('\n'),
        ).toEqual([]);
        expect(
          lines.some((l) => l.includes(app ? 'items_live_app' : 'items_live')),
          lines.join('\n'),
        ).toBe(true);
      }
    }
  });

  it('answers 51 spaces of 1,200 items each within budget, counting no further than the cap', async () => {
    const teams = Array.from({ length: 50 }, (_, i) => ({ id: `team${i}` }));
    const ada = await person('user_a', { teams });
    const db = h.db.sql;
    const insertItem = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', 'user_a', ?, ?, NULL, ?, '{}', ?, ?)`,
    );
    const spaces = [null, ...teams.map((t) => t.id)];
    db.exec('BEGIN');
    for (const team of spaces) {
      const scope = team ? `t:${team}` : 'p:user_a';
      for (let i = 0; i < 1200; i++) {
        insertItem.run(`item-${team ?? 'me'}-${i}`, team, scope, `Item ${i}`, i, 1_000_000 + i);
      }
    }
    db.exec('COMMIT');
    // CPU time, not wall clock: a busy runner's wait for a core is not the query's cost.
    let got!: { spaces: SpacePreview[] };
    const took = await cpuMsOfAsync(async () => {
      got = await previews(ada.auth, 'liveplanner');
    });
    expect(got.spaces.map((s) => s.teamId)).toEqual(spaces);
    for (const s of got.spaces) {
      expect(s.itemCount).toBe(1000);
      expect(s.items.map((i) => i.title)).toEqual([
        'Item 1199',
        'Item 1198',
        'Item 1197',
        'Item 1196',
      ]);
    }
    console.log(`[space previews] 51 spaces x 1,200 items: ${took.toFixed(1)} ms of CPU`);
    expect(took).toBeLessThan(cpuBudgetMs(500));
    // Seeding 61,200 items outruns the 5s default on a busy runner; the budget above times only the read.
  }, 30_000);
});
