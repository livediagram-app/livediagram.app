// Folder previews: each folder's newest few items and its count, only for folders the person reaches, by app,
// in one batch that never scans the items table, and within budget for 60 folders of 2,000 items each.
import type { FolderPreview } from '@liveworkspace/index-client';
import type { SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import type { Person } from './auth';
import { folderPreviewQueries } from './folder-previews';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const previews = async (auth: string, ids: string[], app?: string) =>
  body<{ previews: FolderPreview[] }>(
    await call(`/folders/previews?ids=${ids.join(',')}${app ? `&app=${app}` : ''}`, { auth }),
  );

const folder = async (auth: string, name: string, teamId?: string) =>
  (
    await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth, body: { name, teamId } }),
    )
  ).folder.id;

describe('GET /folders/previews', () => {
  it('gives each folder its four newest live items and its count, in the order asked', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const f1 = await folder(ada.auth, 'One');
    const f2 = await folder(ada.auth, 'Two', 'team1');
    const empty = await folder(ada.auth, 'Empty');
    const made = [];
    for (let i = 0; i < 6; i++)
      made.push(await makeItem(ada.auth, { title: `A${i}`, folderId: f1 }));
    await makeItem(ada.auth, { title: 'D', folderId: f1, app: 'livediagram' });
    const t = await makeItem(ada.auth, { title: 'T', folderId: f2, teamId: 'team1' });
    const set = h.db.sql.prepare('UPDATE items SET updated_at = ? WHERE id = ?');
    made.forEach((item, i) => set.run(1000 + i, item.id));
    set.run(2000, t.id);
    await call(`/items/${made[5]!.id}`, { method: 'DELETE', auth: ada.auth });

    const all = await previews(ada.auth, [empty, f2, f1]);
    expect(all.previews.map((p) => p.folderId)).toEqual([empty, f2, f1]);
    const [e, two, one] = all.previews;
    expect(e).toEqual({ folderId: empty, itemCount: 0, items: [] });
    expect(two!.items.map((i) => i.title)).toEqual(['T']);
    // Six of Ada's plans and a diagram, one trashed: six live, the four newest shown.
    expect(one!.itemCount).toBe(6);
    expect(one!.items).toHaveLength(4);
    expect(one!.items[0]!.title).toBe('D');
    expect(one!.items.slice(1).map((i) => i.title)).toEqual(['A4', 'A3', 'A2']);

    const plans = await previews(ada.auth, [f1], 'liveplanner');
    expect(plans.previews[0]!.itemCount).toBe(5);
    expect(plans.previews[0]!.items.map((i) => i.title)).toEqual(['A4', 'A3', 'A2', 'A1']);
  });

  it('leaves out folders the person cannot reach, and refuses too many or bad ids', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e', { teams: [{ id: 'team9' }] });
    const mine = await folder(ada.auth, 'Mine');
    const hers = await folder(eve.auth, 'Hers');
    const team = await folder(eve.auth, 'Team', 'team9');
    await makeItem(eve.auth, { title: 'Secret', folderId: hers });
    const got = await previews(ada.auth, [mine, hers, team]);
    expect(got.previews.map((p) => p.folderId)).toEqual([mine]);

    const many = Array.from({ length: 61 }, (_, i) => `f${i}`).join(',');
    expect((await call(`/folders/previews?ids=${many}`, { auth: ada.auth })).status).toBe(400);
    expect((await call(`/folders/previews?ids=${mine}&app=nope`, { auth: ada.auth })).status).toBe(
      400,
    );
    expect((await previews(ada.auth, [])).previews).toEqual([]);
  });

  it('walks the folder index, never scanning the items table', () => {
    const ada: Person = { id: 'user_a', kind: 'account', teams: ['team1'] };
    for (const app of [null, 'liveplanner' as const]) {
      const q = folderPreviewQueries(ada, ['f1', 'f2'], app);
      for (const { sql, args } of [q.items, q.counts]) {
        const lines = h.db.sql
          .prepare(`EXPLAIN QUERY PLAN ${sql}`)
          .all(...(args as SQLInputValue[]))
          .map((r) => String((r as { detail: string }).detail));
        expect(
          lines.filter((l) => /\bSCAN (i|x|items)\b/.test(l)),
          lines.join('\n'),
        ).toEqual([]);
        expect(
          lines.some((l) => l.includes('items_folder')),
          lines.join('\n'),
        ).toBe(true);
      }
    }
  });

  it('answers 60 folders of 2,000 items each within budget, counting no further than the cap', async () => {
    const ada = await person('user_a');
    const db = h.db.sql;
    const ids: string[] = [];
    const insertFolder = db.prepare(
      `INSERT INTO folders (id, name, parent_id, owner_id, team_id, scope, created_at, updated_at)
       VALUES (?, ?, NULL, 'user_a', NULL, 'p:user_a', 0, 0)`,
    );
    const insertItem = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', 'user_a', NULL, 'p:user_a', ?, ?, '{}', ?, ?)`,
    );
    db.exec('BEGIN');
    for (let f = 0; f < 60; f++) {
      const id = `folder-${f}`;
      ids.push(id);
      insertFolder.run(id, `Folder ${f}`);
      for (let i = 0; i < 2000; i++) {
        insertItem.run(`item-${f}-${i}`, id, `Item ${i}`, i, 1_000_000 + i);
      }
    }
    db.exec('COMMIT');
    // CPU time, not wall clock: a busy runner's wait for a core is not the query's cost.
    let got!: { previews: FolderPreview[] };
    const took = await cpuMsOfAsync(async () => {
      got = await previews(ada.auth, ids);
    });
    expect(got.previews).toHaveLength(60);
    for (const p of got.previews) {
      expect(p.itemCount).toBe(1000);
      expect(p.items.map((i) => i.title)).toEqual([
        'Item 1999',
        'Item 1998',
        'Item 1997',
        'Item 1996',
      ]);
    }
    // eslint-disable-next-line no-console
    console.log(`[folder previews] 60 folders x 2,000 items: ${took.toFixed(1)} ms of CPU`);
    expect(took).toBeLessThan(cpuBudgetMs(500));
    // Seeding 120,000 items outruns the 5s default on a busy runner; the budget above times only the read.
  }, 30_000);
});
