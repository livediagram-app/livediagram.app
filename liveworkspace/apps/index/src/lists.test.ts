// The Explorer's lists: every view and filter, search taken literally, paging, what each person may see,
// the query plans (no list may scan the items table), and a time budget at 2,000 items.
import type { Item } from '@liveworkspace/index-client';
import type { SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { Person } from './auth';
import { decodeCursor } from './codec';
import { inboxQueries } from './inbox';
import { buildListQuery, type ListSpec } from './lists';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

type Page = { items: Item[]; nextCursor: string | null };

const list = async (auth: string, query = '') =>
  body<Page>(await call(`/items${query ? `?${query}` : ''}`, { auth }));

const titles = (page: Page) => page.items.map((i) => i.title);

describe('views and filters', () => {
  it('lists mine and my teams’ by last change, and filters by app, team and folder', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const f = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'F' } }),
    );
    const a = await makeItem(ada.auth, { title: 'A' });
    const b = await makeItem(ada.auth, { title: 'B', app: 'livediagram' });
    const c = await makeItem(ada.auth, { title: 'C', teamId: 'team1' });
    const d = await makeItem(ada.auth, { title: 'D', folderId: f.folder.id });
    const set = h.db.sql.prepare('UPDATE items SET updated_at = ? WHERE id = ?');
    [a, b, c, d].forEach((item, i) => set.run(1000 + i, item.id));
    // Someone else's never shows.
    const eve = await person('user_e');
    await makeItem(eve.auth, { title: 'E' });

    expect(titles(await list(ada.auth))).toEqual(['D', 'C', 'B', 'A']);
    expect(titles(await list(ada.auth, 'app=livediagram'))).toEqual(['B']);
    expect(titles(await list(ada.auth, 'team=team1'))).toEqual(['C']);
    expect(titles(await list(ada.auth, 'team=personal'))).toEqual(['D', 'B', 'A']);
    expect(titles(await list(ada.auth, `folder=${f.folder.id}`))).toEqual(['D']);
    expect(titles(await list(ada.auth, 'view=unsorted'))).toEqual(['C', 'B', 'A']);
    expect((await call('/items?team=team9', { auth: ada.auth })).status).toBe(403);
    expect((await call('/items?view=nope', { auth: ada.auth })).status).toBe(400);
    expect((await call('/items?app=nope', { auth: ada.auth })).status).toBe(400);
    expect((await call('/items?limit=201', { auth: ada.auth })).status).toBe(400);
    expect((await call('/items?folder=missing', { auth: ada.auth })).status).toBe(404);
  });

  it('lists recent by last opened, favourites, a tag, and the Trash', async () => {
    const ada = await person('user_a');
    const a = await makeItem(ada.auth, { title: 'A' });
    const b = await makeItem(ada.auth, { title: 'B' });
    const c = await makeItem(ada.auth, { title: 'C' });
    const open = h.db.sql.prepare(
      'INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, ?, ?)',
    );
    open.run('user_a', a.id, 3000);
    open.run('user_a', b.id, 2000);
    expect(titles(await list(ada.auth, 'view=recent'))).toEqual(['A', 'B']);
    await call(`/favourites/${c.id}`, { method: 'PUT', auth: ada.auth });
    expect(titles(await list(ada.auth, 'view=favourites'))).toEqual(['C']);
    await call('/tags', {
      method: 'POST',
      auth: ada.auth,
      body: { id: 't1', name: 'Red', colour: 'red' },
    });
    await call(`/tags/t1/items/${b.id}`, { method: 'PUT', auth: ada.auth });
    expect(titles(await list(ada.auth, 'tag=t1'))).toEqual(['B']);
    expect((await call('/items?tag=nope', { auth: ada.auth })).status).toBe(404);
    await call(`/items/${a.id}`, { method: 'DELETE', auth: ada.auth });
    expect(titles(await list(ada.auth, 'view=trash'))).toEqual(['A']);
    // Trashed items leave every other view.
    expect(titles(await list(ada.auth, 'view=recent'))).toEqual(['B']);
  });

  it('keeps an opened link item in Recent only while its link lives', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const item = await makeItem(ada.auth, { title: 'Shared' });
    const { link } = await body<{ link: { code: string } }>(
      await call(`/items/${item.id}/share`, {
        method: 'POST',
        auth: ada.auth,
        body: { level: 'view' },
      }),
    );
    await call(`/items/${item.id}/open`, {
      method: 'POST',
      auth: bob.auth,
      headers: { 'X-Share-Code': link.code },
    });
    const recent = await list(bob.auth, 'view=recent');
    expect(recent.items.map((i) => [i.title, i.access, i.sharedVia])).toEqual([
      ['Shared', 'view', link.code],
    ]);
    await call(`/share/${link.code}`, { method: 'DELETE', auth: ada.auth });
    expect((await list(bob.auth, 'view=recent')).items).toEqual([]);
  });

  it('pages without repeats or gaps', async () => {
    const ada = await person('user_a');
    const ids = new Set<string>();
    for (let i = 0; i < 7; i++) ids.add((await makeItem(ada.auth)).id);
    // Ties on updatedAt are broken by id.
    h.db.sql.prepare('UPDATE items SET updated_at = 5').run();
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Page = await list(ada.auth, `limit=3${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(7);
    expect(new Set(seen)).toEqual(ids);
    expect((await call('/items?cursor=%%%', { auth: ada.auth })).status).toBe(400);
  });
});

describe('search', () => {
  it('matches titles, tag names and folder names', async () => {
    const ada = await person('user_a');
    const f = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'Budgets' } }),
    );
    await makeItem(ada.auth, { title: 'Roadmap 2027' });
    await makeItem(ada.auth, { title: 'Plain', folderId: f.folder.id });
    const tagged = await makeItem(ada.auth, { title: 'Tagged' });
    await makeItem(ada.auth, { title: 'Other' });
    await call('/tags', {
      method: 'POST',
      auth: ada.auth,
      body: { id: 't1', name: 'Launch', colour: 'red' },
    });
    await call(`/tags/t1/items/${tagged.id}`, { method: 'PUT', auth: ada.auth });
    expect(titles(await list(ada.auth, 'q=roadmap'))).toEqual(['Roadmap 2027']);
    expect(titles(await list(ada.auth, 'q=budget'))).toEqual(['Plain']);
    expect(titles(await list(ada.auth, 'q=LAUNCH'))).toEqual(['Tagged']);
    expect(titles(await list(ada.auth, 'q=zzz'))).toEqual([]);
  });

  it('takes %, _ and \\ literally', async () => {
    const ada = await person('user_a');
    await makeItem(ada.auth, { title: '100% done' });
    await makeItem(ada.auth, { title: '100 done' });
    await makeItem(ada.auth, { title: 'a_b' });
    await makeItem(ada.auth, { title: 'axb' });
    await makeItem(ada.auth, { title: 'back\\slash' });
    expect(titles(await list(ada.auth, `q=${encodeURIComponent('100%')}`))).toEqual(['100% done']);
    expect(titles(await list(ada.auth, 'q=a_b'))).toEqual(['a_b']);
    expect(titles(await list(ada.auth, `q=${encodeURIComponent('k\\s')}`))).toEqual([
      'back\\slash',
    ]);
    expect(titles(await list(ada.auth, 'q=%'))).toEqual(['100% done']);
  });

  it('never finds through someone else’s tags or folders', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth, { title: 'Quiet' });
    await call('/folders', { method: 'POST', auth: eve.auth, body: { name: 'Quiet place' } });
    await call('/tags', {
      method: 'POST',
      auth: eve.auth,
      body: { id: 'te', name: 'Quiet', colour: 'red' },
    });
    await call(`/tags/te/items/${item.id}`, { method: 'PUT', auth: eve.auth });
    expect((await list(eve.auth, 'q=quiet')).items).toEqual([]);
  });
});

// The plans SQLite picks for each list. A plan line `SCAN i` (or `SCAN items`) would read every item in
// the table: no list may have one.
describe('query plans', () => {
  const ada: Person = { id: 'user_a', kind: 'account', teams: ['team1', 'team2'] };
  const cursor = decodeCursor('WzE3MDAwMDAwMDAwMDAsImlkIl0')!;
  // Each list, and the index its plan must start from.
  const specs: [string, ListSpec, string][] = [
    ['all', { view: 'all', limit: 50 }, 'items_live'],
    ['all, one app', { view: 'all', app: 'liveplanner', limit: 50 }, 'items_live_app'],
    ['all, a page on', { view: 'all', limit: 50, cursor }, 'items_live'],
    ['a team', { view: 'all', scopes: ['t:team1'], limit: 50 }, 'items_live'],
    ['a folder', { view: 'all', folder: 'f1', limit: 50 }, 'items_folder'],
    ['unsorted', { view: 'unsorted', limit: 50 }, 'items_unsorted'],
    ['trash', { view: 'trash', limit: 50 }, 'items_trash'],
    ['recent', { view: 'recent', limit: 50 }, 'opens_recent'],
    ['favourites', { view: 'favourites', limit: 50 }, 'favourites_person_created'],
    ['shared', { view: 'shared', limit: 50 }, 'sqlite_autoindex_shared_with_1'],
    ['a tag', { view: 'all', tag: 't1', limit: 50 }, 'sqlite_autoindex_item_tags_1'],
    ['search', { view: 'all', q: 'road', limit: 50 }, 'items_live'],
  ];

  function plan(sql: string, args: unknown[]): string[] {
    const rows = h.db.sql.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(args as SQLInputValue[]));
    return rows.map((r) => String((r as { detail: string }).detail));
  }

  for (const [name, spec, index] of specs) {
    it(`${name} walks ${index}`, () => {
      const { sql, args } = buildListQuery(ada, spec);
      const lines = plan(sql, args);
      expect(
        lines.filter((l) => /\bSCAN (i|items)\b/.test(l)),
        lines.join('\n'),
      ).toEqual([]);
      expect(
        lines.some((l) => l.includes(`INDEX ${index} (`)),
        lines.join('\n'),
      ).toBe(true);
    });
  }

  it('the Inbox walks indexes', () => {
    const q = inboxQueries('user_a', ['p:user_a', 't:team1'], null, 100);
    for (const query of [q.threads, q.actions]) {
      const lines = plan(query.sql, query.args);
      expect(
        lines.filter((l) => /\bSCAN (i|items|t|a|collab_\w+|p)\b(?! USING)/.test(l)),
        lines.join('\n'),
      ).toEqual([]);
    }
  });
});

describe('at 2,000 items', () => {
  it('lists, pages, filters and searches within budget', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const db = h.db.sql;
    const apps = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'];
    const kinds = ['canvas', 'plan', 'document', 'design'];
    const insert = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, '{}', ?, ?)`,
    );
    db.exec('BEGIN');
    // 2,000 of Ada's (a quarter in her team), and 20,000 of other people's around them.
    for (let i = 0; i < 22_000; i++) {
      const owner = i < 2000 ? 'user_a' : `user_${i % 500}`;
      const team = i < 2000 && i % 4 === 0 ? 'team1' : null;
      const scope = team ? `t:${team}` : `p:${owner}`;
      insert.run(
        `item-${String(i).padStart(6, '0')}`,
        apps[i % 4]!,
        kinds[i % 4]!,
        owner,
        team,
        scope,
        `Item ${i} ${i % 7 === 0 ? 'roadmap' : 'notes'}`,
        i,
        1_000_000 + i,
      );
    }
    // Every one of Ada's opened, a tenth starred and tagged.
    db.prepare(
      "INSERT INTO tags (id, owner_id, name, colour, created_at, updated_at) VALUES ('t1', 'user_a', 'Launch', 'red', 0, 0)",
    ).run();
    const open = db.prepare(
      'INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, ?, ?)',
    );
    const fav = db.prepare(
      'INSERT INTO favourites (person_id, item_id, created_at) VALUES (?, ?, ?)',
    );
    const tag = db.prepare('INSERT INTO item_tags (tag_id, item_id, created_at) VALUES (?, ?, ?)');
    for (let i = 0; i < 2000; i++) {
      const id = `item-${String(i).padStart(6, '0')}`;
      open.run('user_a', id, 2_000_000 + i);
      if (i % 10 === 0) {
        fav.run('user_a', id, i);
        tag.run('t1', id, i);
      }
    }
    db.exec('COMMIT');

    const time = async (label: string, run: () => Promise<number>) => {
      const start = performance.now();
      const count = await run();
      const ms = performance.now() - start;
      console.log(`[perf] ${label}: ${count} items in ${ms.toFixed(1)} ms`);
      return ms;
    };

    const firstPage = await time(
      'first page of 200',
      async () => (await list(ada.auth, 'limit=200')).items.length,
    );
    const walk = await time('every page, 200 at a time', async () => {
      let n = 0;
      let cursor: string | null = null;
      do {
        const page: Page = await list(ada.auth, `limit=200${cursor ? `&cursor=${cursor}` : ''}`);
        n += page.items.length;
        cursor = page.nextCursor;
      } while (cursor);
      expect(n).toBe(2000);
      return n;
    });
    const recent = await time(
      'recent, 200',
      async () => (await list(ada.auth, 'view=recent&limit=200')).items.length,
    );
    const oneApp = await time(
      'one app, 200',
      async () => (await list(ada.auth, 'app=liveplanner&limit=200')).items.length,
    );
    const search = await time(
      'search "roadmap"',
      async () => (await list(ada.auth, 'q=roadmap&limit=200')).items.length,
    );
    const tagged = await time(
      'a tag',
      async () => (await list(ada.auth, 'tag=t1&limit=200')).items.length,
    );
    const favs = await time(
      'favourites',
      async () => (await list(ada.auth, 'view=favourites&limit=200')).items.length,
    );

    // Generous for a loaded CI machine; locally each is a few milliseconds.
    expect(firstPage).toBeLessThan(150);
    expect(walk).toBeLessThan(1500);
    for (const ms of [recent, oneApp, search, tagged, favs]) expect(ms).toBeLessThan(250);

    const first = await list(ada.auth, 'limit=200');
    expect(first.items[0]).toMatchObject({ id: 'item-001999', favourite: false });
    expect(first.items.find((i) => i.id === 'item-001990')).toMatchObject({
      favourite: true,
      tagIds: ['t1'],
      lastOpenedAt: 2_001_990,
    });
  });
});
