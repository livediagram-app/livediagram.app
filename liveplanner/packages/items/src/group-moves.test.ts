import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { applyMoves, groupMoves, inverseMoves } from './group-moves';
import { columnItems } from './apply';
import { rankBetween } from './rank';
import { applyItemWrite, inverseItemWrites, type ItemStoreState } from './store';
import type { Item } from './item';
import { ALI, item } from './test-items';

const ctx = { now: 9, by: ALI };

// A column of cards ranked a, b, c... in `status`.
function column(status: string, n: number): Item[] {
  const out: Item[] = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    const rank = rankBetween(prev, null);
    prev = rank;
    out.push(item({ title: `${status} ${i}`, status }, { rank }));
  }
  return out;
}

const ids = (list: readonly Item[]) => list.map((i) => i.id);
const state = (items: Item[]): ItemStoreState => ({ items, rev: 1, nextKey: 999 });

function ok(r: ReturnType<typeof applyItemWrite>): ItemStoreState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('groupMoves', () => {
  it('lands the first at the place and chains each next one after the one before', () => {
    expect(groupMoves(['a', 'b', 'c'], { status: 'done', before: 'x' })).toEqual([
      { id: 'a', move: { status: 'done', before: 'x' } },
      { id: 'b', move: { status: 'done', after: 'a' } },
      { id: 'c', move: { status: 'done', after: 'b' } },
    ]);
  });

  it("adds each card's own fields, and keeps the status out of a chain that names none", () => {
    expect(
      groupMoves(['a', 'b'], { before: null }, (id) =>
        id === 'b' ? { set: { x: 1 } } : undefined,
      ),
    ).toEqual([
      { id: 'a', move: { before: null } },
      { id: 'b', move: { after: 'a', set: { x: 1 } } },
    ]);
  });
});

describe('applyMoves', () => {
  it('lands a group together, in order, at the drop point', () => {
    const todo = column('todo', 4);
    const done = column('done', 3);
    const all = [...todo, ...done];
    const moves = groupMoves([todo[2]!.id, todo[0]!.id], { status: 'done', before: done[1]!.id });
    const r = applyMoves(all, moves, ctx);
    if (!r.ok) throw new Error('missing');
    const after = all.map((i) => r.moved.get(i.id) ?? i);
    expect(ids(columnItems(after, 'done'))).toEqual([
      done[0]!.id,
      todo[2]!.id,
      todo[0]!.id,
      done[1]!.id,
      done[2]!.id,
    ]);
    expect(ids(columnItems(after, 'todo'))).toEqual([todo[1]!.id, todo[3]!.id]);
  });

  it('answers the first missing id', () => {
    const todo = column('todo', 1);
    expect(applyMoves(todo, [{ id: 'gone', move: { status: 'todo' } }], ctx)).toEqual({
      ok: false,
      missing: 'gone',
    });
  });

  it('keeps 200 moves over a 2,000-card store within a small CPU budget', () => {
    const big = [...column('todo', 1000), ...column('done', 1000)];
    const moving = big.slice(0, 200).map((i) => i.id);
    const spent = cpuMsOf(() => {
      const r = applyMoves(big, groupMoves(moving, { status: 'done', before: null }), ctx);
      expect(r.ok).toBe(true);
    });
    expect(spent).toBeLessThan(cpuBudgetMs(4000));
  });
});

describe('moves through the store', () => {
  it('is one write, and its undo puts every card back where it sat', () => {
    const todo = column('todo', 5);
    const done = column('done', 2);
    const before = state([...todo, ...done]);
    // Cards from two places in the column, one with a lane field changed on the way.
    const write = {
      kind: 'moves' as const,
      moves: groupMoves(
        [todo[1]!.id, todo[2]!.id, todo[4]!.id],
        { status: 'done', after: null },
        (id) => (id === todo[2]!.id ? { set: { priority: 'high' } } : undefined),
      ),
    };
    const r = applyItemWrite(before, write, ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.upserts).toHaveLength(3);
    expect(ids(columnItems(r.state.items, 'done')).slice(0, 3)).toEqual([
      todo[1]!.id,
      todo[2]!.id,
      todo[4]!.id,
    ]);
    const undo = inverseItemWrites(before, write)!;
    expect(undo).toHaveLength(1);
    let back = r.state;
    for (const w of undo) back = ok(applyItemWrite(back, w, ctx));
    expect(ids(columnItems(back.items, 'todo'))).toEqual(ids(todo));
    expect(ids(columnItems(back.items, 'done'))).toEqual(ids(done));
    expect(back.items.find((i) => i.id === todo[2]!.id)!.fields['priority']).toBeUndefined();
  });

  it('refuses a move of a missing card, changing nothing', () => {
    const before = state(column('todo', 2));
    const r = applyItemWrite(before, { kind: 'moves', moves: [{ id: 'nope', move: {} }] }, ctx);
    expect(r).toEqual({ ok: false, error: 'item_not_found' });
  });

  it("clears the status again of a card that had none, and puts a card's type back", () => {
    const loose = item({ title: 'loose' }, { rank: 'a' });
    const typed = item({ title: 'typed', status: 'todo' }, { rank: 'b' });
    const before = state([loose, typed]);
    const write = {
      kind: 'moves' as const,
      moves: [
        { id: loose.id, move: { status: 'done', before: null } },
        { id: typed.id, move: { status: 'done', after: loose.id, type: 'bug' } },
      ],
    };
    const undo = inverseItemWrites(before, write)!;
    expect(undo[1]).toEqual({
      kind: 'patches',
      patches: [{ id: loose.id, patch: { set: { statusSince: 0 }, clear: ['status'] } }],
    });
    let back = ok(applyItemWrite(before, write, ctx));
    for (const w of undo) back = ok(applyItemWrite(back, w, ctx));
    expect(back.items.find((i) => i.id === loose.id)!.fields['status']).toBeUndefined();
    expect(back.items.find((i) => i.id === typed.id)!.type).toBe('task');
  });

  it('has no undo for a move of a card it does not know', () => {
    expect(inverseMoves([], [{ id: 'x', move: {} }])).toBeNull();
    expect(
      inverseItemWrites(state([]), { kind: 'moves', moves: [{ id: 'x', move: {} }] }),
    ).toBeNull();
  });

  it('puts a card moved twice back once', () => {
    const todo = column('todo', 3);
    const inverse = inverseMoves(todo, [
      { id: todo[0]!.id, move: { status: 'done' } },
      { id: todo[0]!.id, move: { status: 'doing', set: { a: 1 }, clear: ['b'] } },
    ])!;
    expect(inverse.moves).toHaveLength(1);
    expect(inverse.moves[0]!.move.before).toBe(todo[1]!.id);
  });
});
