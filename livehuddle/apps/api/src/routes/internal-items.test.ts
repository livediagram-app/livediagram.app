// The index's doors into a canvas and about a person (docs/specs/015-api/api.md "Internal"): a copy into a new canvas,
// the notices for the emails, an account closed anywhere, a guest who became an account and a name taken off a canvas.
// What livehuddle keeps for a person beside their canvases is in their own stores.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Comment, ShapeElement } from '@livehuddle/document';

const { notifyFirstShare, notifyDocumentJoin, reportServerEvent, countCommunityCopy } = vi.hoisted(
  () => ({
    notifyFirstShare: vi.fn(async () => {}),
    notifyDocumentJoin: vi.fn(async () => {}),
    reportServerEvent: vi.fn(async () => {}),
    countCommunityCopy: vi.fn(async () => {}),
  }),
);
vi.mock('../email/notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../email/notifications')>()),
  notifyFirstShare,
  notifyDocumentJoin,
}));
vi.mock('../server-telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server-telemetry')>()),
  reportServerEvent,
}));
vi.mock('../community-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../community-service')>()),
  countCommunityCopy,
}));

import { upsertTab } from '../db/tabs';
import { saveCommunityPost } from '../document-room/community-post';
import { personStore } from '../person-client';
import { sqliteD1, testDocument } from '../test-sqlite-d1';
import { handleInternalItems } from './internal-items';

const KEY = 'index-key';
const GUEST = 'guest_abc';
const USER = 'user_ada';
const OTHER = 'user_bob';

