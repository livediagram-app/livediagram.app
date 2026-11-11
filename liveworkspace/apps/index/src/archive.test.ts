// Archived (blueprints/archive.md): who may archive, what the archive deletes for good, the refusals while it lasts,
// the preview it keeps, the lists it leaves and the ones it stays in, the move out, the Trash, a team's item, the
// share roles, and the paths beside (the empty clean-up, collab pushes, the guest merge, connected tabs).
import type { Item } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { sweepEmpty } from './purge';
import { body, call, h, makeItem, person, settle, useHarness } from './test-support';

useHarness();

type Listed = { items: Item[]; mostUsed?: Item[]; mine?: { count: number }; any?: boolean };

const archive = (auth: string, id: string, headers: Record<string, string> = {}) =>
  call(`/items/${id}/archive`, { method: 'POST', auth, headers });

const list = async (auth: string, query: string) =>
  body<Listed>(await call(`/items?${query}`, { auth }));

const ids = (out: { items: Item[] }) => out.items.map((i) => i.id);

const share = async (auth: string, itemId: string, level = 'edit') =>
  (
    await body<{ link: { code: string } }>(
      await call(`/items/${itemId}/share`, { method: 'POST', auth, body: { level } }),
    )
  ).link;

const count = (table: string, itemId: string) =>
  (
    h.db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE item_id = ?`).get(itemId) as {
      n: number;
    }
  ).n;

const asApp = (path: string, payload: unknown) =>
  call(path, {
    method: 'PUT',
    auth: 'lp-key',
    headers: { 'X-Index-App': 'liveplanner' },
    body: payload,
  });

// A link visitor opens it, so they hold a Shared with me row, a Recent row and a use day; and a favourite.
async function visited(itemId: string, code: string, auth: string) {
  const headers = { 'X-Share-Code': code };
  expect((await call(`/share/${code}`, { auth, headers })).status).toBe(200);
  expect((await call(`/items/${itemId}/open`, { method: 'POST', auth, headers })).status).toBe(204);
  expect((await call(`/favourites/${itemId}`, { method: 'PUT', auth })).status).toBe(204);
}

describe('archiving', () => {
  it('moves the owner’s item to Archived, out of its folder', async () => {
    const ada = await person('user_a');
    const folder = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'F' } }),
    );
    const item = await makeItem(ada.auth, { folderId: folder.folder.id });
    const res = await archive(ada.auth, item.id);
    expect(res.status).toBe(200);
    const { item: out } = await body<{ item: Item }>(res);
    expect(out).toMatchObject({ id: item.id, folderId: null, teamId: null, access: 'edit' });
    expect(out.archivedAt).toEqual(expect.any(Number));
    const row = h.db.sql.prepare('SELECT scope FROM items WHERE id = ?').get(item.id) as {
      scope: string;
    };
    expect(row.scope).toBe('a:user_a');
    // Again: unchanged.
    const again = await body<{ item: Item }>(await archive(ada.auth, item.id));
    expect(again.item.archivedAt).toBe(out.archivedAt);
  });

  it('deletes its links, password, Shared with me, favourites, Recent, Most Used and Inbox rows for everyone', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id);
    await visited(item.id, link.code, bob.auth);
    await call(`/items/${item.id}/open`, { method: 'POST', auth: ada.auth });
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: ada.auth });
    await call(`/items/${item.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: 'secret-1' },
    });
    await asApp(`/app/items/${item.id}/collab/t1`, {
      tabName: 'Tab',
      threads: [
        {
          elementId: 'e1',
          elementLabel: 'Card',
          resolved: false,
          commentCount: 1,
          participantIds: ['user_a'],
          mentionedIds: ['user_b'],
          latestText: 'Hi',
          latestAuthorName: 'Ada',
          firstAt: 1,
          latestAt: 2,
        },
      ],
      actions: [
        {
          elementId: 'e1',
          actionId: 'a1',
          elementLabel: 'Card',
          name: 'Do it',
          status: 'open',
          assigneeId: 'user_b',
          assignerId: 'user_a',
          teamId: null,
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    });
    expect(count('collab_threads', item.id)).toBe(1);
    expect(count('favourites', item.id)).toBe(2);
    h.appCalls = [];

    expect((await archive(ada.auth, item.id)).status).toBe(200);
    await settle();
    for (const table of [
      'share_links',
      'share_passwords',
      'shared_with',
      'favourites',
      'opens',
      'use_days',
      'collab_threads',
      'collab_thread_people',
      'collab_actions',
    ]) {
      expect(count(table, item.id), table).toBe(0);
    }
    // The app ends the sessions the link admitted.
    const revoke = h.appCalls.find((c) => c.url.endsWith(`/items/${item.id}/revoke`));
    expect(revoke?.body).toEqual({ codes: [link.code] });
    // The link opens nothing, and Bob's Inbox no longer lists it.
    expect(
      (
        await call(`/share/${link.code}`, {
          auth: bob.auth,
          headers: { 'X-Share-Code': link.code },
        })
      ).status,
    ).toBe(404);
    const inbox = await body<{ threads: unknown[]; actions: unknown[] }>(
      await call('/inbox', { auth: bob.auth }),
    );
    expect(inbox.threads).toEqual([]);
    expect(inbox.actions).toEqual([]);
  });

  it('records “To Archived” in its History, which stays its owner’s, and drops its favourites’ events', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: ada.auth });
    await archive(ada.auth, item.id);
    const events = h.db.sql
      .prepare('SELECT type, detail FROM events WHERE item_id = ? ORDER BY occurred_at')
      .all(item.id) as { type: string; detail: string | null }[];
    expect(events.map((e) => e.type)).toEqual(['created', 'moved']);
    expect(JSON.parse(events[1]!.detail!)).toMatchObject({ folderName: 'Archived', archived: '1' });
    // Its owner still reads its History while it is archived.
    const history = await body<{ events: { type: string }[] }>(
      await call(`/items/${item.id}/history`, { auth: ada.auth }),
    );
    expect(history.events.map((e) => e.type)).toEqual(['moved', 'created']);
  });

  it('refuses anyone but the owner, an item in the Trash, and a folder’s id', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const eve = await person('user_e');
    const team = await makeItem(ada.auth, { teamId: 'team1' });
    expect(await body(await archive(bob.auth, team.id))).toEqual({ error: 'not_owner' });
    expect((await archive(eve.auth, team.id)).status).toBe(404);
    const trashed = await makeItem(ada.auth);
    await call(`/items/${trashed.id}`, { method: 'DELETE', auth: ada.auth });
    const res = await archive(ada.auth, trashed.id);
    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({ error: 'trashed' });
    const folder = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'F' } }),
    );
    expect((await archive(ada.auth, folder.folder.id)).status).toBe(404);
  });

  it('is never a share role’s to do: Editor, Participant and Viewer links are refused, then shut out', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const item = await makeItem(ada.auth, { app: 'livediagram' });
    const links = {
      edit: await share(ada.auth, item.id, 'edit'),
      participate: await share(ada.auth, item.id, 'participate'),
      view: await share(ada.auth, item.id, 'view'),
    };
    for (const link of Object.values(links)) {
      const headers = { 'X-Share-Code': link.code };
      expect((await archive(bob.auth, item.id, headers)).status).toBe(403);
    }
    await archive(ada.auth, item.id);
    for (const link of Object.values(links)) {
      const headers = { 'X-Share-Code': link.code };
      expect((await call(`/items/${item.id}`, { auth: bob.auth, headers })).status).toBe(404);
      expect(
        (await call(`/items/${item.id}/grant`, { method: 'POST', auth: bob.auth, headers })).status,
      ).toBe(404);
    }
  });
});

