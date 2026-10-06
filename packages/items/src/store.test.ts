import { describe, expect, it } from 'vitest';
import {
  EMPTY_ITEM_STORE,
  applyItemWrite,
  inverseItemWrites,
  mergeItemChanges,
  storeAsCreates,
  withCreateIds,
  type ItemStoreState,
} from './store';
import { ITEMS_MAX } from './limits';
import { ALI, item } from './test-items';

const ctx = { now: 5, by: ALI, newId: () => 'fixedid1' };

function ok(
  r: ReturnType<typeof applyItemWrite>,
): ItemStoreState & { upserts: unknown[]; removed: string[] } {
  if (!r.ok) throw new Error(r.error);
  return { ...r.state, upserts: r.upserts, removed: r.removed };
}

describe('applyItemWrite', () => {
  it('creates with the next key and raises the rev', () => {
    const s = ok(
      applyItemWrite(
        EMPTY_ITEM_STORE,
        { kind: 'create', creates: [{ type: 'task', fields: { title: 'a' } }] },
        ctx,
      ),
    );
    expect(s.items[0]).toMatchObject({ id: 'fixedid1', key: 1 });
    expect([s.rev, s.nextKey]).toEqual([1, 2]);
  });

  it('restores a free key below the next key, refuses a taken id and the cap', () => {
    const one = ok(
      applyItemWrite(
        EMPTY_ITEM_STORE,
        {
          kind: 'create',
          creates: [
            { id: 'aaaaaa', type: 'task', fields: { title: 'a' } },
            { id: 'bbbbbb', type: 'task', fields: { title: 'b' } },
          ],
        },
        ctx,
      ),
    );
    const gone = ok(applyItemWrite(one, { kind: 'delete', id: 'aaaaaa' }, ctx));
    expect(gone.removed).toEqual(['aaaaaa']);
    const back = ok(
      applyItemWrite(
        gone,
        {
          kind: 'create',
          creates: [{ id: 'aaaaaa', type: 'task', fields: { title: 'a' }, key: 1 }],
        },
        ctx,
      ),
    );
    expect(back.items.find((i) => i.id === 'aaaaaa')!.key).toBe(1);
    const taken = ok(
      applyItemWrite(
        back,
        {
          kind: 'create',
          creates: [{ id: 'cccccc', type: 'task', fields: { title: 'c' }, key: 2 }],
        },
        ctx,
      ),
    );
    expect(taken.items.find((i) => i.id === 'cccccc')!.key).toBe(3);
    expect(
      applyItemWrite(
        back,
        { kind: 'create', creates: [{ id: 'aaaaaa', type: 'task', fields: { title: 'x' } }] },
        ctx,
      ),
    ).toEqual({ ok: false, error: 'item_exists' });
    const full: ItemStoreState = {
      items: Array.from({ length: ITEMS_MAX }, () => item({ title: 'x' })),
      rev: 0,
      nextKey: 1,
    };
    expect(
      applyItemWrite(
        full,
        { kind: 'create', creates: [{ type: 'task', fields: { title: 'y' } }] },
        ctx,
      ),
    ).toEqual({ ok: false, error: 'items_full' });
  });

  it('patches, moves and votes an item, or says it is not found', () => {
    const a = item({ title: 'a', status: 'todo' });
    const s: ItemStoreState = { items: [a], rev: 3, nextKey: 9 };
    expect(
      ok(applyItemWrite(s, { kind: 'patch', id: a.id, patch: { set: { title: 'b' } } }, ctx))
        .items[0]!.fields['title'],
    ).toBe('b');
    expect(
      ok(applyItemWrite(s, { kind: 'move', id: a.id, move: { status: 'done' } }, ctx)).items[0]!
        .fields['status'],
    ).toBe('done');
    expect(
      ok(applyItemWrite(s, { kind: 'vote', id: a.id, delta: 1 }, ctx)).items[0]!.fields['votes'],
    ).toEqual({ [ALI.id]: 1 });
    expect(applyItemWrite(s, { kind: 'delete', id: 'nope' }, ctx)).toEqual({
      ok: false,
      error: 'item_not_found',
    });
  });
});

