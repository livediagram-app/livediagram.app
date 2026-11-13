import { afterEach, describe, expect, it, vi } from 'vitest';
import { diffToElementOps, type Element } from '@livediagram/document';
import {
  TAB_DELTA_MAX_OPS,
  elementsDigest,
  planTabDelta,
} from '@liveworkspace/api-schema/tab-delta';
import type { SqliteD1 } from '../test-sqlite-d1';
import {
  OWNER,
  box,
  call,
  documentWith,
  grantAt,
  recordAdd,
  revOf,
  stored,
} from './tab-save-test-kit';

// The delta save (docs/specs/006-document/blueprints/delta-saves.md): the element ops since the stored copy,
// rebuilt over it, proved by a digest and saved as the whole-tab PUT would have saved the whole tab; anything that
// does not line up refused 409 delta_refused, with nothing written, for the editor to save whole.

const PATH = '/api/documents/D/tabs/t1/delta';
const TAB = { id: 't1', name: 'Board' };

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

const refusal = async (res: Response) => ({ status: res.status, body: await res.json() });

afterEach(() => vi.restoreAllMocks());

describe('the delta path', () => {
  it('stores exactly the tab the editor holds, answering the new revision and its digest', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const base = [box('a'), box('b'), box('c')];
    const db = await documentWith(base);
    const next = [box('d'), box('a', 'edited'), box('c')];
    const res = await send(db, await deltaFor(base, next, Number(revOf(db))));
    expect(res.status).toBe(200);
    const digest = await elementsDigest(next);
    expect(await res.json()).toEqual({ rev: 2, digest });
    expect(stored(db)).toEqual(next);
    expect(info).toHaveBeenCalledWith('[tab-delta] saved', {
      documentId: 'D',
      tabId: 't1',
      ops: 3,
      matched: true,
    });
    // And the stored copy is the next base: a second delta over it lands too.
    const again = [box('a', 'edited'), box('c', 'again')];
    expect((await send(db, await deltaFor(next, again, 2))).status).toBe(200);
    expect(stored(db)).toEqual(again);
  });

  it('carries the tab fields whole, and keeps a tab-scoped editor to the stored name', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const base = [box('a')];
    const db = await documentWith(base);
    const body = await deltaFor(base, [box('a', 'x')], 1);
    const renamed = { ...body, tab: { ...TAB, name: 'Renamed' } };
    expect((await send(db, renamed)).status).toBe(200);
    expect(db.sql.prepare("SELECT name FROM tabs WHERE id = 't1'").get()).toEqual({
      name: 'Renamed',
    });
    const scoped = await call(db, 'POST', PATH, {
      body: {
        ...(await deltaFor([box('a', 'x')], [box('a', 'y')], 2)),
        tab: { ...TAB, name: 'Mine' },
      },
      visitor: { owner: 'guest_v', grant: grantAt('edit', 't1') },
    });
    expect(scoped.status).toBe(200);
    expect(db.sql.prepare("SELECT name FROM tabs WHERE id = 't1'").get()).toEqual({
      name: 'Renamed',
    });
    expect(stored(db)).toEqual([box('a', 'y')]);
  });

  // A changeset recorded since the editor's base advances the revision: the base is stale, and the whole save
  // merges it as it always has.
  it('refuses a base an unseen changeset has moved on from', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const base = [box('a')];
    const db = await documentWith(base);
    const seen = String(revOf(db));
    recordAdd(db, box('n'));
    const body = await deltaFor(base, [box('a', 'edited')], Number(seen));
    expect(await refusal(await send(db, body, { 'X-Changeset-Seen': seen }))).toEqual({
      status: 409,
      body: { error: 'delta_refused', reason: 'stale_base' },
    });
    expect(stored(db).map((e) => e.id)).toEqual(['a', 'n']);
  });

  // The whole save's rules run on the rebuilt tab: here another person's comment keeps its words, so the store
  // holds other elements than the editor's, and the answer's digest (not the one sent) says so.
  it('runs the whole save rules, answering the digest of what it stored', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const theirs = {
      id: 'c1',
      text: 'their words',
      createdAt: 1,
      authorName: 'Priya',
      authorColor: '#000',
      authorId: 'priya',
    };
    const base = [{ ...box('a'), commentThread: { comments: [theirs] } } as Element];
    const db = await documentWith(base);
    const next = [
      { ...box('a'), commentThread: { comments: [{ ...theirs, text: 'other words' }] } } as Element,
    ];
    const res = await send(db, await deltaFor(base, next, Number(revOf(db))));
    expect(res.status).toBe(200);
    const answer = (await res.json()) as { rev: number; digest: string };
    expect(answer.digest).not.toBe(await elementsDigest(next));
    expect(answer.digest).toBe(await elementsDigest(stored(db)));
    expect(JSON.stringify(stored(db))).toContain('their words');
    expect(info).toHaveBeenCalledWith(
      '[tab-delta] saved',
      expect.objectContaining({ matched: false }),
    );
  });

  // Work Tracker 661: a 2,000-element tab sent about 300 KB per save.
  it('sends a small delta for a small edit on a 2,000-element tab', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const base = Array.from({ length: 2_000 }, (_, i) => ({
      ...box(`el-${i}`, `Step ${i} of the onboarding flow`),
      x: (i % 50) * 160,
      y: Math.floor(i / 50) * 120,
      width: 140,
      height: 80,
    }));
    const db = await documentWith(base);
    const next = base.map((e, i) => (i === 1_234 ? { ...e, label: 'Step 1234, renamed' } : e));
    const whole = JSON.stringify({ ...TAB, elements: next }).length;
    const plan = await planTabDelta({
      base: { rev: 1, elements: base },
      tab: { ...TAB, elements: next },
      diff: diffToElementOps,
    });
    expect(whole).toBeGreaterThan(250_000);
    expect(plan!.body.length).toBeLessThan(600);
    const res = await send(db, JSON.parse(plan!.body));
    expect(res.status).toBe(200);
    expect(stored(db)).toEqual(next);
  });
});