describe('while archived', () => {
  it('refuses its owner a grant, an open, a copy, a favourite, Hide from Recent and sharing', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await archive(ada.auth, item.id);
    const refusals = [
      call(`/items/${item.id}/grant`, { method: 'POST', auth: ada.auth }),
      call(`/items/${item.id}/open`, { method: 'POST', auth: ada.auth }),
      call(`/items/${item.id}/copy`, { method: 'POST', auth: ada.auth, body: {} }),
      call(`/favourites/${item.id}`, { method: 'PUT', auth: ada.auth }),
      call(`/recent-hidden/${item.id}`, { method: 'PUT', auth: ada.auth }),
      call(`/items/${item.id}/share`, { method: 'POST', auth: ada.auth, body: {} }),
      call(`/items/${item.id}/share-password`, {
        method: 'PUT',
        auth: ada.auth,
        body: { password: 'secret-1' },
      }),
    ];
    for (const res of await Promise.all(refusals)) {
      expect(res.status).toBe(409);
      expect(await body(res)).toEqual({ error: 'archived' });
    }
    expect(count('opens', item.id)).toBe(0);
    expect(count('favourites', item.id)).toBe(0);
    expect(count('share_links', item.id)).toBe(0);
  });

  it('still answers its owner GET /items/:id, so its preview draws; nobody else', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    await archive(ada.auth, item.id);
    const res = await call(`/items/${item.id}`, { auth: ada.auth });
    expect(res.status).toBe(200);
    expect((await body<{ item: Item }>(res)).item.archivedAt).toEqual(expect.any(Number));
    expect((await call(`/items/${item.id}`, { auth: eve.auth })).status).toBe(404);
    const looked = await body<{ items: Item[] }>(
      await call('/items/lookup', { method: 'POST', auth: ada.auth, body: { ids: [item.id] } }),
    );
    expect(ids(looked)).toEqual([item.id]);
  });

  it('can be renamed, and stays archived', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await archive(ada.auth, item.id);
    const res = await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { title: 'Old plan' },
    });
    expect(res.status).toBe(200);
    expect((await body<{ item: Item }>(res)).item).toMatchObject({ title: 'Old plan' });
    expect(ids(await list(ada.auth, 'view=archived'))).toEqual([item.id]);
    expect((await call(`/items/${item.id}/grant`, { method: 'POST', auth: ada.auth })).status).toBe(
      409,
    );
  });

  it('takes an app’s collab push and keeps nothing of it', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await archive(ada.auth, item.id);
    const res = await asApp(`/app/items/${item.id}/collab/t1`, {
      tabName: 'Tab',
      threads: [
        {
          elementId: 'e1',
          elementLabel: 'Card',
          resolved: false,
          commentCount: 1,
          participantIds: ['user_a'],
          mentionedIds: [],
          latestText: 'Hi',
          latestAuthorName: 'Ada',
          firstAt: 1,
          latestAt: 2,
        },
      ],
      actions: [],
    });
    expect(res.status).toBe(204);
    expect(count('collab_threads', item.id)).toBe(0);
  });

  it('is passed by the empty clean-up', async () => {
    const ada = await person('user_a');
    const now = Date.now();
    const item = await makeItem(ada.auth);
    await archive(ada.auth, item.id);
    h.db.sql
      .prepare(`UPDATE items SET summary = '{"hasContent":false}', updated_at = ? WHERE id = ?`)
      .run(now - 40 * 86_400_000, item.id);
    expect(await sweepEmpty(h.db.env, now)).toBe(0);
  });
});

