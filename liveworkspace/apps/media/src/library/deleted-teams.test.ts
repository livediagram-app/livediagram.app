// A deleted team's Library and gallery (liveworkspace/docs/specs/006-media/libraries.md "Account and guest lifecycle"):
// they go once accounts names the team deleted, and nothing else does: another team's, a Personal library, a team
// accounts calls live or doesn't know, and everything when accounts can't be asked.
import type { LibraryItemSummary, MediaUploadResponse } from '@liveworkspace/media';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import type { Env } from '../env';
import { testDb, type TestDb } from '../test-sqlite-d1';
import { DELETED_TEAMS_CHUNK, heldTeams, sweepDeletedTeams } from './deleted-teams';

const BASE = 'https://liveworkspace.app/api/media';
const KEY = 'accounts-media-key';

let db: TestDb;
let asked: string[][];
let deletedTeams: Set<string>;
// How the stand-in for accounts answers: its door, or a failure.
let answer: 'door' | 'error' | 'garbage' | 'text' | 'throw' | 'throwString';

const accounts = {
  fetch: async (url: string, init: RequestInit) => {
    expect(url).toBe('https://accounts/api/account/media/teams-deleted');
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${KEY}`);
    const { ids } = JSON.parse(String(init.body)) as { ids: string[] };
    asked.push(ids);
    if (answer === 'throw') throw new TypeError('fetch failed');
    if (answer === 'throwString') throw 'down';
    if (answer === 'text') return new Response('not json', { status: 200 });
    if (answer === 'error') return new Response('{}', { status: 503 });
    if (answer === 'garbage') return Response.json({ deleted: 'team_1' });
    // An id it wasn't asked about is ignored.
    return Response.json({
      deleted: [...ids.filter((id) => deletedTeams.has(id)), 'team_unasked'],
    });
  },
} as unknown as Fetcher;

beforeEach(() => {
  db = testDb();
  db.env = { ...db.env, ACCOUNTS: accounts, ACCOUNTS_KEY_MEDIA: KEY } as Env;
  asked = [];
  deletedTeams = new Set(['team_1']);
  answer = 'door';
});
afterEach(() => vi.restoreAllMocks());

const asDiagram = (path: string, init: RequestInit = {}) =>
  worker.fetch(
    new Request(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: 'Bearer ld-key',
        'X-Media-App': 'livediagram.app',
        ...init.headers,
      },
    }),
    db.env,
  );

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

async function uploaded(owner: string, seed: number) {
  const bytes = png(seed);
  const res = await asDiagram(`/app/images?owner=${owner}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(bytes.byteLength),
      'X-Image-Width': '40',
      'X-Image-Height': '30',
    },
    body: bytes,
  });
  return ((await res.json()) as MediaUploadResponse).image;
}

const TEAMS = [
  { id: 'team_1', name: 'Gone', role: 'member' },
  { id: 'team_2', name: 'Kept', role: 'member' },
];

// An item with one picture of the saver's, in Personal or a team (whose gallery then holds a copy).
async function saved(teamId: string | null, seed: number) {
  const image = await uploaded('user_m', seed);
  const res = await asDiagram('/app/library/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actor: { owner: 'user_m', teams: TEAMS },
      scope: teamId ? 'team' : 'personal',
      teamId,
      title: 'Box',
      folder: '',
      width: 40,
      height: 30,
      elements: [{ id: 'i', type: 'image', imageId: image.id, x: 0, y: 0, width: 40, height: 30 }],
      preview: '<svg/>',
    }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { item: LibraryItemSummary }).item;
}

const itemsOf = (scopeId: string) =>
  (
    db.sql.prepare('SELECT id FROM library_items WHERE scope_id = ?').all(scopeId) as {
      id: string;
    }[]
  ).map((r) => r.id);
const galleryOf = (owner: string) =>
  (db.sql.prepare('SELECT id FROM images WHERE owner = ?').all(owner) as { id: string }[]).map(
    (r) => r.id,
  );
const refsOf = (item: string) =>
  db.sql.prepare(`SELECT image_id FROM refs WHERE app = 'library' AND document = ?`).all(item);

