// The Google Drive mirror's side of the index (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The index"): its key acting
// for a person on their personal items only, in every app; the drive_mirrored flag; and the change signal.
import type { Folder, Item, ShareLink } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { sweep } from './purge';
import { body, call, h, makeItem, person, settle, useHarness } from './test-support';

type DriveCall = { url: string; headers: Headers; body: { personId: string; at: number } };

const driveCalls: DriveCall[] = [];
let driveAnswer = () => new Response(null, { status: 202 });

const DRIVE = {
  fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
    driveCalls.push({
      url: String(input),
      headers: new Headers(init.headers),
      body: JSON.parse(init.body as string) as DriveCall['body'],
    });
    return driveAnswer();
  },
} as unknown as Fetcher;

useHarness({ INDEX_KEY_DRIVE: 'drive-key', DRIVE_KEY_INDEX: 'drive-index-key', DRIVE });

const asDrive = (
  path: string,
  options: {
    method?: string;
    body?: unknown;
    personId?: string;
    key?: string;
    headers?: Record<string, string>;
  } = {},
) =>
  call(path, {
    method: options.method ?? 'GET',
    auth: options.key ?? 'drive-key',
    headers: {
      'X-Index-App': 'drive',
      'X-Index-Person': options.personId ?? 'user_a',
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: options.body } : {}),
  });

const flag = (personId: string, method: string, key = 'drive-key') =>
  call(`/app/people/${personId}/drive`, { method, auth: key });

// Every signal so far, after the responses' waitUntil work; cleared for the next step.
async function signalled(): Promise<string[]> {
  await settle();
  const people = driveCalls.map((c) => c.body.personId);
  driveCalls.length = 0;
  return people;
}

describe('the Drive mirror acting for a person', () => {
  it('lists their personal items in every app, an app filter still applying', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team_1' }] });
    const eve = await person('user_e');
    const plan = await makeItem(ada.auth, { title: 'Plan' });
    const canvas = await makeItem(ada.auth, { app: 'livediagram', title: 'Canvas' });
    await makeItem(ada.auth, { teamId: 'team_1', title: 'Team plan' });
    // An item shared with them, opened through its link: Shared with me, never the mirror's.
    const theirs = await makeItem(eve.auth);
    const link = await body<{ link: ShareLink }>(
      await call(`/items/${theirs.id}/share`, { method: 'POST', auth: eve.auth, body: {} }),
    );
    expect((await call(`/share/${link.link.code}`, { auth: ada.auth })).status).toBe(200);

    const all = await body<{ items: Item[] }>(await asDrive('/items'));
    expect(all.items.map((i) => i.id).sort()).toEqual([plan.id, canvas.id].sort());
    const one = await body<{ items: Item[] }>(await asDrive('/items?app=livediagram'));
    expect(one.items.map((i) => i.id)).toEqual([canvas.id]);
    const some = await body<{ items: Item[] }>(await asDrive('/items?apps=liveplanner'));
    expect(some.items.map((i) => i.id)).toEqual([plan.id]);
    // Views that reach links stay personal; Shared with me isn't the mirror's to read.
    const search = await body<{ items: Item[] }>(await asDrive('/items?view=search'));
    expect(search.items.map((i) => i.id).sort()).toEqual([plan.id, canvas.id].sort());
    const shared = await body<{ items: Item[] }>(await asDrive('/items?view=shared'));
    expect(shared.items).toEqual([]);
    expect((await asDrive('/shared')).status).toBe(404);
    expect((await asDrive(`/items/${theirs.id}`)).status).toBe(404);
    // A team asked for by name is refused, as for anyone not in it.
    expect((await asDrive('/items?team=team_1')).status).toBe(403);
  });

  it('answers a team item as missing, to read and to write, whatever teams it names', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team_1' }] });
    const team = await makeItem(ada.auth, { teamId: 'team_1' });
    const own = await makeItem(ada.auth);
    const teams = { 'X-Index-Teams': 'team_1' };
    expect((await asDrive(`/items/${team.id}`, { headers: teams })).status).toBe(404);
    expect(
      (await asDrive(`/items/${team.id}`, { method: 'PATCH', body: { title: 'x' } })).status,
    ).toBe(404);
    expect((await asDrive(`/items/${team.id}`, { method: 'DELETE' })).status).toBe(404);
    expect((await asDrive(`/items/${team.id}/copy`, { method: 'POST', body: {} })).status).toBe(
      404,
    );
    // Nor can it move their own into a team, or make one there.
    const move = await asDrive(`/items/${own.id}`, {
      method: 'PATCH',
      body: { teamId: 'team_1' },
      headers: teams,
    });
    expect(move.status).toBe(403);
    const made = await asDrive('/items', {
      method: 'POST',
      body: { app: 'livedesign', teamId: 'team_1' },
    });
    expect(made.status).toBe(403);
    // Its own item, in any app, is the person's to change.
    const renamed = await asDrive(`/items/${own.id}`, {
      method: 'PATCH',
      body: { title: 'Mirrored' },
    });
    expect((await body<{ item: Item }>(renamed)).item.title).toBe('Mirrored');
  });

  it('works in their own folder tree only', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team_1' }] });
    const teamFolder = await body<{ folder: Folder }>(
      await call('/folders', {
        method: 'POST',
        auth: ada.auth,
        body: { name: 'T', teamId: 'team_1' },
      }),
    );
    const made = await asDrive('/folders', { method: 'POST', body: { name: 'Mine' } });
    expect(made.status).toBe(201);
    const listed = await body<{ folders: Folder[] }>(await asDrive('/folders'));
    expect(listed.folders.map((f) => f.name)).toEqual(['Mine']);
    expect(
      (await asDrive(`/folders/${teamFolder.folder.id}`, { method: 'PATCH', body: { name: 'x' } }))
        .status,
    ).toBe(404);
  });

  it('is refused for a guest (403), and without its key (401)', async () => {
    expect((await asDrive('/items', { personId: 'guest_123' })).status).toBe(403);
    expect((await asDrive('/items', { key: 'wrong' })).status).toBe(401);
    // An app's key is not the mirror's.
    expect((await asDrive('/items', { key: 'lp-key' })).status).toBe(401);
    expect((await asDrive('/items', { personId: 'link:ABCD' })).status).toBe(401);
    // Its key opens no other /app route.
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const push = await call(`/app/items/${item.id}/summary`, {
      method: 'PUT',
      auth: 'drive-key',
      headers: { 'X-Index-App': 'drive' },
      body: { summary: {}, updatedAt: 1 },
    });
    expect(push.status).toBe(401);
  });
});

