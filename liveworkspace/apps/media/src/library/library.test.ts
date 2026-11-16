// The Library over HTTP (liveworkspace/docs/specs/006-media/libraries.md): who may save, place and tidy (Personal is its
// owner's, a team's members add, its admins tidy), kinds an app lacks, pictures copied under the team's grant, the old
// shape libraries read in place and copied on first write, and an owner's items through merge and delete.
import type {
  LibraryItemSummary,
  LibraryListResponse,
  LibraryPlaceResponse,
  MediaUploadResponse,
} from '@liveworkspace/media';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import type { Env } from '../env';
import { testDb, type TestDb } from '../test-sqlite-d1';

const BASE = 'https://liveworkspace.app/api/media';

let db: TestDb;
beforeEach(() => {
  db = testDb();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const call = (path: string, init: RequestInit = {}, env: Env = db.env) =>
  worker.fetch(new Request(`${BASE}${path}`, init), env);

const asDiagram = (path: string, init: RequestInit = {}, env?: Env) =>
  call(
    path,
    {
      ...init,
      headers: {
        Authorization: 'Bearer ld-key',
        'X-Media-App': 'livediagram.app',
        ...init.headers,
      },
    },
    env,
  );

type Team = { id: string; name: string; role: 'admin' | 'member' };
const ADMIN: Team = { id: 'team_1', name: 'Platform', role: 'admin' };
const MEMBER: Team = { id: 'team_1', name: 'Platform', role: 'member' };
const actor = (owner: string, teams: Team[] = []) => ({ owner, teams });

const lib = (route: string, body: Record<string, unknown>, env?: Env) =>
  asDiagram(
    `/app/library/${route}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );

const BOX = { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 40, height: 20 };

const saved = async (body: Record<string, unknown>) => {
  const res = await lib('save', {
    title: 'Box',
    folder: '',
    width: 40,
    height: 20,
    elements: [BOX],
    preview: '<svg/>',
    ...body,
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { item: LibraryItemSummary }).item;
};

const listed = async (body: Record<string, unknown>) => {
  const res = await lib('list', body);
  expect(res.status).toBe(200);
  return (await res.json()) as LibraryListResponse;
};

const png = (seed: number) =>
  new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...Array.from({ length: 32 }, (_, i) => (seed + i) % 256),
  ]);

const uploaded = async (owner: string, bytes: Uint8Array) => {
  const res = await asDiagram(`/app/images?owner=${encodeURIComponent(owner)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(bytes.byteLength),
      'X-Image-Width': '40',
      'X-Image-Height': '30',
    },
    body: bytes,
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as MediaUploadResponse).image;
};

const galleryOf = (owner: string) =>
  db.sql.prepare('SELECT id FROM images WHERE owner = ?').all(owner) as { id: string }[];

describe('who may do what', () => {
  it('keeps Personal its owner’s alone', async () => {
    const item = await saved({ actor: actor('user_a'), scope: 'personal' });
    expect((await listed({ actor: actor('user_a') })).items.map((i) => i.id)).toEqual([item.id]);
    expect((await listed({ actor: actor('user_b') })).items).toEqual([]);
    expect((await lib('place', { actor: actor('user_b'), id: item.id })).status).toBe(404);
    expect(
      (await lib('rename', { actor: actor('user_b'), id: item.id, title: 'Mine' })).status,
    ).toBe(404);
    expect((await lib('delete', { actor: actor('user_b'), id: item.id })).status).toBe(404);
    const renamed = await lib('rename', { actor: actor('user_a'), id: item.id, title: 'Mine' });
    expect(((await renamed.json()) as { item: LibraryItemSummary }).item.title).toBe('Mine');
  });

  it('lets every member save to and place from the team, and only its admins tidy', async () => {
    const item = await saved({
      actor: actor('user_m', [MEMBER]),
      scope: 'team',
      teamId: 'team_1',
      folder: 'Logos',
    });
    expect(item.scope).toBe('team');
    const list = await listed({ actor: actor('user_m', [MEMBER]) });
    expect(list.items.map((i) => i.id)).toEqual([item.id]);
    expect(list.teams).toEqual([MEMBER]);
    expect((await lib('place', { actor: actor('user_m', [MEMBER]), id: item.id })).status).toBe(
      200,
    );

    const member = actor('user_m', [MEMBER]);
    expect(await (await lib('rename', { actor: member, id: item.id, title: 'X' })).json()).toEqual({
      error: 'admin_only',
    });
    expect((await lib('delete', { actor: member, id: item.id })).status).toBe(403);
    const folder = { actor: member, scope: 'team', teamId: 'team_1', from: 'Logos', to: 'Marks' };
    expect((await lib('rename-folder', folder)).status).toBe(403);

    const admin = actor('user_x', [ADMIN]);
    expect((await lib('rename-folder', { ...folder, actor: admin })).status).toBe(200);
    expect((await listed({ actor: admin })).items[0]!.folder).toBe('Marks');
    expect((await lib('delete', { actor: admin, id: item.id })).status).toBe(200);
    expect((await listed({ actor: admin })).items).toEqual([]);
  });

  it('answers a team the caller is not in as missing', async () => {
    const res = await lib('save', {
      actor: actor('user_a'),
      scope: 'team',
      teamId: 'team_1',
      title: 'Box',
      folder: '',
      width: 40,
      height: 20,
      elements: [BOX],
    });
    expect(res.status).toBe(404);
    const item = await saved({ actor: actor('user_m', [MEMBER]), scope: 'team', teamId: 'team_1' });
    expect((await lib('place', { actor: actor('user_out'), id: item.id })).status).toBe(404);
  });

  it('refuses a malformed body, scope, title, folder, size or element list', async () => {
    const base = {
      actor: actor('user_a'),
      scope: 'personal',
      title: 'Box',
      folder: '',
      width: 40,
      height: 20,
      elements: [BOX],
    };
    expect((await lib('save', { ...base, actor: { owner: 'user_a' } })).status).toBe(400);
    expect(await (await lib('save', { ...base, scope: 'everyone' })).json()).toEqual({
      error: 'invalid_scope',
    });
    expect(await (await lib('save', { ...base, title: '   ' })).json()).toEqual({
      error: 'invalid_title',
    });
    expect(await (await lib('save', { ...base, folder: 'x'.repeat(81) })).json()).toEqual({
      error: 'invalid_folder',
    });
    expect(await (await lib('save', { ...base, width: -1 })).json()).toEqual({
      error: 'invalid_size',
    });
    expect(await (await lib('save', { ...base, elements: [] })).json()).toEqual({
      error: 'invalid_elements',
    });
    const big = { ...BOX, label: 'x'.repeat(300_000) };
    expect((await lib('save', { ...base, elements: [big] })).status).toBe(413);
    expect((await lib('nothing', base)).status).toBe(404);
  });
});

describe('kinds an app lacks', () => {
  it('leaves out items using a kind the caller can’t draw, and counts them', async () => {
    await saved({ actor: actor('user_a'), scope: 'personal' });
    await saved({
      actor: actor('user_a'),
      scope: 'personal',
      elements: [{ id: 'e', type: 'event-note', x: 0, y: 0, width: 10, height: 10 }],
    });
    const list = await listed({ actor: actor('user_a'), kinds: ['shape', 'arrow'] });
    expect(list.items.map((i) => i.kinds)).toEqual([['shape']]);
    expect(list.hidden).toBe(1);
    expect((await listed({ actor: actor('user_a') })).hidden).toBe(0);
  });
});

describe('pictures', () => {
  it('copies the saver’s picture into the team’s gallery, and into the placer’s on place', async () => {
    const image = await uploaded('user_m', png(1));
    const item = await saved({
      actor: actor('user_m', [MEMBER]),
      scope: 'team',
      teamId: 'team_1',
      elements: [{ id: 'i', type: 'image', imageId: image.id, x: 0, y: 0, width: 40, height: 30 }],
    });
    const team = galleryOf('team:team_1');
    expect(team).toHaveLength(1);
    expect(team[0]!.id).not.toBe(image.id);

    const placed = await lib('place', { actor: actor('user_p', [MEMBER]), id: item.id });
    const body = (await placed.json()) as LibraryPlaceResponse;
    const mine = galleryOf('user_p');
    expect(mine).toHaveLength(1);
    expect((body.elements[0] as { imageId: string }).imageId).toBe(mine[0]!.id);
    // A second place reuses the copy (deduped by its bytes).
    await lib('place', { actor: actor('user_p', [MEMBER]), id: item.id });
    expect(galleryOf('user_p')).toHaveLength(1);
  });

  it('keeps a Personal item naming the owner’s own picture, copying nothing', async () => {
    const image = await uploaded('user_a', png(2));
    await saved({
      actor: actor('user_a'),
      scope: 'personal',
      elements: [{ id: 'i', type: 'image', imageId: image.id, x: 0, y: 0, width: 40, height: 30 }],
    });
    expect(galleryOf('user_a')).toHaveLength(1);
  });
});

describe('the old shape libraries, read in place', () => {
  const LEGACY = {
    libraries: [
      {
        id: 'L1',
        name: 'AWS',
        createdAt: 1,
        updatedAt: 2,
        items: [
          { id: 'i1', title: 'Lambda', width: 40, height: 20, elements: [BOX], preview: '<svg/>' },
          { id: 'i2', title: 'S3', width: 40, height: 20, elements: [BOX], preview: null },
        ],
      },
    ],
  };
  const withHuddle = () => ({
    ...db.env,
    MEDIA_KEY_LIVEHUDDLE: 'lh-key',
    APP_ORIGIN_LIVEHUDDLE: 'https://www.livehuddle.app',
  });

  it('lists another app’s shape libraries in Personal, and copies one whole on its first tidy', async () => {
    const env = withHuddle();
    const door = vi.fn(async () => Response.json(LEGACY));
    vi.stubGlobal('fetch', door);
    const first = (await (
      await lib('list', { actor: actor('user_a') }, env)
    ).json()) as LibraryListResponse;
    expect(first.items.map((i) => [i.title, i.folder])).toEqual([
      ['Lambda', 'AWS'],
      ['S3', 'AWS'],
    ]);
    expect(first.legacy).toEqual({ unavailable: [], copied: [], writable: true });
    expect(door).toHaveBeenCalledTimes(1);
    expect(String((door.mock.calls[0] as unknown[])[0])).toContain(
      '/api/internal/shape-libraries?owner=user_a',
    );

    const placed = await lib('place', { actor: actor('user_a'), id: first.items[0]!.id }, env);
    expect(((await placed.json()) as LibraryPlaceResponse).elements).toEqual([BOX]);

    // The first rename copies the whole library, and the copy is what lists from then on.
    const renamed = await lib(
      'rename',
      { actor: actor('user_a'), id: first.items[1]!.id, title: 'Bucket' },
      env,
    );
    expect(renamed.status).toBe(200);
    const after = (await (
      await lib('list', { actor: actor('user_a') }, env)
    ).json()) as LibraryListResponse;
    expect(after.items.map((i) => i.title).sort()).toEqual(['Bucket', 'Lambda']);
    expect(after.items.every((i) => !i.id.startsWith('legacy~'))).toBe(true);
  });

  it('never asks the caller’s own app, and reads nothing for a guest', async () => {
    const door = vi.fn(async () => Response.json(LEGACY));
    vi.stubGlobal('fetch', door);
    const env = { ...db.env, APP_ORIGIN_LIVEDIAGRAM: 'https://www.livediagram.app' };
    await lib('list', { actor: actor('user_a') }, env);
    await lib('list', { actor: actor('guest:abc') }, withHuddle());
    expect(door).not.toHaveBeenCalled();
    const guest = (await (
      await lib('list', { actor: actor('guest:abc') }, withHuddle())
    ).json()) as LibraryListResponse;
    expect(guest.legacy.writable).toBe(false);
  });

  it('reports a door that fails, and still answers', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 500 })),
    );
    const list = (await (
      await lib('list', { actor: actor('user_a') }, withHuddle())
    ).json()) as LibraryListResponse;
    expect(list.items).toEqual([]);
    expect(list.legacy.unavailable).toEqual(['livehuddle.app']);
  });
});

describe('an owner’s items', () => {
  it('move with a guest who signs up, and go with a deleted account', async () => {
    await saved({ actor: actor('guest:abc'), scope: 'personal' });
    const merged = await asDiagram('/app/owners/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'guest:abc', to: 'user_new' }),
    });
    expect(merged.status).toBe(200);
    expect((await listed({ actor: actor('user_new') })).items).toHaveLength(1);
    const gone = await asDiagram('/app/owners/user_new', { method: 'DELETE' });
    expect(gone.status).toBeLessThan(300);
    expect((await listed({ actor: actor('user_new') })).items).toEqual([]);
  });
});