describe("a deleted team's Library", () => {
  it("deletes its items, their references and its gallery, leaving another team's and Personal", async () => {
    const gone = await saved('team_1', 1);
    const kept = await saved('team_2', 2);
    const personal = await saved(null, 3);
    const goneGallery = galleryOf('team:team_1');
    expect(goneGallery).toHaveLength(1);
    expect(db.objects.has(goneGallery[0]!)).toBe(true);
    expect(await heldTeams(db.env)).toEqual(['team_1', 'team_2']);

    const outcome = await sweepDeletedTeams(db.env);
    expect(outcome).toEqual({ skipped: false, asked: 2, teams: 1, items: 1, pictures: 1 });
    expect(asked).toEqual([['team_1', 'team_2']]);
    expect(itemsOf('team_1')).toEqual([]);
    expect(refsOf(gone.id)).toEqual([]);
    expect(galleryOf('team:team_1')).toEqual([]);
    expect(db.objects.has(goneGallery[0]!)).toBe(false);
    // Another team's, and the saver's Personal items and own pictures, stand.
    expect(itemsOf('team_2')).toEqual([kept.id]);
    expect(refsOf(kept.id)).toHaveLength(1);
    expect(galleryOf('team:team_2')).toHaveLength(1);
    expect(itemsOf('user_m')).toEqual([personal.id]);
    expect(galleryOf('user_m')).toHaveLength(3);

    // A second run finds nothing more to delete.
    expect(await sweepDeletedTeams(db.env)).toEqual({
      skipped: false,
      asked: 1,
      teams: 0,
      items: 0,
      pictures: 0,
    });
    expect(itemsOf('team_2')).toEqual([kept.id]);
  });

  it('goes for a gallery left with no item, and keeps a team accounts calls live', async () => {
    deletedTeams = new Set(['team_3']);
    await uploaded('team:team_3', 4);
    await saved('team_2', 5);
    expect(await heldTeams(db.env)).toEqual(['team_2', 'team_3']);
    await sweepDeletedTeams(db.env);
    expect(galleryOf('team:team_3')).toEqual([]);
    expect(itemsOf('team_2')).toHaveLength(1);
    expect(galleryOf('team:team_2')).toHaveLength(1);
  });

  it('runs from the daily cron', async () => {
    await saved('team_1', 6);
    await worker.scheduled({} as ScheduledController, db.env);
    expect(itemsOf('team_1')).toEqual([]);
  });

  it(`asks ${DELETED_TEAMS_CHUNK} teams a call`, async () => {
    const insert = db.sql.prepare(
      `INSERT INTO library_items (id, scope, scope_id, folder, title, width, height, kinds, elements, images, preview,
         app, created_by, legacy_ref, created_at, updated_at)
       VALUES (?, 'team', ?, '', 't', 1, 1, '[]', '[]', '[]', NULL, 'livediagram.app', 'u', NULL, 1, 1)`,
    );
    for (let i = 0; i < DELETED_TEAMS_CHUNK + 20; i++) {
      insert.run(`item_${i}`, `team_${String(i).padStart(3, '0')}`);
    }
    deletedTeams = new Set(['team_000', 'team_119']);
    const outcome = await sweepDeletedTeams(db.env);
    expect(asked.map((ids) => ids.length)).toEqual([DELETED_TEAMS_CHUNK, 20]);
    expect(outcome).toMatchObject({ asked: DELETED_TEAMS_CHUNK + 20, teams: 2, items: 2 });
  });
});

describe('when accounts cannot say', () => {
  it.each(['error', 'garbage', 'text', 'throw', 'throwString'] as const)(
    'deletes nothing when it answers %s',
    async (how) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      answer = how;
      await saved('team_1', 7);
      expect(await sweepDeletedTeams(db.env)).toMatchObject({ asked: 0, teams: 0 });
      expect(itemsOf('team_1')).toHaveLength(1);
      expect(galleryOf('team:team_1')).toHaveLength(1);
    },
  );

  it('asks nothing and deletes nothing without the key or the binding', async () => {
    await saved('team_1', 8);
    expect(await sweepDeletedTeams({ ...db.env, ACCOUNTS_KEY_MEDIA: ' ' })).toEqual({
      skipped: true,
    });
    expect(await sweepDeletedTeams({ ...db.env, ACCOUNTS: undefined })).toEqual({
      skipped: true,
    });
    expect(asked).toEqual([]);
    expect(itemsOf('team_1')).toHaveLength(1);
  });

  it('keeps the bytes it could not delete logged, never thrown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await saved('team_1', 9);
    const bucket = db.env.MEDIA!;
    vi.spyOn(bucket, 'delete').mockRejectedValue(new Error('r2 down'));
    expect(await sweepDeletedTeams(db.env)).toMatchObject({ teams: 1, pictures: 1 });
    expect(console.error).toHaveBeenCalled();
  });

  it('stops on a database failure without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = {
      ...db.env,
      MEDIA_DB: {
        prepare: () => {
          throw new Error('d1 down');
        },
      },
    } as unknown as Env;
    expect(await sweepDeletedTeams(broken)).toMatchObject({ skipped: false, teams: 0 });
  });
});