describe('refusals fall back', () => {
  it.each([
    ['stale_base', async (base: Element[]) => deltaFor(base, [box('a', 'x')], 7)],
    [
      'digest_mismatch',
      async (base: Element[]) => ({
        ...(await deltaFor(base, [box('a', 'x')], 1)),
        digest: 'f'.repeat(64),
      }),
    ],
    [
      // The editor's base was not the stored copy: its ops rebuild something else.
      'digest_mismatch',
      async () => deltaFor([box('a'), box('z')], [box('a', 'x'), box('z')], 1),
    ],
    [
      'too_many_ops',
      async () => ({
        baseRev: 1,
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
    const db = await documentWith(base);
    expect(await refusal(await send(db, await make(base)))).toEqual({
      status: 409,
      body: { error: 'delta_refused', reason },
    });
    expect(stored(db)).toEqual(base);
    expect(revOf(db)).toBe(1);
    expect(info).toHaveBeenCalledWith('[tab-delta] refused', {
      documentId: 'D',
      tabId: 't1',
      reason,
    });
    const whole = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      body: { ...TAB, elements: [box('a', 'x')] },
    });
    expect(whole.status).toBe(200);
    expect(stored(db)).toEqual([box('a', 'x')]);
  });

  it('refuses a tab it does not store: a new tab is saved whole', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const res = await call(db, 'POST', '/api/documents/D/tabs/t2/delta', {
      body: await deltaFor([], [box('b')], 0),
    });
    expect(await refusal(res)).toEqual({
      status: 409,
      body: { error: 'delta_refused', reason: 'no_base' },
    });
  });

  it('answers a malformed body 400, an unparsable one too', async () => {
    const db = await documentWith([box('a')]);
    expect(
      await refusal(await send(db, { baseRev: 1, digest: 'nope', ops: [], tab: TAB })),
    ).toEqual({
      status: 400,
      body: { error: 'bad_request', message: 'invalid digest' },
    });
    expect((await send(db, '[1]')).status).toBe(400);
  });

  it('keeps the whole save rules: a malformed element is 400, an unmarked blanking 409', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const bad = { ...box('s'), shape: 'step', label: 5 } as unknown as Element;
    expect((await send(db, await deltaFor([box('a')], [box('a'), bad], 1))).status).toBe(400);
    const blank = await send(db, await deltaFor([box('a')], [], 1));
    expect(await refusal(blank)).toEqual({
      status: 409,
      body: { error: 'empty_tab_overwrite_blocked' },
    });
    expect(stored(db)).toEqual([box('a')]);
    expect(
      (await send(db, await deltaFor([box('a')], [], 1), { 'X-Allow-Empty': '1' })).status,
    ).toBe(200);
    expect(stored(db)).toEqual([]);
  });
});

describe('share roles', () => {
  it('refuses an API token before reading anything', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const res = await call(db, 'POST', PATH, {
      body: await deltaFor([box('a')], [box('a', 'x')], 1),
      token: true,
    });
    expect(res.status).toBe(405);
    expect(stored(db)).toEqual([box('a')]);
  });

  it('lets an Editor save, and neither a Participant nor a Viewer', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const body = await deltaFor([box('a')], [box('a', 'x')], 1);
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
    const db = await documentWith([box('a')]);
    const res = await call(db, 'POST', PATH, {
      body: await deltaFor([box('a')], [box('a', 'x')], 1),
      visitor: { owner: 'guest_v', grant: grantAt('edit', 't9') },
    });
    expect(res.status).toBe(404);
    expect(stored(db)).toEqual([box('a')]);
  });

  it('answers a missing document as the PUT does', async () => {
    const db = await documentWith([box('a')]);
    const res = await call(db, 'POST', '/api/documents/NOPE/tabs/t1/delta', {
      body: await deltaFor([box('a')], [box('a', 'x')], 1),
    });
    expect(res.status).toBe(404);
  });
});

void OWNER;
