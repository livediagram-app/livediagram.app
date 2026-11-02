import { afterEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import {
  MAX_COMPONENT_BYTES,
  MAX_COMPONENTS,
  type DesignComponent,
  type Element,
} from '@livedesign/design';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';
import { handleComponentRoutes } from './component-routes';
import { readComponentRow } from '../db/components';

// GET / PUT / PATCH /api/designs/:id/components[/:componentId] (docs/specs/009-elements/components.md "Sharing,
// collaboration and storage", "Share roles"; docs/specs/015-api/api.md): roles, the tab scope, the caps, the merge
// per element, and the `component` op each stored write sends the room.

type Recorded = { op: { kind: string; component: DesignComponent; tabIds: string[] } };

function roomRecorder(status = 204) {
  const bodies: Recorded[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (_url: string, init?: RequestInit) => {
        bodies.push(sentJson(init) as Recorded);
        return new Response(null, { status });
      },
    }),
  };
  return { bodies, binding };
}

type CallOpts = {
  owner?: string;
  code?: string;
  token?: boolean;
  rawBody?: string;
};

function call(db: SqliteD1, method: string, path: string, body?: unknown, opts: CallOpts = {}) {
  const owner = opts.owner ?? 'user_o';
  return handleDesigns(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner,
      accountUserId: opts.token || opts.code ? null : owner,
      verifiedUserId: opts.code ? null : owner,
      body,
      ...(opts.rawBody !== undefined ? { rawBody: opts.rawBody } : {}),
      headers: opts.code ? { 'X-Share-Code': opts.code } : {},
      token: opts.token ? { id: 'tok_1' } : null,
    }),
  );
}

const square = (id: string, label?: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 50,
  height: 20,
  ...(label ? { label } : {}),
});

const instance = (id: string, componentId: string): Element => ({
  id,
  type: 'shape',
  shape: 'instance',
  componentId,
  x: 10,
  y: 10,
  width: 100,
  height: 40,
});

const main = (id: string, over: Partial<DesignComponent> = {}) => ({
  id,
  name: 'Header',
  width: 100,
  height: 40,
  elements: [square('e1', 'Home'), square('e2', 'About')],
  updatedAt: 0,
  ...over,
});

async function setUp(status = 204) {
  const room = roomRecorder(status);
  const db = sqliteD1({ DESIGN_ROOM: room.binding } as unknown as Partial<Env>);
  await call(db, 'POST', '/api/designs', {
    id: 'D',
    name: 'Doc',
    tabs: [
      { id: 't1', name: 'One', elements: [instance('i1', 'c1')] },
      { id: 't2', name: 'Two', elements: [instance('i2', 'c2')] },
      { id: 't3', name: 'Three', elements: [] },
    ],
  });
  for (const id of ['c1', 'c2']) {
    expect((await call(db, 'PUT', `/api/designs/D/components/${id}`, main(id))).status).toBe(200);
  }
  room.bodies.length = 0;
  return { db, room };
}

const ids = async (res: Response) =>
  (await res.json<{ components: DesignComponent[] }>()).components.map((c) => c.id);

afterEach(() => vi.restoreAllMocks());

describe('the component routes', () => {
  it('answer only their own paths and methods, and need a caller', async () => {
    const { db } = await setUp();
    const ctx = (method: string, path: string, owner: string | null = 'user_o') =>
      makeTestRouteContext(method, path, { env: db.env, owner, accountUserId: owner });
    expect(await handleComponentRoutes(ctx('DELETE', '/api/designs/D/components/c1'))).toBeNull();
    expect(await handleComponentRoutes(ctx('GET', '/api/designs/D/tabs/t1'))).toBeNull();
    expect(await handleComponentRoutes(ctx('GET', '/api/forms/D/components'))).toBeNull();
    const anonymous = await handleComponentRoutes(ctx('GET', '/api/designs/D/components', null));
    expect(anonymous?.status).toBe(400);
  });
});