describe('mergeItemChanges', () => {
  it('keeps the higher rev per item, removes, and moves the rev and next key on', () => {
    const a = item({ title: 'a' }, { rev: 3, key: 4 });
    const b = item({ title: 'b' }, { rev: 1, key: 5 });
    const s: ItemStoreState = { items: [a, b], rev: 10, nextKey: 6 };
    const merged = mergeItemChanges(
      s,
      [{ ...a, rev: 2, fields: { title: 'stale' } }, { ...item({ title: 'c' }, { key: 9 }) }],
      [b.id],
      12,
    );
    expect(merged.items.find((i) => i.id === a.id)!.fields['title']).toBe('a');
    expect(merged.items.some((i) => i.id === b.id)).toBe(false);
    expect([merged.rev, merged.nextKey]).toEqual([12, 10]);
    expect(mergeItemChanges(s, [], [], 2).rev).toBe(10);
  });
});

describe('inverseItemWrites', () => {
  const a = item(
    { title: 'a', status: 'todo', priority: 'low', votes: { x: 1 } },
    { key: 3, type: 'bug' },
  );
  const b = item({ title: 'b', status: 'todo' }, { rank: 'z' });
  const s: ItemStoreState = { items: [a, b], rev: 1, nextKey: 9 };

  it('undoes each write kind', () => {
    expect(inverseItemWrites(s, { kind: 'vote', id: a.id, delta: 1 })).toBeNull();
    expect(inverseItemWrites(s, { kind: 'patch', id: 'missing', patch: {} })).toBeNull();
    expect(
      inverseItemWrites(s, {
        kind: 'create',
        creates: [{ id: 'newone1', type: 'task', fields: { title: 'n' } }],
      }),
    ).toEqual([{ kind: 'delete', id: 'newone1' }]);
    expect(inverseItemWrites(s, { kind: 'delete', id: a.id })).toEqual([
      {
        kind: 'create',
        creates: [
          {
            id: a.id,
            type: 'bug',
            key: 3,
            fields: { title: 'a', status: 'todo', priority: 'low' },
            votes: { x: 1 },
            place: { status: 'todo', before: b.id },
          },
        ],
      },
    ]);
    expect(
      inverseItemWrites(s, { kind: 'patch', id: a.id, patch: { set: { title: 'z' } } }),
    ).toEqual([{ kind: 'patch', id: a.id, patch: { set: { title: 'a' } } }]);
    expect(
      inverseItemWrites(s, {
        kind: 'move',
        id: a.id,
        move: { status: 'done', set: { assignee: ALI }, clear: ['priority'], type: 'task' },
      }),
    ).toEqual([
      {
        kind: 'move',
        id: a.id,
        move: {
          status: 'todo',
          before: b.id,
          set: { priority: 'low' },
          clear: ['assignee'],
          type: 'bug',
        },
      },
    ]);
  });

  it('gives creates their ids', () => {
    const w = withCreateIds(
      {
        kind: 'create',
        creates: [
          { type: 'task', fields: { title: 'x' } },
          { id: 'keepme1', type: 'task', fields: { title: 'y' } },
        ],
      },
      () => 'madeid1',
    );
    expect(w.kind === 'create' && w.creates.map((c) => c.id)).toEqual(['madeid1', 'keepme1']);
    const d = { kind: 'delete' as const, id: 'x' };
    expect(withCreateIds(d)).toBe(d);
  });
});

describe('storeAsCreates', () => {
  it('rebuilds each column in rank order, votes kept', () => {
    const a = item({ title: 'a', status: 'todo', votes: { p: 2 } }, { rank: 'r', key: 1 });
    const b = item({ title: 'b', status: 'todo' }, { rank: 'i', key: 2 });
    const c = item({ title: 'c', status: 'done' }, { rank: 'a', key: 3 });
    const d = item({ title: 'd' }, { rank: 'a', key: 4 });
    const creates = storeAsCreates([a, b, c, d]);
    expect(creates.map((x) => x.fields['title'])).toEqual(['d', 'c', 'b', 'a']);
    expect(creates[3]).toMatchObject({ key: 1, votes: { p: 2 } });
    const rebuilt = applyItemWrite(EMPTY_ITEM_STORE, { kind: 'create', creates }, ctx);
    if (!rebuilt.ok) throw new Error('rebuild');
    const todo = rebuilt.state.items
      .filter((i) => i.fields['status'] === 'todo')
      .sort((x, y) => (x.rank < y.rank ? -1 : 1));
    expect(todo.map((i) => i.fields['title'])).toEqual(['b', 'a']);
    expect(rebuilt.state.items.find((i) => i.fields['title'] === 'a')!.fields['votes']).toEqual({
      p: 2,
    });
  });
});
