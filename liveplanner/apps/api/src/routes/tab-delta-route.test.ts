import { afterEach, describe, expect, it, vi } from 'vitest';
import { diffToElementOps, type Element } from '@liveplanner/project';
import {
  TAB_DELTA_MAX_OPS,
  elementsDigest,
  planTabDelta,
} from '@liveworkspace/api-schema/tab-delta';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { PlanGrant } from '../index-service';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// The delta save (docs/specs/006-project/blueprints/delta-saves.md): the element ops since the stored copy, rebuilt
// over it, proved by a digest and saved as the whole-tab PUT would have saved the whole tab; anything that does not
// line up refused 409 delta_refused, with nothing written, for the editor to save whole.

const OWNER = 'user_owner';
const PATH = '/api/projects/D/tabs/t1/delta';
const TAB = { id: 't1', name: 'Board' };
const box = (id: string, label = id): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    label,
  }) as unknown as Element;

function call(
  db: SqliteD1,
  method: string,
  path: string,
  opts: {
    body?: unknown;
    headers?: Record<string, string>;
    token?: boolean;
    visitor?: { owner: string; grant: PlanGrant };
  } = {},
) {
  if (opts.visitor) {
    return handleProjects(
      makeTestRouteContext(method, path, {
        env: db.env,
        owner: opts.visitor.owner,
        body: opts.body,
        headers: opts.headers,
        grant: opts.visitor.grant,
      }),
    );
  }
  return handleProjects(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: OWNER,
      accountUserId: opts.token ? null : OWNER,
      verifiedUserId: OWNER,
      body: opts.body,
      headers: opts.headers,
      token: opts.token ? { id: 'tok_1' } : null,
    }),
  );
}

// A share link's grant on D at `level`, scoped to `tab` when given.
const grantAt = (level: PlanGrant['level'], tab: string | null = null): PlanGrant => ({
  item: 'D',
  level,
  tab,
  sub: 'link:abc',
  team: null,
  exp: 2_000_000_000,
  shareCode: 'abc',
  token: 'g',
});

async function itemWith(elements: Element[]): Promise<SqliteD1> {
  const db = sqliteD1();
  const res = await call(db, 'POST', '/api/projects', {
    body: { id: 'D', name: 'Board', tabs: [{ id: 't1', name: 'Board', elements }] },
  });
  expect(res.status).toBe(201);
  return db;
}

const stored = (db: SqliteD1) =>
  (
    JSON.parse(db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!.data as string) as {
      elements: Element[];
    }
  ).elements;
const revOf = (db: SqliteD1) =>
  Number(db.sql.prepare("SELECT rev FROM tabs WHERE id = 't1'").get()!.rev);

// The delta body that turns `base` (stored at `rev`) into `next`. Built directly: on these small tabs the editor's
// planTabDelta would save whole, a delta being no smaller.
async function deltaFor(base: Element[], next: Element[], rev: number) {
  return {
    baseRev: rev,
    digest: await elementsDigest(next),
    ops: diffToElementOps(base, next),
    tab: TAB,
  } as Record<string, unknown>;
}

const send = (db: SqliteD1, body: unknown, headers: Record<string, string> = {}) =>
  call(db, 'POST', PATH, { body, headers });

const answer = async (res: Response) => ({ status: res.status, body: await res.json() });

afterEach(() => vi.restoreAllMocks());

describe('the delta path', () => {
  it('stores exactly the tab the editor holds, answering the new revision and its digest', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const base = [box('a'), box('b'), box('c')];
    const db = await itemWith(base);
    const next = [box('d'), box('a', 'edited'), box('c')];
    const res = await send(db, await deltaFor(base, next, revOf(db)));
    expect(res.status).toBe(200);
    const rev = revOf(db);
    expect(await res.json()).toEqual({ rev, digest: await elementsDigest(next) });
    expect(stored(db)).toEqual(next);
    expect(info).toHaveBeenCalledWith('[tab-delta] saved', {
      projectId: 'D',
      tabId: 't1',
      ops: 3,
      matched: true,
    });
    // The stored copy is the next base: a second delta over it lands too.
    const again = [box('a', 'edited'), box('c', 'again')];
    expect((await send(db, await deltaFor(next, again, rev))).status).toBe(200);
    expect(stored(db)).toEqual(again);
  });

  // Work Tracker 802: a measured bytes-per-save on a large tab, a one-label edit among 2,000 elements.
  it('sends a small delta for a small edit on a 2,000-element tab', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const base = Array.from({ length: 2_000 }, (_, i) => ({
      ...box(`el-${i}`, `Step ${i} of the onboarding flow`),
      x: (i % 50) * 160,
      y: Math.floor(i / 50) * 120,
    })) as unknown as Element[];
    const db = await itemWith(base);
    const next = base.map((e, i) => (i === 1_234 ? { ...e, label: 'Step 1234, renamed' } : e));
    const whole = JSON.stringify({ ...TAB, elements: next }).length;
    const plan = await planTabDelta({
      base: { rev: revOf(db), elements: base },
      tab: { ...TAB, elements: next },
      diff: diffToElementOps,
    });
    expect(whole).toBeGreaterThan(200_000);
    expect(plan!.body.length).toBeLessThan(1_000);
    const res = await send(db, JSON.parse(plan!.body));
    expect(res.status).toBe(200);
    expect(stored(db)).toEqual(next);
  });

  it('carries the tab fields whole, and keeps a tab-scoped editor to the stored name', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const base = [box('a')];
    const db = await itemWith(base);
    const body = await deltaFor(base, [box('a', 'x')], revOf(db));
    expect((await send(db, { ...body, tab: { ...TAB, name: 'Renamed' } })).status).toBe(200);
    const nameOf = () => db.sql.prepare("SELECT name FROM tabs WHERE id = 't1'").get();
    expect(nameOf()).toEqual({ name: 'Renamed' });
    const scoped = await call(db, 'POST', PATH, {
      body: {
        ...(await deltaFor([box('a', 'x')], [box('a', 'y')], revOf(db))),
        tab: { ...TAB, name: 'Mine' },
      },
      visitor: { owner: 'guest_v', grant: grantAt('edit', 't1') },
    });
    expect(scoped.status).toBe(200);
    expect(nameOf()).toEqual({ name: 'Renamed' });
    expect(stored(db)).toEqual([box('a', 'y')]);
  });
});