describe('GET /api/designs/:id/components', () => {
  it('answers every main, archived ones too, never cached', async () => {
    const { db } = await setUp();
    await call(db, 'PATCH', '/api/designs/D/components/c2', { archived: true });
    const res = await call(db, 'GET', '/api/designs/D/components');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await ids(res)).toEqual(['c1', 'c2']);
  });

  it('answers a tab-scoped link only the mains its tab uses', async () => {
    const { db } = await setUp();
    testShareLink(db, 'D', 'SCOPED', 'view', 'never', 't1');
    testShareLink(db, 'D', 'EMPTY', 'edit', 'never', 't3');
    expect(
      await ids(
        await call(db, 'GET', '/api/designs/D/components', undefined, {
          owner: 'g',
          code: 'SCOPED',
        }),
      ),
    ).toEqual(['c1']);
    expect(
      await ids(
        await call(db, 'GET', '/api/designs/D/components', undefined, {
          owner: 'g',
          code: 'EMPTY',
        }),
      ),
    ).toEqual([]);
  });

  it('answers a view link and an API token, and 404s a stranger and a design never started', async () => {
    const { db } = await setUp();
    testShareLink(db, 'D', 'VIEW', 'view');
    const view = await call(db, 'GET', '/api/designs/D/components', undefined, {
      owner: 'g',
      code: 'VIEW',
    });
    expect(await ids(view)).toEqual(['c1', 'c2']);
    expect(
      (await call(db, 'GET', '/api/designs/D/components', undefined, { token: true })).status,
    ).toBe(200);
    expect(
      (await call(db, 'GET', '/api/designs/D/components', undefined, { owner: 'user_x' })).status,
    ).toBe(404);
    expect((await call(db, 'GET', '/api/designs/NOPE/components')).status).toBe(404);
  });

  it("blanks other people's comment authors for anyone but the owner, and threads for a Community visitor", async () => {
    const { db } = await setUp();
    const thread = {
      id: 'th',
      comments: [{ id: 'k', authorId: 'user_o', text: 'hi', createdAt: 1 }],
    };
    await call(db, 'PATCH', '/api/designs/D/components/c1', {
      upsert: [{ ...square('e1', 'Home'), commentThread: thread }],
    });
    testShareLink(db, 'D', 'VIEW', 'view');
    const read = async (res: Response) =>
      (await res.json<{ components: { elements: Bag[] }[] }>()).components[0]!.elements[0]!;
    type Bag = Record<string, { comments: { authorId?: string }[] } | undefined>;
    const owner = await read(await call(db, 'GET', '/api/designs/D/components'));
    expect(owner.commentThread?.comments[0]?.authorId).toBe('user_o');
    const visitor = await read(
      await call(db, 'GET', '/api/designs/D/components', undefined, { owner: 'g', code: 'VIEW' }),
    );
    expect(visitor.commentThread?.comments[0]?.authorId).toBeUndefined();
    // A Community post's link: a content-only pass (docs/specs/025-community/community.md).
    const ctx = makeTestRouteContext('GET', '/api/designs/D/components', {
      env: db.env,
      owner: 'g',
      headers: { 'X-Share-Code': 'VIEW' },
    });
    ctx.community = { code: 'VIEW', open: true };
    const community = await read((await handleComponentRoutes(ctx))!);
    expect(community).not.toHaveProperty('commentThread');
  });
});

