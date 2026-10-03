import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handlePlacementDefaults } from './placement-defaults';
import { asGuest, asUser, errorOf, seedFolder, seedTeam } from './placement-test-support';

// /api/placement-defaults against a real schema (docs/specs/013-workspace/default-folders.md "API"):
// a person's default folders, one per key in force, pointing only at their own personal folders or
// folders of a team they have joined, every refusal named and logged.

let db: SqliteD1;
let logs: string[];

type Who = { owner: string | null; clerkUserId: string | null };

function call(who: Who, method: string, path: string, body?: unknown) {
  return handlePlacementDefaults(makeTestRouteContext(method, path, { env: db.env, ...who, body }));
}

const put = (who: Who, key: string, body: unknown) =>
  call(who, 'PUT', `/api/placement-defaults/${key}`, body);

async function list(who: Who) {
  const res = await call(who, 'GET', '/api/placement-defaults');
  expect(res.status).toBe(200);
  return ((await res.json()) as { defaults: unknown[] }).defaults;
}

beforeEach(() => {
  db = sqliteD1();
  logs = [];
  const capture = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
  vi.spyOn(console, 'info').mockImplementation(capture);
  vi.spyOn(console, 'warn').mockImplementation(capture);
  seedTeam(db, 't1', [
    { userId: 'user_alice', status: 'joined' },
    { userId: 'user_bob', status: 'invited' },
  ]);
  seedFolder(db, 'alice-folder', 'user_alice');
  seedFolder(db, 'carol-folder', 'user_carol');
  seedFolder(db, 'guest-folder', 'guest-uuid');
  seedFolder(db, 't1-folder', 'user_alice', 't1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/placement-defaults', () => {
  it('answers no defaults for a person with none', async () => {
    expect(await list(asUser('user_alice'))).toEqual([]);
  });

  it('answers the missing-owner refusal without an identity', async () => {
    const res = await call({ owner: null, clerkUserId: null }, 'GET', '/api/placement-defaults');
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/placement-defaults/:key', () => {
  it("sets a default to the person's own personal folder", async () => {
    const res = await put(asUser('user_alice'), 'mode:diagram', { folderId: 'alice-folder' });
    expect(res.status).toBe(204);
    expect(await list(asUser('user_alice'))).toEqual([
      { key: 'mode:diagram', folderId: 'alice-folder' },
    ]);
    expect(logs).toContain('placement-defaults: set key=mode:diagram scope=personal');
  });

  it('sets a default to a folder of a joined team', async () => {
    const res = await put(asUser('user_alice'), 'mode:draw', { folderId: 't1-folder' });
    expect(res.status).toBe(204);
    expect(logs).toContain('placement-defaults: set key=mode:draw scope=team');
  });

  it('sets a kind default and a template default, listed in key order', async () => {
    await put(asUser('user_alice'), 'template:retrospective', { folderId: 'alice-folder' });
    const res = await put(asUser('user_alice'), 'kind:event-storming', { folderId: 't1-folder' });
    expect(res.status).toBe(204);
    expect(await list(asUser('user_alice'))).toEqual([
      { key: 'kind:event-storming', folderId: 't1-folder' },
      { key: 'template:retrospective', folderId: 'alice-folder' },
    ]);
  });

  it('reads a percent-encoded key', async () => {
    const res = await put(asUser('user_alice'), 'mode%3Adraw', { folderId: 'alice-folder' });
    expect(res.status).toBe(204);
    expect(await list(asUser('user_alice'))).toEqual([
      { key: 'mode:draw', folderId: 'alice-folder' },
    ]);
  });

  it('replaces the folder of a key set again', async () => {
    await put(asUser('user_alice'), 'mode:draw', { folderId: 'alice-folder' });
    await put(asUser('user_alice'), 'mode:draw', { folderId: 't1-folder' });
    expect(await list(asUser('user_alice'))).toEqual([{ key: 'mode:draw', folderId: 't1-folder' }]);
  });

  it("gives a guest a default on the guest's own folder", async () => {
    const res = await put(asGuest('guest-uuid'), 'mode:draw', { folderId: 'guest-folder' });
    expect(res.status).toBe(204);
    expect(await list(asGuest('guest-uuid'))).toEqual([
      { key: 'mode:draw', folderId: 'guest-folder' },
    ]);
  });

  it.each([
    ['board:kanban'],
    ['kind:diagram'],
    ['kind:whiteboard'],
    ['template:mindmap'],
    ['draw'],
    ['mode:pixel'],
    ['%E0%A4%A'],
  ])('refuses the key %s', async (key) => {
    const res = await put(asUser('user_alice'), key, { folderId: 'alice-folder' });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe('default_key_invalid');
    expect(logs).toContain('placement-defaults: rejected reason=default_key_invalid');
  });

  it.each([
    ['no folder', {}],
    ['a number', { folderId: 3 }],
    ['an empty folder', { folderId: '' }],
    ['a null folder', { folderId: null }],
    ['an array body', ['alice-folder']],
  ])('refuses %s', async (_label, body) => {
    const res = await put(asUser('user_alice'), 'mode:draw', body);
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe('default_folder_invalid');
  });

  it('refuses a body that is not JSON', async () => {
    const ctx = makeTestRouteContext('PUT', '/api/placement-defaults/mode:draw', {
      env: db.env,
      ...asUser('user_alice'),
    });
    const res = await handlePlacementDefaults({
      ...ctx,
      request: new Request(ctx.url, { method: 'PUT', body: '{nope' }),
    });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe('default_folder_invalid');
  });

  it.each([
    ['a missing folder', asUser('user_alice'), 'gone'],
    ["someone else's personal folder", asUser('user_alice'), 'carol-folder'],
    ['a folder of a team only invited to', asUser('user_bob'), 't1-folder'],
    ["a team folder, on the guest path under a member's id", asGuest('user_alice'), 't1-folder'],
  ])('hides %s as not found, writing nothing', async (_label, who, folderId) => {
    const res = await put(who, 'mode:draw', { folderId });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe('folder_not_found');
    expect(await list(who)).toEqual([]);
    expect(logs).toContain('placement-defaults: rejected reason=folder_not_found');
  });
});

describe('DELETE /api/placement-defaults/:key', () => {
  it('clears one key and keeps the other', async () => {
    await put(asUser('user_alice'), 'mode:draw', { folderId: 'alice-folder' });
    await put(asUser('user_alice'), 'mode:diagram', { folderId: 'alice-folder' });
    const res = await call(asUser('user_alice'), 'DELETE', '/api/placement-defaults/mode:draw');
    expect(res.status).toBe(204);
    expect(await list(asUser('user_alice'))).toEqual([
      { key: 'mode:diagram', folderId: 'alice-folder' },
    ]);
    expect(logs).toContain('placement-defaults: cleared key=mode:draw');
  });

  it('answers 204 for a key with no default', async () => {
    const res = await call(asUser('user_alice'), 'DELETE', '/api/placement-defaults/mode:draw');
    expect(res.status).toBe(204);
  });

  it('refuses a key not in force', async () => {
    const res = await call(asUser('user_alice'), 'DELETE', '/api/placement-defaults/kind:x');
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe('default_key_invalid');
  });
});

describe('other requests', () => {
  it.each([
    ['POST', '/api/placement-defaults'],
    ['PUT', '/api/placement-defaults'],
    ['GET', '/api/placement-defaults/mode:draw'],
    ['PUT', '/api/placement-defaults/mode:draw/extra'],
  ])('answers %s %s as not found', async (method, path) => {
    const body = method === 'GET' ? undefined : { folderId: 'alice-folder' };
    const res = await call(asUser('user_alice'), method, path, body);
    expect(res.status).toBe(404);
  });
});
