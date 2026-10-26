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

  it('lists recent by last opened, favourites and the Trash', async () => {
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

describe('filters', () => {
  it('narrows by source, last change, owner, intent and space, values or-ed and filters and-ed', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bo = await person('user_b', { teams: [{ id: 'team1' }] });
    const ai = await makeItem(ada.auth, {
      title: 'AI made',
      source: 'ai',
      intent: 'plan:board:kanban',
    });
    const retro = await makeItem(ada.auth, { title: 'Retro', intent: 'plan:board:retrospective' });
    const old = await makeItem(ada.auth, { title: 'Old', intent: 'kanban' });
    const team = await makeItem(bo.auth, {
      title: 'Bo’s team plan',
      teamId: 'team1',
      source: 'ai',
    });
    const set = h.db.sql.prepare('UPDATE items SET updated_at = ? WHERE id = ?');
    [ai, retro, old, team].forEach((item, i) => set.run([5000, 4000, 1000, 3000][i]!, item.id));

    expect(titles(await list(ada.auth, 'source=ai'))).toEqual(['AI made', 'Bo’s team plan']);
    expect(titles(await list(ada.auth, 'since=2000'))).toEqual([
      'AI made',
      'Retro',
      'Bo’s team plan',
    ]);
    expect(titles(await list(ada.auth, 'owner=others'))).toEqual(['Bo’s team plan']);
    expect(titles(await list(ada.auth, 'owner=me&source=ai'))).toEqual(['AI made']);
    expect(titles(await list(ada.auth, 'intent=kanban'))).toEqual(['AI made', 'Old']);
    expect(titles(await list(ada.auth, 'intent=kanban,retrospective'))).toEqual([
      'AI made',
      'Retro',
      'Old',
    ]);
    expect(titles(await list(ada.auth, 'space=team:team1'))).toEqual(['Bo’s team plan']);
    expect(titles(await list(ada.auth, 'space=mine&since=2000'))).toEqual(['AI made', 'Retro']);
    for (const bad of [
      'source=robot',
      'since=-1',
      'since=soon',
      'owner=them',
      'intent=Kan%20ban',
      'space=elsewhere',
      'space=team:',
      'space=mine,team:',
      `intent=${Array.from({ length: 9 }, (_, i) => `w${i}`).join(',')}`,
      'deep=1',
    ]) {
      expect((await call(`/items?${bad}`, { auth: ada.auth })).status, bad).toBe(400);
    }
    expect((await call('/items?space=team:team9', { auth: ada.auth })).status).toBe(403);
  });

  it('narrows by the apps items open in (Opens in), with app as well', async () => {
    const ada = await person('user_a');
    await makeItem(ada.auth, { title: 'Plan' });
    await makeItem(ada.auth, { title: 'Canvas', app: 'livediagram' });
    await makeItem(ada.auth, { title: 'Doc', app: 'livedocuments' });
    expect(titles(await list(ada.auth, 'apps=livediagram')).sort()).toEqual(['Canvas']);
    expect(titles(await list(ada.auth, 'apps=livediagram,liveplanner')).sort()).toEqual([
      'Canvas',
      'Plan',
    ]);
    expect(titles(await list(ada.auth, 'app=liveplanner&apps=livediagram'))).toEqual([]);
    expect((await call('/items?apps=paint', { auth: ada.auth })).status).toBe(400);
  });

  it('narrows by the mode an item last reported (Mode), values or-ed', async () => {
    const ada = await person('user_a');
    const draw = await makeItem(ada.auth, { title: 'Sketch', app: 'livediagram' });
    const flow = await makeItem(ada.auth, { title: 'Flow', app: 'livediagram' });
    const room = await makeItem(ada.auth, { title: 'Room', app: 'livediagram' });
    // Never saved: no summary, so no mode.
    await makeItem(ada.auth, { title: 'Blank', app: 'livediagram' });
    const set = h.db.sql.prepare('UPDATE items SET summary = ? WHERE id = ?');
    set.run(JSON.stringify({ mode: 'draw', elements: 3 }), draw.id);
    set.run(JSON.stringify({ mode: 'diagram' }), flow.id);
    set.run(JSON.stringify({ mode: 'workshop' }), room.id);
    expect(titles(await list(ada.auth, 'modes=draw'))).toEqual(['Sketch']);
    expect(titles(await list(ada.auth, 'modes=draw,workshop')).sort()).toEqual(['Room', 'Sketch']);
    expect(titles(await list(ada.auth, 'modes=diagram&q=flow'))).toEqual(['Flow']);
    expect(titles(await list(ada.auth, 'modes=pages'))).toEqual([]);
    const tooMany = Array.from({ length: 9 }, (_, i) => `m${i}`).join(',');
    for (const bad of ['modes=Draw%20it', `modes=${tooMany}`]) {
      expect((await call(`/items?${bad}`, { auth: ada.auth })).status, bad).toBe(400);
    }
  });

  it('reaches a folder’s subfolders with deep', async () => {
    const ada = await person('user_a');
    const folder = async (name: string, parentId?: string) =>
      (
        await body<{ folder: { id: string } }>(
          await call('/folders', { method: 'POST', auth: ada.auth, body: { name, parentId } }),
        )
      ).folder.id;
    const top = await folder('Top');
    const mid = await folder('Mid', top);
    const low = await folder('Low', mid);
    const other = await folder('Other');
    await makeItem(ada.auth, { title: 'In top', folderId: top });
    await makeItem(ada.auth, { title: 'In low', folderId: low });
    await makeItem(ada.auth, { title: 'Elsewhere', folderId: other });
    expect(titles(await list(ada.auth, `folder=${top}`))).toEqual(['In top']);
    expect(new Set(titles(await list(ada.auth, `folder=${top}&deep=1`)))).toEqual(
      new Set(['In top', 'In low']),
    );
  });

  it('the search view lists mine, my teams’ and what was shared with me, never the Trash', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const eve = await person('user_e');
    await makeItem(ada.auth, { title: 'Road mine' });
    await makeItem(ada.auth, { title: 'Road team', teamId: 'team1' });
    const gone = await makeItem(ada.auth, { title: 'Road gone' });
    await call(`/items/${gone.id}`, { method: 'DELETE', auth: ada.auth });
    const theirs = await makeItem(eve.auth, { title: 'Road shared' });
    await makeItem(eve.auth, { title: 'Road unshared' });
    const link = await body<{ link: { code: string } }>(
      await call(`/items/${theirs.id}/share`, { method: 'POST', auth: eve.auth, body: {} }),
    );
    await call(`/share/${link.link.code}`, { auth: ada.auth });
    expect(new Set(titles(await list(ada.auth, 'view=search&q=road')))).toEqual(
      new Set(['Road mine', 'Road team', 'Road shared']),
    );
    expect(titles(await list(ada.auth, 'view=search&q=road&space=shared'))).toEqual([
      'Road shared',
    ]);
    expect(titles(await list(ada.auth, 'view=search&q=road&owner=others'))).toEqual([
      'Road shared',
    ]);
  });

  it('narrows Shared With Me by the same filters', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    for (const title of ['Alpha plan', 'Beta plan']) {
      const item = await makeItem(eve.auth, {
        title,
        ...(title.startsWith('A') ? { source: 'ai' } : {}),
      });
      const link = await body<{ link: { code: string } }>(
        await call(`/items/${item.id}/share`, { method: 'POST', auth: eve.auth, body: {} }),
      );
      await call(`/share/${link.link.code}`, { auth: ada.auth });
    }
    const shared = async (query: string) =>
      (
        await body<{ shared: { item: Item }[] }>(await call(`/shared?${query}`, { auth: ada.auth }))
      ).shared.map((s) => s.item.title);
    expect(new Set(await shared(''))).toEqual(new Set(['Alpha plan', 'Beta plan']));
    expect(await shared('q=beta%20plan')).toEqual(['Beta plan']);
    expect(await shared('source=ai')).toEqual(['Alpha plan']);
    expect(await shared('owner=me')).toEqual([]);
    expect((await call('/shared?owner=nobody', { auth: ada.auth })).status).toBe(400);
  });
});