function arrange() {
  const db = sqliteD1({ INDEX_KEY: KEY });
  const { env } = db;
  const pending: Promise<unknown>[] = [];
  const send = (method: string, path: string, body?: unknown) =>
    handleInternalItems(
      new Request(`https://api.test/api/internal/${path}`, {
        method,
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
      (p) => void pending.push(p),
    );
  const call = (path: string, body: unknown) => send('POST', `people/${path}`, body);
  const settle = async () => {
    while (pending.length > 0) await Promise.all(pending.splice(0));
  };
  const library = (owner: string, id: string, name: string) =>
    personStore(env, owner).createShapeLibrary({ id, name, source: 'drawio', items: [] }, 50);
  return { db, env, sql: db.sql, send, call, settle, library };
}

const comment = (id: string, authorId: string): Comment => ({
  id,
  text: 'Looks good',
  createdAt: 1,
  authorName: authorId,
  authorColor: '#000',
  authorId,
});

const commented = (comments: Comment[]): ShapeElement => ({
  id: 'box',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  commentThread: { comments, resolved: false },
});

beforeEach(() => {
  for (const fn of [notifyFirstShare, notifyDocumentJoin, reportServerEvent, countCommunityCopy])
    fn.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/internal/items/:from/copy-to/:to', () => {
  // The owner's canvas A, one tab whose box carries a comment from them and one from Bob.
  async function source() {
    const world = arrange();
    testDocument(world.db, 'A', USER, { name: 'Plan' });
    await upsertTab(
      world.env,
      'A',
      {
        id: 't1',
        name: 'Tab 1',
        elements: [commented([comment('c1', USER), comment('c2', OTHER)])],
      },
      0,
    );
    const copied = (to: string) => {
      const row = world.sql
        .prepare(
          `SELECT t.data FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id WHERE dt.document_id = ?`,
        )
        .get(to) as { data: string } | undefined;
      if (!row) return null;
      const [box] = (JSON.parse(row.data) as { elements: ShapeElement[] }).elements;
      return (box!.commentThread?.comments ?? []).map((c) => c.authorId ?? null);
    };
    return { ...world, copied };
  }

  it('copies the canvas whole for its owner', async () => {
    const { send, copied } = await source();
    const res = await send('POST', 'items/A/copy-to/B', { by: USER });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, tabs: 1, items: 0 });
    expect(copied('B')).toEqual([USER, OTHER]);
  });

  it("takes everyone else's comment authors off a copy made by anyone but the owner", async () => {
    const { send, copied } = await source();
    expect((await send('POST', 'items/A/copy-to/B', { by: OTHER, code: 'LINK1' })).status).toBe(
      201,
    );
    expect(copied('B')).toEqual([null, OTHER]);
    expect((await send('POST', 'items/A/copy-to/C', { by: 'user_cy' })).status).toBe(201);
    expect(copied('C')).toEqual([null, null]);
    expect(countCommunityCopy).not.toHaveBeenCalled();
  });

  it("counts a copy through the canvas's Community post's link toward the post, keyed by the copier", async () => {
    const { env, send, settle, copied } = await source();
    await saveCommunityPost(
      env,
      { shareCode: 'POST1', authorId: USER, postId: 'p1', title: 'Plan', anonymous: false },
      Date.now(),
    );
    expect((await send('POST', 'items/A/copy-to/B', { by: OTHER, code: 'POST1' })).status).toBe(
      201,
    );
    await settle();
    expect(countCommunityCopy).toHaveBeenCalledTimes(1);
    expect(countCommunityCopy).toHaveBeenCalledWith(env, 'A', OTHER, `copier:${OTHER}`);
    // Through the post, the copy carries no comments at all.
    expect(copied('B')).toEqual([]);
  });

  it("counts an Explorer's copy through the post by the copier's network, as the index names it", async () => {
    const { env, send, settle } = await source();
    await saveCommunityPost(
      env,
      { shareCode: 'POST1', authorId: USER, postId: 'p1', title: 'Plan', anonymous: false },
      Date.now(),
    );
    const res = await send('POST', 'items/A/copy-to/B', {
      by: OTHER,
      code: 'POST1',
      ip: '198.51.100.7',
    });
    expect(res.status).toBe(201);
    await settle();
    expect(countCommunityCopy).toHaveBeenCalledWith(env, 'A', OTHER, '198.51.100.7');
  });

  it('counts nothing for a copy through the post from an index that does not say who copies', async () => {
    const { env, send, settle } = await source();
    await saveCommunityPost(
      env,
      { shareCode: 'POST1', authorId: USER, postId: 'p1', title: 'Plan', anonymous: false },
      Date.now(),
    );
    expect((await send('POST', 'items/A/copy-to/B', { code: 'POST1' })).status).toBe(201);
    await settle();
    expect(countCommunityCopy).not.toHaveBeenCalled();
  });

  it('answers 404 for a canvas or tab that is not there', async () => {
    const { send } = await source();
    expect((await send('POST', 'items/Z/copy-to/B', { by: USER })).status).toBe(404);
    expect((await send('POST', 'items/A/copy-to/B', { by: USER, tabId: 'nope' })).status).toBe(404);
  });
});

describe('POST /api/internal/items/:id/notices', () => {
  it("sends the actor's first-share milestone for a link made", async () => {
    const { env, send, settle } = arrange();
    const res = await send('POST', 'items/A/notices', { type: 'shared', actorId: USER });
    expect(res.status).toBe(202);
    await settle();
    expect(notifyFirstShare).toHaveBeenCalledWith(env, USER);
    expect(notifyDocumentJoin).not.toHaveBeenCalled();
    expect(reportServerEvent).not.toHaveBeenCalled();
  });

  it("tells the room someone came in by a link, and counts Document·Joined by the link's level", async () => {
    const { db, env, send, settle } = arrange();
    testDocument(db, 'A', USER, { name: 'Plan' });
    const res = await send('POST', 'items/A/notices', {
      type: 'joined',
      personId: OTHER,
      level: 'participate',
    });
    expect(res.status).toBe(202);
    await settle();
    expect(notifyDocumentJoin).toHaveBeenCalledWith(
      env,
      { id: 'A', ownerId: USER, name: 'Plan' },
      OTHER,
    );
    expect(reportServerEvent).toHaveBeenCalledWith(env, 'Document', 'Joined', 'Participate');
    expect(notifyFirstShare).not.toHaveBeenCalled();
  });
});