describe('PUT /api/designs/:id/components/:componentId', () => {
  it('stores the main with a worker updatedAt, moves the save, and announces it with its tabs', async () => {
    const { db, room } = await setUp();
    db.sql.exec("UPDATE design SET saved_at = 1 WHERE id = 'D'");
    const res = await call(
      db,
      'PUT',
      '/api/designs/D/components/c1',
      main('c1', { name: 'Nav', updatedAt: 3 }),
    );
    expect(res.status).toBe(200);
    const { component } = (await res.json()) as { component: DesignComponent };
    expect(component.name).toBe('Nav');
    expect(component.updatedAt).toBeGreaterThan(3);
    expect((await readComponentRow(db.env, 'c1'))?.main).toEqual(component);
    expect(
      (db.sql.prepare("SELECT saved_at FROM design WHERE id = 'D'").get() as { saved_at: number })
        .saved_at,
    ).toBeGreaterThan(1);
    expect(room.bodies).toEqual([{ op: { kind: 'component', component, tabIds: ['t1'] } }]);
  });

  it('lets an API token make a main (agents write mains here)', async () => {
    const { db } = await setUp();
    const res = await call(db, 'PUT', '/api/designs/D/components/c9', main('c9'), { token: true });
    expect(res.status).toBe(200);
  });

  it('stamps after a stored main dated ahead of the clock', async () => {
    const { db } = await setUp();
    const ahead = Date.now() + 60_000;
    db.sql
      .prepare("UPDATE components SET data = ? WHERE id = 'c1'")
      .run(JSON.stringify(main('c1', { updatedAt: ahead })));
    const res = await call(db, 'PUT', '/api/designs/D/components/c1', main('c1'));
    expect((await res.json<{ component: DesignComponent }>()).component.updatedAt).toBe(ahead + 1);
  });

  it('refuses an invalid main, a mismatched id and a body that is not an object', async () => {
    const { db, room } = await setUp();
    const bad = async (body: unknown, raw?: string) => {
      const res = await call(
        db,
        'PUT',
        '/api/designs/D/components/c1',
        body,
        raw === undefined ? {} : { rawBody: raw },
      );
      expect(res.status).toBe(400);
      return await res.json<{ message: string }>();
    };
    expect((await bad(main('other'))).message).toBe('invalid component');
    expect((await bad(main('c1', { name: '' }))).message).toBe('invalid component');
    expect((await bad(main('c1', { elements: [instance('x', 'c2')] }))).message).toBe(
      'invalid component',
    );
    expect((await bad(undefined, 'nope')).message).toBe('invalid json');
    expect(room.bodies).toEqual([]);
  });

  it('refuses a main past the byte cap with 413', async () => {
    const { db } = await setUp();
    const big = main('c1', { elements: [square('e1', 'x'.repeat(MAX_COMPONENT_BYTES))] });
    const res = await call(db, 'PUT', '/api/designs/D/components/c1', big);
    // The label cap may refuse it first; either way nothing past the byte cap is stored.
    expect([400, 413]).toContain(res.status);
    const wide = main('c1', {
      elements: Array.from({ length: 200 }, (_, i) => square(`e${i}`, 'x'.repeat(1_400))),
    });
    expect((await call(db, 'PUT', '/api/designs/D/components/c1', wide)).status).toBe(413);
  });

  it('refuses a new main past MAX_COMPONENTS with 409, and still replaces one', async () => {
    const { db } = await setUp();
    for (let i = 2; i < MAX_COMPONENTS; i += 1) {
      db.sql
        .prepare('INSERT INTO components (id, data, updated_at) VALUES (?, ?, 1)')
        .run(`x${i}`, JSON.stringify(main(`x${i}`)));
    }
    const res = await call(db, 'PUT', '/api/designs/D/components/new', main('new'));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'too_many_components' });
    expect((await call(db, 'PUT', '/api/designs/D/components/c1', main('c1'))).status).toBe(200);
  });

  it('never fails the write when the room cannot hear it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { db } = await setUp(500);
    expect((await call(db, 'PUT', '/api/designs/D/components/c1', main('c1'))).status).toBe(200);
    expect(warn).toHaveBeenCalledWith(
      '[components] relay-failed',
      expect.objectContaining({ componentId: 'c1' }),
    );
  });
});