describe('the lists', () => {
  it('leave it out everywhere but Archived and Search', async () => {
    const ada = await person('user_a');
    const kept = await makeItem(ada.auth, { title: 'Roadmap kept' });
    const gone = await makeItem(ada.auth, { title: 'Roadmap old' });
    for (const id of [kept.id, gone.id]) {
      await call(`/items/${id}/open`, { method: 'POST', auth: ada.auth });
      await call(`/favourites/${id}`, { method: 'PUT', auth: ada.auth });
    }
    await archive(ada.auth, gone.id);
    for (const query of [
      'view=all',
      'view=unsorted',
      'view=recent',
      'view=favourites',
      'view=shared',
      'view=all&team=personal',
    ]) {
      expect(ids(await list(ada.auth, query)), query).not.toContain(gone.id);
    }
    const home = await list(ada.auth, 'view=recent&used=8&mine=50&any=1');
    expect(home.mostUsed!.map((i) => i.id)).toEqual([kept.id]);
    expect(home.mine).toEqual({ count: 1, more: false });

    const archived = await list(ada.auth, 'view=archived');
    expect(ids(archived)).toEqual([gone.id]);
    expect(archived.items[0]!.favourite).toBe(false);
    expect(ids(await list(ada.auth, 'view=archived&app=livediagram'))).toEqual([]);
    expect(ids(await list(ada.auth, 'view=archived&team=personal'))).toEqual([gone.id]);

    const search = await list(ada.auth, 'view=search&q=roadmap');
    expect(ids(search).sort()).toEqual([kept.id, gone.id].sort());
    expect(search.items.find((i) => i.id === gone.id)!.archivedAt).toEqual(expect.any(Number));
    expect(ids(await list(ada.auth, 'view=search&q=roadmap&space=mine'))).toContain(gone.id);
    expect(ids(await list(ada.auth, 'view=search&q=roadmap&team=personal'))).toContain(gone.id);
  });

  it('show nobody else an owner’s Archived', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const item = await makeItem(ada.auth, { teamId: 'team1', title: 'Team doc' });
    await archive(ada.auth, item.id);
    expect(ids(await list(bob.auth, 'view=archived'))).toEqual([]);
    expect(ids(await list(bob.auth, 'view=search&q=team'))).toEqual([]);
    expect(ids(await list(bob.auth, 'view=all&team=team1'))).toEqual([]);
    expect(ids(await list(ada.auth, 'view=archived&team=team1'))).toEqual([]);
  });
});