describe('the drive_mirrored flag', () => {
  it('is set, read and cleared with the mirror’s key only', async () => {
    expect(await body(await flag('user_a', 'GET'))).toEqual({ mirrored: false });
    expect((await flag('user_a', 'PUT')).status).toBe(204);
    expect((await flag('user_a', 'PUT')).status).toBe(204);
    expect(await body(await flag('user_a', 'GET'))).toEqual({ mirrored: true });
    expect((await flag('user_a', 'DELETE')).status).toBe(204);
    expect(await body(await flag('user_a', 'GET'))).toEqual({ mirrored: false });

    expect((await flag('user_a', 'PUT', 'lp-key')).status).toBe(401);
    expect((await flag('user_a', 'PUT', 'merge-key')).status).toBe(401);
    expect((await flag('guest_1', 'PUT')).status).toBe(403);
  });

  it('goes when the person is purged', async () => {
    await flag('user_a', 'PUT');
    const res = await call('/internal/purge-person', {
      method: 'POST',
      auth: 'merge-key',
      body: { personId: 'user_a' },
    });
    expect(res.status).toBe(200);
    await settle();
    expect(h.db.sql.prepare('SELECT * FROM drive_people').all()).toEqual([]);
  });
});

describe('the change signal', () => {
  it('tells the mirror of each kind of change to a flagged person’s own work, once a request', async () => {
    driveCalls.length = 0;
    driveAnswer = () => new Response(null, { status: 202 });
    const ada = await person('user_a', { teams: [{ id: 'team_1' }] });
    await flag('user_a', 'PUT');

    const item = await makeItem(ada.auth);
    expect(await signalled()).toEqual(['user_a']);

    // The call itself: the binding, the key, the person and when.
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'One' } });
    await settle();
    expect(driveCalls).toHaveLength(1);
    expect(driveCalls[0]!.url).toBe('https://drive/app/changes');
    expect(driveCalls[0]!.headers.get('authorization')).toBe('Bearer drive-index-key');
    expect(driveCalls[0]!.body).toEqual({ personId: 'user_a', at: expect.any(Number) });
    driveCalls.length = 0;

    const folder = await body<{ folder: Folder }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'F' } }),
    );
    expect(await signalled()).toEqual(['user_a']);
    await call(`/folders/${folder.folder.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { name: 'G' },
    });
    expect(await signalled()).toEqual(['user_a']);

    // A rename and a move in one request: one call.
    await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { title: 'Two', folderId: folder.folder.id },
    });
    expect(await signalled()).toEqual(['user_a']);

    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    expect(await signalled()).toEqual(['user_a']);
    await call(`/items/${item.id}/restore`, { method: 'POST', auth: ada.auth });
    expect(await signalled()).toEqual(['user_a']);

    const copy = await body<{ item: Item }>(
      await call(`/items/${item.id}/copy`, { method: 'POST', auth: ada.auth, body: {} }),
    );
    expect(await signalled()).toEqual(['user_a']);

    // Into a team and out again: the owner's mirror hears of both.
    await call(`/items/${copy.item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { teamId: 'team_1' },
    });
    expect(await signalled()).toEqual(['user_a']);
    // Changes to a team's item are not the mirror's.
    await call(`/items/${copy.item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'T' } });
    expect(await signalled()).toEqual([]);
    await call(`/items/${copy.item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { teamId: null },
    });
    expect(await signalled()).toEqual(['user_a']);

    // A content save that moves updatedAt on, and one that arrives late.
    const push = (updatedAt: number) =>
      call(`/app/items/${item.id}/summary`, {
        method: 'PUT',
        auth: 'lp-key',
        headers: { 'X-Index-App': 'liveplanner' },
        body: { summary: { elements: 1 }, updatedAt },
      });
    expect((await push(Date.now() + 60_000)).status).toBe(204);
    expect(await signalled()).toEqual(['user_a']);
    expect((await push(1)).status).toBe(204);
    expect(await signalled()).toEqual([]);

    await call(`/folders/${folder.folder.id}`, { method: 'DELETE', auth: ada.auth });
    expect(await signalled()).toEqual(['user_a']);

    await call(`/items/${item.id}?permanent=true`, { method: 'DELETE', auth: ada.auth });
    expect(await signalled()).toEqual(['user_a']);

    await call(`/items/${copy.item.id}`, { method: 'DELETE', auth: ada.auth });
    expect(await signalled()).toEqual(['user_a']);
    await call('/trash', { method: 'DELETE', auth: ada.auth });
    expect(await signalled()).toEqual(['user_a']);
  });

  it('reaches the mirror for its own writes as the person too', async () => {
    driveCalls.length = 0;
    await flag('user_a', 'PUT');
    const made = await asDrive('/items', { method: 'POST', body: { app: 'livedocuments' } });
    expect(made.status).toBe(201);
    expect(await signalled()).toEqual(['user_a']);
  });

  it('sends nothing for someone not flagged, and nothing without the binding', async () => {
    driveCalls.length = 0;
    const eve = await person('user_e');
    const item = await makeItem(eve.auth);
    await call(`/items/${item.id}`, { method: 'PATCH', auth: eve.auth, body: { title: 'x' } });
    expect(await signalled()).toEqual([]);

    await flag('user_e', 'PUT');
    const env = { ...h.db.env, DRIVE: undefined };
    await call(`/items/${item.id}`, { method: 'PATCH', auth: eve.auth, body: { title: 'y' }, env });
    await call('/items', { method: 'POST', auth: eve.auth, body: { app: 'liveplanner' }, env });
    expect(await signalled()).toEqual([]);
  });

  it('logs a failed call and answers the write as usual', async () => {
    driveCalls.length = 0;
    driveAnswer = () => new Response(null, { status: 500 });
    await flag('user_a', 'PUT');
    const ada = await person('user_a');
    const res = await call('/items', {
      method: 'POST',
      auth: ada.auth,
      body: { app: 'liveplanner' },
    });
    expect(res.status).toBe(201);
    expect(await signalled()).toEqual(['user_a']);
    driveAnswer = () => new Response(null, { status: 202 });
  });

  it('signals each flagged owner once from the daily sweep', async () => {
    driveCalls.length = 0;
    await flag('user_a', 'PUT');
    const ada = await person('user_a');
    const eve = await person('user_e');
    const a1 = await makeItem(ada.auth);
    const a2 = await makeItem(ada.auth);
    const e1 = await makeItem(eve.auth);
    await settle();
    driveCalls.length = 0;
    const longAgo = Date.now() - 40 * 86_400_000;
    h.db.sql
      .prepare('UPDATE items SET trashed_at = ? WHERE id IN (?, ?, ?)')
      .run(longAgo, a1.id, a2.id, e1.id);
    expect((await sweep(h.db.env)).purged).toBe(3);
    expect(await signalled()).toEqual(['user_a']);
  });
});