describe('PATCH /api/designs/:id/components/:componentId', () => {
  it('merges per element, so two patches to different elements both land', async () => {
    const { db, room } = await setUp();
    const [a, b] = await Promise.all([
      call(db, 'PATCH', '/api/designs/D/components/c1', { upsert: [square('e1', 'Start')] }),
      call(db, 'PATCH', '/api/designs/D/components/c1', { upsert: [square('e2', 'Team')] }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const stored = (await readComponentRow(db.env, 'c1'))!.main;
    expect(stored.elements.map((e) => (e as { label?: string }).label)).toEqual(['Start', 'Team']);
    expect(room.bodies).toHaveLength(2);
    expect(room.bodies[1]!.op).toMatchObject({ kind: 'component', tabIds: ['t1'] });
  });

  it('renames, removes, orders and archives', async () => {
    const { db } = await setUp();
    const res = await call(db, 'PATCH', '/api/designs/D/components/c1', {
      name: 'Footer',
      remove: ['e1'],
      upsert: [square('e3')],
      order: ['e3'],
      archived: true,
    });
    const { component } = (await res.json()) as { component: DesignComponent };
    expect(component).toMatchObject({ name: 'Footer', archived: true });
    expect(component.elements.map((e) => e.id)).toEqual(['e3', 'e2']);
  });

  it('answers 404 for a main the design does not have, and 400 for a bad patch or a bad result', async () => {
    const { db } = await setUp();
    expect((await call(db, 'PATCH', '/api/designs/D/components/nope', { name: 'x' })).status).toBe(
      404,
    );
    const badPatch = await call(db, 'PATCH', '/api/designs/D/components/c1', { colour: 'red' });
    expect(await badPatch.json()).toMatchObject({ message: 'invalid patch' });
    const tooMany = await call(db, 'PATCH', '/api/designs/D/components/c1', {
      upsert: Array.from({ length: 200 }, (_, i) => square(`n${i}`)),
    });
    expect(tooMany.status).toBe(400);
    expect(await tooMany.json()).toMatchObject({ message: 'invalid component' });
    expect(
      (await call(db, 'PATCH', '/api/designs/D/components/c1', undefined, { rawBody: '[' })).status,
    ).toBe(400);
  });

  it('refuses a result past the byte cap with 413', async () => {
    const { db } = await setUp();
    const res = await call(db, 'PATCH', '/api/designs/D/components/c1', {
      upsert: Array.from({ length: 198 }, (_, i) => square(`n${i}`, 'x'.repeat(1_400))),
    });
    expect(res.status).toBe(413);
  });

  it('retries a swap another write beat, and gives up with 409 after three', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { db } = await setUp();
    // Every swap loses: another write lands between each read and its swap.
    db.sql.exec(`CREATE TEMP TRIGGER lose_swap BEFORE UPDATE OF data ON components
      BEGIN SELECT RAISE(IGNORE); END`);
    const res = await call(db, 'PATCH', '/api/designs/D/components/c1', { name: 'X' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'component_busy' });
    expect(warn).toHaveBeenCalledWith('[components] patch-contended', {
      designId: 'D',
      componentId: 'c1',
    });
  });
});

describe('share roles (docs/specs/009-elements/components.md "Share roles")', () => {
  it('refuses every write from a Participant and a Viewer', async () => {
    const { db, room } = await setUp();
    testShareLink(db, 'D', 'PART', 'participate');
    testShareLink(db, 'D', 'VIEW', 'view');
    for (const code of ['PART', 'VIEW']) {
      const opts = { owner: 'g', code };
      expect((await call(db, 'PUT', '/api/designs/D/components/c1', main('c1'), opts)).status).toBe(
        403,
      );
      expect((await call(db, 'PUT', '/api/designs/D/components/c9', main('c9'), opts)).status).toBe(
        403,
      );
      expect(
        (await call(db, 'PATCH', '/api/designs/D/components/c1', { name: 'x' }, opts)).status,
      ).toBe(403);
    }
    expect(room.bodies).toEqual([]);
  });

  it('lets an edit link write, and a tab-scoped Editor only mains no other tab draws', async () => {
    const { db } = await setUp();
    testShareLink(db, 'D', 'EDIT', 'edit');
    testShareLink(db, 'D', 'T1', 'edit', 'never', 't1');
    const edit = { owner: 'g', code: 'EDIT' };
    expect(
      (await call(db, 'PATCH', '/api/designs/D/components/c2', { name: 'y' }, edit)).status,
    ).toBe(200);
    const scoped = { owner: 'g', code: 'T1' };
    // Its own tab's main, and a new one (made before its tab saves the instance).
    expect(
      (await call(db, 'PATCH', '/api/designs/D/components/c1', { name: 'x' }, scoped)).status,
    ).toBe(200);
    expect((await call(db, 'PUT', '/api/designs/D/components/c7', main('c7'), scoped)).status).toBe(
      200,
    );
    expect(
      (await call(db, 'PATCH', '/api/designs/D/components/c7', { name: 'z' }, scoped)).status,
    ).toBe(200);
    // Another tab's main reads as missing to a patch and is refused to a replace.
    expect(
      (await call(db, 'PATCH', '/api/designs/D/components/c2', { name: 'x' }, scoped)).status,
    ).toBe(404);
    expect((await call(db, 'PUT', '/api/designs/D/components/c2', main('c2'), scoped)).status).toBe(
      403,
    );
  });
});
