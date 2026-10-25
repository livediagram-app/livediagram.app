// The migration's doors (docs/migration.md step 6): the legacy guest merge, which may land on a guest, and the
// handoff of a browser's Local only parts to another app.
import type { Item } from '@liveworkspace/index-client';
import type { MigrationRoomPayload } from '@liveworkspace/migration/contract';
import { describe, expect, it, vi } from 'vitest';
import { drainPersonMerges } from './person-merges';
import { NOTICE_RETRY_AFTER_MS } from './person-notices';
import { body, call, h, makeItem, person, settle, useHarness } from './test-support';

useHarness({
  INDEX_KEY_LIVEDOCUMENTS: 'ldoc-key',
  APP_ORIGIN_LIVEDOCUMENTS: 'https://livedocuments.app',
});

const LEGACY = 'guest_0f8b5a2c-3d4e-4f60-8a1b-2c3d4e5f6a7b';
const NEW_GUEST = 'guest_11111111-2222-4333-8444-555555555555';

const merge = (payload: unknown) =>
  call('/internal/merge', { method: 'POST', auth: 'merge-key', body: payload });

// A legacy guest's copied work, as the migrate tool's index SQL writes it: an item and a folder in their own space.
function seedLegacy() {
  h.db.sql
    .prepare(
      `INSERT INTO folders (id, owner_id, team_id, scope, parent_id, name, created_at, updated_at)
       VALUES ('f-old', ?, NULL, ?, NULL, 'Old folder', 1, 1)`,
    )
    .run(LEGACY, `p:${LEGACY}`);
  h.db.sql
    .prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, source, intent, summary,
        created_at, updated_at) VALUES ('i-old', 'livediagram', 'canvas', ?, NULL, ?, 'f-old', 'Old diagram',
        'import', NULL, '{}', 1, 1)`,
    )
    .run(LEGACY, `p:${LEGACY}`);
  h.db.sql
    .prepare('INSERT INTO favourites (person_id, item_id, created_at) VALUES (?, ?, 1)')
    .run(LEGACY, 'i-old');
}

const itemRow = (id: string) =>
  h.db.sql.prepare('SELECT owner_id, scope, folder_id FROM items WHERE id = ?').get(id);

describe('the legacy guest merge', () => {
  it('still refuses a guest target without legacy', async () => {
    seedLegacy();
    expect((await merge({ guestId: LEGACY, userId: NEW_GUEST })).status).toBe(400);
    expect((await merge({ guestId: LEGACY, userId: NEW_GUEST, legacy: 'yes' })).status).toBe(400);
    expect(itemRow('i-old')).toEqual({
      owner_id: LEGACY,
      scope: `p:${LEGACY}`,
      folder_id: 'f-old',
    });
  });

  it('refuses merging a guest into itself, legacy or not', async () => {
    expect((await merge({ guestId: LEGACY, userId: LEGACY, legacy: true })).status).toBe(400);
  });

  it('moves a legacy guest’s things to a new guest, into the guest’s own space', async () => {
    seedLegacy();
    const res = await merge({ guestId: LEGACY, userId: NEW_GUEST, legacy: true });
    expect(await body(res)).toEqual({ items: 1 });
    expect(itemRow('i-old')).toEqual({
      owner_id: NEW_GUEST,
      scope: `p:${NEW_GUEST}`,
      folder_id: 'f-old',
    });
    const guest = await person(NEW_GUEST, { guest: true });
    const mine = await body<{ items: Item[] }>(await call('/items', { auth: guest.auth }));
    expect(mine.items.map((i) => [i.title, i.ownerId, i.folderId, i.favourite])).toEqual([
      ['Old diagram', NEW_GUEST, 'f-old', true],
    ]);
    // Again: nothing left to move.
    expect(await body(await merge({ guestId: LEGACY, userId: NEW_GUEST, legacy: true }))).toEqual({
      items: 0,
    });
  });

  it('moves a legacy guest’s things to an account', async () => {
    seedLegacy();
    const ada = await person('user_ada');
    const theirs = await makeItem(ada.auth, { title: 'New plan' });
    expect(await body(await merge({ guestId: LEGACY, userId: 'user_ada', legacy: true }))).toEqual({
      items: 1,
    });
    expect(itemRow('i-old')).toEqual({
      owner_id: 'user_ada',
      scope: 'p:user_ada',
      folder_id: 'f-old',
    });
    const mine = await body<{ items: Item[] }>(await call('/items', { auth: ada.auth }));
    expect(mine.items.map((i) => i.id).sort()).toEqual(['i-old', theirs.id].sort());
  });

  it('tells the apps it was legacy, and keeps the ordinary shape otherwise', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    seedLegacy();
    await merge({ guestId: LEGACY, userId: NEW_GUEST, legacy: true });
    await merge({ guestId: 'guest_plain', userId: 'user_bea' });
    await settle();
    const told = (guest: string) =>
      h.appCalls.filter((c) => c.url.includes(`/api/internal/people/${guest}/merge`));
    expect(told(LEGACY).length).toBeGreaterThan(0);
    expect(told(LEGACY).every((c) => c.method === 'POST')).toBe(true);
    expect(told(LEGACY)[0]!.body).toEqual({ into: NEW_GUEST, legacy: true });
    expect(told('guest_plain')[0]!.body).toEqual({ into: 'user_bea' });
  });

  it('keeps the legacy flag on a row the app has not confirmed yet', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.appAnswer = () => new Response(null, { status: 400 });
    await merge({ guestId: LEGACY, userId: NEW_GUEST, legacy: true });
    await settle();
    expect(
      h.db.sql.prepare('SELECT DISTINCT legacy, user_id FROM person_app_merges').all(),
    ).toEqual([{ legacy: 1, user_id: NEW_GUEST }]);
    h.appAnswer = () => new Response(null, { status: 200 });
    h.appCalls = [];
    await drainPersonMerges(h.db.env, Date.now() + NOTICE_RETRY_AFTER_MS + 1);
    expect(h.appCalls[0]!.body).toEqual({ into: NEW_GUEST, legacy: true });
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM person_app_merges').get()).toEqual({ n: 0 });
  });
});

describe('the migration handoff', () => {
  const payload = (patch: Partial<MigrationRoomPayload> = {}): MigrationRoomPayload => ({
    v: 1,
    app: 'livedocuments',
    id: 'part-1',
    name: 'Slides',
    ownerId: 'someone-else',
    teamId: 'team-x',
    createdAt: 1,
    savedAt: 2,
    source: null,
    presentation: null,
    opensIn: null,
    tabKind: null,
    tabs: [],
    changesets: [],
    imageGrants: [],
    imageOwners: [],
    plan: null,
    ...patch,
  });
  const handoff = (
    request: unknown,
    personId: string | null = NEW_GUEST,
    app = 'livediagram',
    key = 'ld-key',
  ) =>
    call('/app/migration/handoff', {
      method: 'POST',
      auth: key,
      headers: { 'X-Index-App': app, ...(personId ? { 'X-Index-Person': personId } : {}) },
      body: request,
    });
  const doorCalls = () => h.appCalls.filter((c) => c.url.includes('/migration'));

  it('makes the item for a guest and has the app write it', async () => {
    const res = await handoff({ app: 'livedocuments', title: 'Old slides', payload: payload() });
    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ id: 'part-1', app: 'livedocuments' });
    expect(
      h.db.sql
        .prepare(
          'SELECT app, kind, owner_id, team_id, scope, folder_id, title, source FROM items WHERE id = ?',
        )
        .get('part-1'),
    ).toEqual({
      app: 'livedocuments',
      kind: 'document',
      owner_id: NEW_GUEST,
      team_id: null,
      scope: `p:${NEW_GUEST}`,
      folder_id: null,
      title: 'Old slides',
      source: 'import',
    });
    const [door] = doorCalls();
    expect(door!.method).toBe('PUT');
    expect(door!.url).toBe('https://livedocuments.app/api/internal/items/part-1/migration');
    expect(door!.headers.get('Authorization')).toBe('Bearer ldoc-key');
    expect(door!.headers.get('X-Index-App')).toBe('livedocuments');
    // The owner and place are the index's, whatever the payload said.
    expect(door!.body).toEqual(payload({ ownerId: NEW_GUEST, teamId: null }));
    // Its `created` event, on the guest's own Timeline.
    const guest = await person(NEW_GUEST, { guest: true });
    const timeline = await body<{ events: { type: string; itemId: string }[] }>(
      await call('/timeline', { auth: guest.auth }),
    );
    expect(timeline.events.map((e) => [e.type, e.itemId])).toEqual([['created', 'part-1']]);
  });

  it('takes an account too', async () => {
    const res = await handoff(
      { app: 'livedocuments', title: 'Deck', payload: payload() },
      'user_ada',
    );
    expect(res.status).toBe(201);
    expect(itemRow('part-1')).toEqual({
      owner_id: 'user_ada',
      scope: 'p:user_ada',
      folder_id: null,
    });
  });

  it('takes the item back when the app fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.appAnswer = () => new Response(null, { status: 500 });
    const res = await handoff({ app: 'livedocuments', title: 'Deck', payload: payload() });
    expect(res.status).toBe(502);
    expect(await body(res)).toEqual({ error: 'migration_failed' });
    expect(itemRow('part-1')).toBeUndefined();
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM timeline_events').get()).toEqual({ n: 0 });
    // And a later try makes it afresh.
    h.appAnswer = () => new Response(null, { status: 200 });
    expect(
      (await handoff({ app: 'livedocuments', title: 'Deck', payload: payload() })).status,
    ).toBe(201);
  });

  it('takes the item back when the app is not configured', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await handoff({
      app: 'livedesign',
      title: 'Logo',
      payload: payload({ app: 'livedesign' }),
    });
    expect(res.status).toBe(502);
    expect(itemRow('part-1')).toBeUndefined();
  });

  it('is livediagram’s alone, and needs a well-formed person', async () => {
    const request = { app: 'livedocuments', title: 'Deck', payload: payload() };
    expect((await handoff(request, NEW_GUEST, 'liveplanner', 'lp-key')).status).toBe(403);
    expect((await handoff(request, NEW_GUEST, 'livediagram', 'wrong')).status).toBe(401);
    expect((await handoff(request, null)).status).toBe(401);
    expect((await handoff(request, 'guest_not-a-uuid')).status).toBe(401);
    expect((await handoff(request, 'p:user_ada')).status).toBe(401);
    expect(doorCalls()).toEqual([]);
  });

  it('checks the body', async () => {
    const cases: unknown[] = [
      { app: 'livediagram', title: 'x', payload: payload({ app: 'livediagram' }) },
      { app: 'livedocuments', title: '', payload: payload() },
      { app: 'livedocuments', title: 'x', payload: payload({ app: 'liveplanner' }) },
      { app: 'livedocuments', title: 'x', payload: { ...payload(), v: 2 } },
      { app: 'livedocuments', title: 'x', payload: payload({ id: '' }) },
      { app: 'livedocuments', title: 'x', payload: { ...payload(), tabs: 'none' } },
      { app: 'livedocuments', title: 'x' },
    ];
    for (const request of cases) expect((await handoff(request)).status).toBe(400);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: 0 });
  });

  it('refuses an id already taken, and a body over the cap', async () => {
    const ada = await person('user_ada');
    const taken = await makeItem(ada.auth);
    expect(
      (await handoff({ app: 'livedocuments', title: 'x', payload: payload({ id: taken.id }) }))
        .status,
    ).toBe(409);
    const huge = await handoff({
      app: 'livedocuments',
      title: 'x',
      payload: payload({ name: 'a'.repeat(33 * 1024 * 1024) }),
    });
    expect(huge.status).toBe(413);
    expect(doorCalls()).toEqual([]);
  });

  it('is limited per person', async () => {
    const keys: string[] = [];
    const limiter = {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: false };
      },
    } as unknown as RateLimit;
    const res = await call('/app/migration/handoff', {
      method: 'POST',
      auth: 'ld-key',
      headers: { 'X-Index-App': 'livediagram', 'X-Index-Person': NEW_GUEST },
      body: { app: 'livedocuments', title: 'x', payload: payload() },
      env: { ...h.db.env, MIGRATION_LIMITER: limiter },
    });
    expect(res.status).toBe(429);
    expect(keys).toEqual([`handoff:${NEW_GUEST}`]);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: 0 });
  });
});