describe('refusals fall back', () => {
  it.each([
    [
      'stale_base',
      async (base: Element[], rev: number) => deltaFor(base, [box('a', 'x')], rev + 6),
    ],
    [
      'digest_mismatch',
      async (base: Element[], rev: number) => ({
        ...(await deltaFor(base, [box('a', 'x')], rev)),
        digest: 'f'.repeat(64),
      }),
    ],
    [
      // The editor's base was not the stored copy: its ops rebuild something else.
      'digest_mismatch',
      async (_base: Element[], rev: number) =>
        deltaFor([box('a'), box('z')], [box('a', 'x'), box('z')], rev),
    ],
    [
      'too_many_ops',
      async (_base: Element[], rev: number) => ({
        baseRev: rev,
        digest: 'a'.repeat(64),
        ops: Array.from({ length: TAB_DELTA_MAX_OPS + 1 }, (_, i) => ({
          kind: 'remove',
          id: `x${i}`,
        })),
        tab: TAB,
      }),
    ],
  ])('refuses %s, writes nothing, and the whole save after it lands', async (reason, make) => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const base = [box('a')];
    const db = await itemWith(base);
    const rev = revOf(db);
    expect(await answer(await send(db, await make(base, rev)))).toEqual({
      status: 409,
      body: { error: 'delta_refused', reason },
    });
    expect(stored(db)).toEqual(base);
    expect(revOf(db)).toBe(rev);
    expect(info).toHaveBeenCalledWith('[tab-delta] refused', {
      projectId: 'D',
      tabId: 't1',
      reason,
    });
    const whole = await call(db, 'PUT', '/api/projects/D/tabs/t1', {
      body: { ...TAB, elements: [box('a', 'x')] },
    });
    expect(whole.status).toBe(200);
    expect(stored(db)).toEqual([box('a', 'x')]);
  });

  it('refuses a tab it does not store: a new tab is saved whole', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await itemWith([box('a')]);
    const res = await call(db, 'POST', '/api/projects/D/tabs/t2/delta', {
      body: await deltaFor([], [box('b')], 0),
    });
    expect(await answer(res)).toEqual({
      status: 409,
      body: { error: 'delta_refused', reason: 'no_base' },
    });
  });

  it('answers a malformed body 400', async () => {
    const db = await itemWith([box('a')]);
    const res = await send(db, { baseRev: 1, digest: 'nope', ops: [], tab: TAB });
    expect(await answer(res)).toEqual({
      status: 400,
      body: { error: 'bad_request', message: 'invalid digest' },
    });
  });

  it('keeps the whole save rules: an unmarked blanking is 409', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = await itemWith([box('a')]);
    const rev = revOf(db);
    expect(await answer(await send(db, await deltaFor([box('a')], [], rev)))).toEqual({
      status: 409,
      body: { error: 'empty_tab_overwrite_blocked' },
    });
    expect(stored(db)).toEqual([box('a')]);
    const marked = await send(db, await deltaFor([box('a')], [], rev), { 'X-Allow-Empty': '1' });
    expect(marked.status).toBe(200);
    expect(stored(db)).toEqual([]);
  });
});

describe('share roles', () => {
  it('refuses an API token before reading anything', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await itemWith([box('a')]);
    const res = await call(db, 'POST', PATH, {
      body: await deltaFor([box('a')], [box('a', 'x')], revOf(db)),
      token: true,
    });
    expect(res.status).toBe(405);
    expect(stored(db)).toEqual([box('a')]);
  });

  it('lets an Editor save, and neither a Participant nor a Viewer', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await itemWith([box('a')]);
    const body = await deltaFor([box('a')], [box('a', 'x')], revOf(db));
    for (const level of ['view', 'participate'] as const) {
      const res = await call(db, 'POST', PATH, {
        body,
        visitor: { owner: 'guest_v', grant: grantAt(level) },
      });
      expect(res.status).toBe(403);
      expect(stored(db)).toEqual([box('a')]);
    }
    const res = await call(db, 'POST', PATH, {
      body,
      visitor: { owner: 'guest_v', grant: grantAt('edit') },
    });
    expect(res.status).toBe(200);
    expect(stored(db)).toEqual([box('a', 'x')]);
  });

  it("refuses a tab-scoped link another tab's delta, as missing", async () => {
    const db = await itemWith([box('a')]);
    const res = await call(db, 'POST', PATH, {
      body: await deltaFor([box('a')], [box('a', 'x')], revOf(db)),
      visitor: { owner: 'guest_v', grant: grantAt('edit', 't9') },
    });
    expect(res.status).toBe(404);
    expect(stored(db)).toEqual([box('a')]);
  });

  it('answers a missing item as the PUT does', async () => {
    const db = await itemWith([box('a')]);
    const res = await call(db, 'POST', '/api/projects/NOPE/tabs/t1/delta', {
      body: await deltaFor([box('a')], [box('a', 'x')], 1),
    });
    expect(res.status).toBe(404);
  });
});