describe('search', () => {
  it('matches titles and folder names', async () => {
    const ada = await person('user_a');
    const f = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'Budgets' } }),
    );
    await makeItem(ada.auth, { title: 'Roadmap 2027' });
    await makeItem(ada.auth, { title: 'Plain', folderId: f.folder.id });
    await makeItem(ada.auth, { title: 'Other' });
    expect(titles(await list(ada.auth, 'q=roadmap'))).toEqual(['Roadmap 2027']);
    expect(titles(await list(ada.auth, 'q=budget'))).toEqual(['Plain']);
    expect(titles(await list(ada.auth, 'q=zzz'))).toEqual([]);
  });

  it('needs every word, each in the title or the folder’s name', async () => {
    const ada = await person('user_a');
    const f = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'Budgets' } }),
    );
    await makeItem(ada.auth, { title: 'Road map 2027' });
    await makeItem(ada.auth, { title: 'Map of the road' });
    await makeItem(ada.auth, { title: 'Road', folderId: f.folder.id });
    await makeItem(ada.auth, { title: 'Map' });
    expect(new Set(titles(await list(ada.auth, 'q=road%20map')))).toEqual(
      new Set(['Road map 2027', 'Map of the road']),
    );
    expect(titles(await list(ada.auth, 'q=road%20budget'))).toEqual(['Road']);
    const many = Array.from({ length: 17 }, (_, i) => `w${i}`).join('%20');
    expect((await call(`/items?q=${many}`, { auth: ada.auth })).status).toBe(400);
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

  it('never finds through someone else’s folders', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    await makeItem(ada.auth, { title: 'Quiet' });
    await call('/folders', { method: 'POST', auth: eve.auth, body: { name: 'Quiet place' } });
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
    ['search words', { view: 'all', words: ['road', 'map'], limit: 50 }, 'items_live'],
    ['the search view', { view: 'search', limit: 50 }, 'items_live'],
    [
      'the search view, filtered',
      {
        view: 'search',
        words: ['road'],
        source: ['ai'],
        since: 1,
        owner: 'me',
        intent: ['kanban'],
        modes: ['draw'],
        apps: ['liveplanner', 'livediagram'],
        space: { mine: true, shared: true, teams: ['team1'] },
        limit: 50,
      },
      'items_live',
    ],
    ['a folder, deep', { view: 'all', folder: 'f1', deep: true, limit: 50 }, 'items_folder'],
    ['recent, filtered', { view: 'recent', since: 1, owner: 'others', limit: 50 }, 'opens_recent'],
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
    for (const query of [q.threads, q.actions, q.forms]) {
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
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
    );
    const modes = ['diagram', 'draw', 'workshop'];
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
        JSON.stringify({ mode: modes[i % 3], elements: i % 50 }),
        i,
        1_000_000 + i,
      );
    }
    // Every one of Ada's opened, a tenth starred.
    const open = db.prepare(
      'INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, ?, ?)',
    );
    const fav = db.prepare(
      'INSERT INTO favourites (person_id, item_id, created_at) VALUES (?, ?, ?)',
    );
    for (let i = 0; i < 2000; i++) {
      const id = `item-${String(i).padStart(6, '0')}`;
      open.run('user_a', id, 2_000_000 + i);
      if (i % 10 === 0) fav.run('user_a', id, i);
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
    const searchView = await time(
      'the search view, "roadmap", made in the last while',
      async () =>
        (await list(ada.auth, 'view=search&q=roadmap&since=1001000&limit=200')).items.length,
    );
    const deepest = await time('every word and filter', async () => {
      const q = 'view=search&q=item%20roadmap&owner=me&space=mine,team:team1&since=1&limit=200';
      return (await list(ada.auth, q)).items.length;
    });
    // Mode reads each candidate's summary: the common case, and one that matches nothing (every row read).
    const mode = await time(
      'mode: workshop, 200',
      async () => (await list(ada.auth, 'modes=workshop&limit=200')).items.length,
    );
    const modeNone = await time(
      'mode matching nothing, every row read',
      async () => (await list(ada.auth, 'modes=nowhere&limit=200')).items.length,
    );
    const favs = await time(
      'favourites',
      async () => (await list(ada.auth, 'view=favourites&limit=200')).items.length,
    );

    // Generous for a loaded CI machine; locally each is a few milliseconds.
    expect(firstPage).toBeLessThan(150);
    expect(walk).toBeLessThan(1500);
    for (const ms of [recent, oneApp, search, searchView, deepest, mode, modeNone, favs])
      expect(ms).toBeLessThan(250);

    const first = await list(ada.auth, 'limit=200');
    expect(first.items[0]).toMatchObject({ id: 'item-001999', favourite: false });
    expect(first.items.find((i) => i.id === 'item-001990')).toMatchObject({
      favourite: true,
      lastOpenedAt: 2_001_990,
    });
  });
});