describe('a team’s item', () => {
  it('leaves the team for its maker’s Archived; teammates lose it', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const item = await makeItem(ada.auth, { teamId: 'team1' });
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: bob.auth });
    const { item: out } = await body<{ item: Item }>(await archive(ada.auth, item.id));
    expect(out).toMatchObject({ teamId: null, ownerId: 'user_a' });
    expect((await call(`/items/${item.id}`, { auth: bob.auth })).status).toBe(404);
    expect(ids(await list(bob.auth, 'view=favourites'))).toEqual([]);
    const audit = h.db.sql
      .prepare(`SELECT type FROM team_audit_events WHERE team_id = 'team1' AND item_id = ?`)
      .all(item.id) as { type: string }[];
    expect(audit.map((a) => a.type)).toContain('moved');
  });

  it('can move out into a team its owner is in, and not into one they aren’t', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const item = await makeItem(ada.auth, { teamId: 'team1' });
    await archive(ada.auth, item.id);
    const refused = await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { teamId: 'team9' },
    });
    expect(refused.status).toBe(403);
    const moved = await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { teamId: 'team1', folderId: null },
    });
    expect((await body<{ item: Item }>(moved)).item).toMatchObject({
      teamId: 'team1',
      archivedAt: null,
    });
    expect((await call(`/items/${item.id}`, { auth: bob.auth })).status).toBe(200);
  });
});

describe('moving out', () => {
  it('opens again, in My Work or a folder, and starts fresh', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await call(`/items/${item.id}/open`, { method: 'POST', auth: ada.auth });
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: ada.auth });
    const link = await share(ada.auth, item.id);
    await archive(ada.auth, item.id);
    const folder = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'Back' } }),
    );
    const res = await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { folderId: folder.folder.id },
    });
    const { item: out } = await body<{ item: Item }>(res);
    expect(out).toMatchObject({
      folderId: folder.folder.id,
      archivedAt: null,
      favourite: false,
      lastOpenedAt: null,
      hasLinks: false,
    });
    const row = h.db.sql.prepare('SELECT scope FROM items WHERE id = ?').get(item.id) as {
      scope: string;
    };
    expect(row.scope).toBe('p:user_a');
    expect((await call(`/items/${item.id}/grant`, { method: 'POST', auth: ada.auth })).status).toBe(
      200,
    );
    expect(ids(await list(ada.auth, 'view=recent'))).toEqual([]);
    expect(ids(await list(ada.auth, 'view=archived'))).toEqual([]);
    expect(ids(await list(ada.auth, `view=all&folder=${folder.folder.id}`))).toEqual([item.id]);
    // The old link stays gone.
    expect((await call(`/share/${link.code}`, { auth: ada.auth })).status).toBe(404);
    // Its History came back with it.
    const history = await body<{ events: { type: string }[] }>(
      await call(`/items/${item.id}/history`, { auth: ada.auth }),
    );
    expect(history.events.map((e) => e.type)).toContain('created');
  });

  it('to My Work’s root with teamId null', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await archive(ada.auth, item.id);
    const res = await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { teamId: null },
    });
    expect((await body<{ item: Item }>(res)).item.archivedAt).toBeNull();
    expect(ids(await list(ada.auth, 'view=unsorted'))).toEqual([item.id]);
  });
});

describe('the Trash', () => {
  it('takes an archived item, empties it, and a restore puts it back in Archived', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await archive(ada.auth, item.id);
    expect((await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth })).status).toBe(
      204,
    );
    expect(ids(await body<Listed>(await call('/trash', { auth: ada.auth })))).toEqual([item.id]);
    expect(ids(await list(ada.auth, 'view=archived'))).toEqual([]);
    const restored = await call(`/items/${item.id}/restore`, { method: 'POST', auth: ada.auth });
    expect((await body<{ item: Item }>(restored)).item.archivedAt).toEqual(expect.any(Number));
    expect(ids(await list(ada.auth, 'view=archived'))).toEqual([item.id]);

    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    const emptied = await body<{ purged: number }>(
      await call('/trash', { method: 'DELETE', auth: ada.auth }),
    );
    expect(emptied.purged).toBe(1);
    expect(h.db.sql.prepare('SELECT id FROM items WHERE id = ?').get(item.id)).toBeUndefined();
  });
});

describe('the guest merge', () => {
  it('keeps a guest’s archived items archived, in the account’s Archived', async () => {
    const guest = await person('guest_g1', { guest: true });
    const user = await person('user_u1');
    const item = await makeItem(guest.auth);
    await archive(guest.auth, item.id);
    const res = await call('/internal/merge', {
      method: 'POST',
      auth: 'merge-key',
      body: { guestId: 'guest_g1', userId: 'user_u1' },
    });
    expect(res.status).toBe(200);
    expect(ids(await list(user.auth, 'view=archived'))).toEqual([item.id]);
    expect(ids(await list(user.auth, 'view=all'))).toEqual([]);
  });
});
