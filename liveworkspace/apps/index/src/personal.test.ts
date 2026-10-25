// Folders, favourites and placement defaults over HTTP.
import type { Folder, Item } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

async function folder(auth: string, input: Record<string, unknown>) {
  const res = await call('/folders', { method: 'POST', auth, body: input });
  return { res, folder: res.status === 201 ? (await body<{ folder: Folder }>(res)).folder : null };
}

describe('folders', () => {
  it('makes a tree, personal and team, and lists it by scope', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const root = (await folder(ada.auth, { name: ' Work ' })).folder!;
    expect(root).toMatchObject({ name: 'Work', parentId: null, teamId: null, ownerId: 'user_a' });
    const child = (await folder(ada.auth, { id: 'client-made', name: 'Q4', parentId: root.id }))
      .folder!;
    expect(child).toMatchObject({ id: 'client-made', parentId: root.id });
    const team = (await folder(ada.auth, { name: 'Shared', teamId: 'team1' })).folder!;
    // A parent from another scope is refused.
    const mixed = await folder(ada.auth, { name: 'X', teamId: 'team1', parentId: root.id });
    expect(await body(mixed.res)).toEqual({ error: 'folder_not_found' });
    const notMember = await folder(ada.auth, { name: 'X', teamId: 'team2' });
    expect(await body(notMember.res)).toEqual({ error: 'not_team_member' });
    const taken = await folder(ada.auth, { id: 'client-made', name: 'Again' });
    expect(taken.res.status).toBe(409);
    expect(await body(taken.res)).toEqual({ error: 'folder_exists' });

    const all = await body<{ folders: Folder[] }>(await call('/folders', { auth: ada.auth }));
    expect(all.folders.map((f) => f.id).sort()).toEqual([root.id, child.id, team.id].sort());
    const teamOnly = await body<{ folders: Folder[] }>(
      await call('/folders?team=team1', { auth: ada.auth }),
    );
    expect(teamOnly.folders.map((f) => f.id)).toEqual([team.id]);
    const personal = await body<{ folders: Folder[] }>(
      await call('/folders?team=personal', { auth: ada.auth }),
    );
    expect(personal.folders).toHaveLength(2);
    // Someone else sees none of it.
    const bob = await person('user_b');
    expect(
      (await body<{ folders: Folder[] }>(await call('/folders', { auth: bob.auth }))).folders,
    ).toEqual([]);
    expect((await call(`/folders/${root.id}`, { method: 'DELETE', auth: bob.auth })).status).toBe(
      404,
    );
  });

  it('pages the tree', async () => {
    const ada = await person('user_a');
    for (let i = 0; i < 5; i++) await folder(ada.auth, { name: `F${i}` });
    const first = await body<{ folders: Folder[]; nextCursor: string }>(
      await call('/folders?limit=3', { auth: ada.auth }),
    );
    expect(first.folders).toHaveLength(3);
    const second = await body<{ folders: Folder[]; nextCursor: string | null }>(
      await call(`/folders?limit=3&cursor=${first.nextCursor}`, { auth: ada.auth }),
    );
    expect(second.folders).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.folders, ...second.folders].map((f) => f.id)).size).toBe(5);
  });

  it('renames and moves, refusing a cycle', async () => {
    const ada = await person('user_a');
    const a = (await folder(ada.auth, { name: 'A' })).folder!;
    const b = (await folder(ada.auth, { name: 'B', parentId: a.id })).folder!;
    const c = (await folder(ada.auth, { name: 'C', parentId: b.id })).folder!;
    const cycle = await call(`/folders/${a.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { parentId: c.id },
    });
    expect(cycle.status).toBe(409);
    expect(await body(cycle)).toEqual({ error: 'cycle' });
    const self = await call(`/folders/${a.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { parentId: a.id },
    });
    expect(self.status).toBe(409);
    const moved = await body<{ folder: Folder }>(
      await call(`/folders/${c.id}`, {
        method: 'PATCH',
        auth: ada.auth,
        body: { parentId: null, name: 'Top' },
      }),
    );
    expect(moved.folder).toMatchObject({ parentId: null, name: 'Top' });
    const bad = await call(`/folders/${c.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { name: '' },
    });
    expect(await body(bad)).toEqual({ error: 'invalid_name' });
  });

  it('moves children and items up a level on delete', async () => {
    const ada = await person('user_a');
    const a = (await folder(ada.auth, { name: 'A' })).folder!;
    const b = (await folder(ada.auth, { name: 'B', parentId: a.id })).folder!;
    const c = (await folder(ada.auth, { name: 'C', parentId: b.id })).folder!;
    const item = await makeItem(ada.auth, { folderId: b.id });
    await call(`/placement-defaults/mode:plan`, {
      method: 'PUT',
      auth: ada.auth,
      body: { folderId: b.id },
    });
    expect((await call(`/folders/${b.id}`, { method: 'DELETE', auth: ada.auth })).status).toBe(204);
    expect(h.db.sql.prepare('SELECT parent_id FROM folders WHERE id = ?').get(c.id)).toEqual({
      parent_id: a.id,
    });
    expect(h.db.sql.prepare('SELECT folder_id FROM items WHERE id = ?').get(item.id)).toEqual({
      folder_id: a.id,
    });
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM placement_defaults').get()).toEqual({
      n: 0,
    });
  });

  it('lets any joined member manage a team folder', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const f = (await folder(ada.auth, { name: 'Team', teamId: 'team1' })).folder!;
    const renamed = await call(`/folders/${f.id}`, {
      method: 'PATCH',
      auth: bob.auth,
      body: { name: 'Ours' },
    });
    expect(renamed.status).toBe(200);
  });
});

describe('tags', () => {
  it('are gone: no tag routes, no tagIds on items', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    expect((await call('/tags', { auth: ada.auth })).status).toBe(404);
    expect(
      (await call('/tags', { method: 'POST', auth: ada.auth, body: { name: 'x', colour: 'red' } }))
        .status,
    ).toBe(404);
    expect(
      (await call(`/tags/t1/items/${item.id}`, { method: 'PUT', auth: ada.auth })).status,
    ).toBe(404);
    const got = await body<{ item: Item }>(await call(`/items/${item.id}`, { auth: ada.auth }));
    expect(got.item).not.toHaveProperty('tagIds');
  });
});

describe('favourites', () => {
  it('stars, lists and unstars, per person', async () => {
    const ada = await person('user_a');
    const one = await makeItem(ada.auth);
    const two = await makeItem(ada.auth);
    for (const id of [one.id, two.id]) {
      expect((await call(`/favourites/${id}`, { method: 'PUT', auth: ada.auth })).status).toBe(204);
    }
    expect((await call('/favourites/missing', { method: 'PUT', auth: ada.auth })).status).toBe(404);
    const page = await body<{ favourites: { itemId: string }[]; nextCursor: string }>(
      await call('/favourites?limit=1', { auth: ada.auth }),
    );
    expect(page.favourites).toHaveLength(1);
    const rest = await body<{ favourites: { itemId: string }[]; nextCursor: string | null }>(
      await call(`/favourites?limit=1&cursor=${page.nextCursor}`, { auth: ada.auth }),
    );
    expect(rest.favourites).toHaveLength(1);
    expect(rest.nextCursor).toBeNull();
    const item = await body<{ item: Item }>(await call(`/items/${one.id}`, { auth: ada.auth }));
    expect(item.item.favourite).toBe(true);
    await call(`/favourites/${one.id}`, { method: 'DELETE', auth: ada.auth });
    const after = await body<{ item: Item }>(await call(`/items/${one.id}`, { auth: ada.auth }));
    expect(after.item.favourite).toBe(false);
    expect((await call('/favourites?cursor=garbage!', { auth: ada.auth })).status).toBe(400);
  });
});

describe('placement defaults', () => {
  it('sets, lists and clears, only to a reachable folder', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b');
    const mine = (await folder(ada.auth, { name: 'Mine' })).folder!;
    const team = (await folder(ada.auth, { name: 'Team', teamId: 'team1' })).folder!;
    const put = (key: string, folderId: string, auth = ada.auth) =>
      call(`/placement-defaults/${encodeURIComponent(key)}`, {
        method: 'PUT',
        auth,
        body: { folderId },
      });
    expect((await put('mode:plan', mine.id)).status).toBe(204);
    expect((await put('mode:board', team.id)).status).toBe(204);
    expect((await put('mode:plan', team.id)).status).toBe(204);
    expect(await body(await put('mode:plan', mine.id, bob.auth))).toEqual({
      error: 'folder_not_found',
    });
    expect(await body(await put('bad key!', mine.id))).toEqual({ error: 'invalid_key' });
    const listed = await body<{ defaults: { key: string; folderId: string }[] }>(
      await call('/placement-defaults', { auth: ada.auth }),
    );
    expect(listed.defaults).toEqual([
      { key: 'mode:board', folderId: team.id },
      { key: 'mode:plan', folderId: team.id },
    ]);
    await call('/placement-defaults/mode:board', { method: 'DELETE', auth: ada.auth });
    const after = await body<{ defaults: unknown[] }>(
      await call('/placement-defaults', { auth: ada.auth }),
    );
    expect(after.defaults).toHaveLength(1);
  });
});
