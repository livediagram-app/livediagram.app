import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryListResponse } from '@liveworkspace/media';
import { makeTestRouteContext } from './test-route-context';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor, type TestMediaService } from '../test-media-service';
import { handleLibrary } from './library';

// livedesign's door onto the Library (liveworkspace/docs/specs/006-media/libraries.md "Each app's door"), over the
// real media service in this process: a person saves and places, a team's members add and only its admins tidy, kinds
// livedesign can't draw are left out of its list.

let db: SqliteD1;
let media: TestMediaService;
beforeEach(() => {
  db = sqliteD1();
  media = mediaServiceFor(db.env);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const MEMBER = { id: 'team_1', name: 'Platform', role: 'member' as const };
const ADMIN = { id: 'team_1', name: 'Platform', role: 'admin' as const };

type Who = { owner?: string; teams?: (typeof MEMBER | typeof ADMIN)[]; token?: { id: string } };
const call = (method: string, path: string, who: Who = {}, body?: unknown) => {
  const ctx = makeTestRouteContext(method, path, {
    owner: who.owner ?? 'user_ada',
    env: db.env,
    teams: who.teams ?? null,
    ...(who.token ? { token: who.token } : {}),
  });
  return handleLibrary(
    body === undefined
      ? ctx
      : {
          ...ctx,
          request: new Request(`https://api.test${path}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
        },
  );
};

const BOX = {
  id: 'a',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 80,
  height: 40,
  label: 'Payments',
};
const SAVE = {
  scope: 'personal',
  folder: '',
  title: 'Payments',
  width: 80,
  height: 40,
  elements: [BOX],
};

const list = async (who: Who = {}) => {
  const res = await call('GET', '/api/library', who);
  expect(res.status).toBe(200);
  return res.json<LibraryListResponse>();
};

describe('/api/library', () => {
  it('saves a selection to Personal with livedesign’s drawing of it, and places a copy', async () => {
    const saved = await call('POST', '/api/library', {}, SAVE);
    expect(saved.status).toBe(201);
    const { items } = await list();
    expect(items).toHaveLength(1);
    expect(items[0]!.preview).toContain('<svg');
    expect(items[0]!.kinds).toEqual(['shape']);
    const placed = await call('POST', `/api/library/${items[0]!.id}/place`, {}, {});
    expect((await placed.json<{ elements: { label: string }[] }>()).elements[0]!.label).toBe(
      'Payments',
    );
    expect(await list({ owner: 'user_other' })).toMatchObject({ items: [] });
  });

  it('lets a member add to the team, and only an admin tidy it', async () => {
    const saved = await call(
      'POST',
      '/api/library',
      { teams: [MEMBER] },
      { ...SAVE, scope: 'team', teamId: 'team_1' },
    );
    expect(saved.status).toBe(201);
    const [item] = (await list({ owner: 'user_bo', teams: [MEMBER] })).items;
    const asMember = await call('DELETE', `/api/library/${item!.id}`, {
      owner: 'user_bo',
      teams: [MEMBER],
    });
    expect(asMember.status).toBe(403);
    expect(await asMember.json()).toEqual({ error: 'admin_only' });
    const renamed = await call(
      'PUT',
      `/api/library/${item!.id}`,
      { owner: 'user_cy', teams: [ADMIN] },
      { title: 'Pay' },
    );
    expect(renamed.status).toBe(200);
    const removed = await call('DELETE', `/api/library/${item!.id}`, {
      owner: 'user_cy',
      teams: [ADMIN],
    });
    expect(removed.status).toBe(200);
    expect((await list({ teams: [MEMBER] })).items).toEqual([]);
  });

  it('leaves out an item using a kind livedesign can’t draw, and counts it', async () => {
    await call('POST', '/api/library', {}, SAVE);
    const [row] = media.sql.prepare('SELECT * FROM library_items').all() as Record<
      string,
      unknown
    >[];
    media.sql
      .prepare(
        `INSERT INTO library_items (id, scope, scope_id, folder, title, width, height, kinds, elements, images, preview, app, created_by, legacy_ref, created_at, updated_at)
         VALUES ('other', ?, ?, '', 'Button', 10, 10, '["wireframe"]', '[]', '[]', NULL, 'livediagram.app', ?, NULL, 1, 1)`,
      )
      .run(row!.scope as string, row!.scope_id as string, row!.created_by as string);
    const listed = await list();
    expect(listed.items.map((i) => i.title)).toEqual(['Payments']);
    expect(listed.hidden).toBe(1);
  });

  it('refuses elements livedesign doesn’t keep, and an API token', async () => {
    const bad = await call(
      'POST',
      '/api/library',
      {},
      { ...SAVE, elements: [{ id: 'x', type: 'nothing' }] },
    );
    expect(bad.status).toBe(400);
    // missingAuth: the api's 400 for a caller it can't take.
    expect((await call('GET', '/api/library', { token: { id: 'tok' } })).status).toBe(400);
  });
});