describe('POST /api/internal/people/:id/purge', () => {
  it("empties the person's store, and no one else's", async () => {
    const { env, call, library } = arrange();
    await library(USER, 'lib-1', 'Mine');
    await library(OTHER, 'lib-2', 'Theirs');

    const res = await call(`${USER}/purge`, { items: [] });

    expect(res.status).toBe(200);
    expect(await personStore(env, USER).shapeLibraries()).toEqual([]);
    expect((await personStore(env, OTHER).shapeLibraries()).map((l) => l.id)).toEqual(['lib-2']);
  });

  it("takes the person's name off each canvas the index names", async () => {
    const { db, sql, call } = arrange();
    testDocument(db, 'A', OTHER, { name: 'Theirs' });
    await upsertTab(
      db.env,
      'A',
      { id: 't1', name: 'Tab 1', elements: [commented([comment('c1', USER)])] },
      0,
    );

    const res = await call(`${USER}/purge`, { items: ['A'] });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, anonymised: 1, unreached: [] });
    const { data } = sql.prepare(`SELECT data FROM tabs WHERE id = 't1'`).get() as { data: string };
    expect(data).not.toContain(USER);
  });
});

describe('POST /api/internal/people/:guest/merge', () => {
  it("moves the guest's shape libraries to the account, once however often it is asked", async () => {
    const { env, call, library } = arrange();
    await library(GUEST, 'lib-g', 'Sketches');
    await library(USER, 'lib-u', 'Sketches');

    expect((await call(`${GUEST}/merge`, { into: USER })).status).toBe(200);
    expect((await call(`${GUEST}/merge`, { into: USER })).status).toBe(200);

    const names = (await personStore(env, USER).shapeLibraries()).map((l) => l.name).sort();
    expect(names).toEqual(['Sketches', 'Sketches (2)']);
    expect(await personStore(env, GUEST).shapeLibraries()).toEqual([]);
  });

  it('refuses anything but a guest into an account', async () => {
    const { call } = arrange();
    expect((await call(`${USER}/merge`, { into: OTHER })).status).toBe(404);
    expect((await call(`${GUEST}/merge`, { into: GUEST })).status).toBe(400);
  });
});

describe('PUT /api/internal/people/:id/migration', () => {
  const put = (env: ReturnType<typeof arrange>['env'], person: string, body: unknown) =>
    handleInternalItems(
      new Request(`https://api.test/api/internal/people/${person}/migration`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer mig-key' },
        body: JSON.stringify(body),
      }),
      { ...env, MIGRATION_KEY: 'mig-key' },
    );
  const old = (id: string, name: string) => ({
    id,
    name,
    source: 'drawio',
    items: '[]',
    createdAt: 5,
    updatedAt: 6,
  });

  it("adds an old person's shape libraries to their store, once, with their old times", async () => {
    const { env, library } = arrange();
    await library(USER, 'lib-new', 'Sketches');
    const body = {
      v: 1,
      app: 'livehuddle',
      personId: USER,
      shapeLibraries: [old('lib-old', 'Sketches'), old('lib-two', 'Flows')],
    };
    const first = await put(env, USER, body);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ moved: 2, renamed: 1 });
    expect(await (await put(env, USER, body)).json()).toEqual({ moved: 0, renamed: 0 });

    const libs = await personStore(env, USER).shapeLibraries();
    expect(libs.map((l) => l.name).sort()).toEqual(['Flows', 'Sketches', 'Sketches (2)']);
    expect(libs.find((l) => l.id === 'lib-two')).toMatchObject({ createdAt: 5, updatedAt: 6 });
  });

  it('is a 404 without MIGRATION_KEY, so the index key opens nothing here', async () => {
    const { send } = arrange();
    const res = await send('PUT', `people/${USER}/migration`, {
      v: 1,
      app: 'livehuddle',
      personId: USER,
      shapeLibraries: [],
    });
    expect(res.status).toBe(404);
  });
});
