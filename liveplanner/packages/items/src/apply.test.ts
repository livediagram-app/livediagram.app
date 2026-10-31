import { describe, expect, it } from 'vitest';
import {
  applyMove,
  applyPatch,
  applyTally,
  columnItems,
  inversePatch,
  itemPlacer,
  makeItem,
  newItemId,
  placeOf,
  rankForPlace,
} from './apply';
import { ITEM_VOTES_PER_PERSON_MAX } from './limits';
import { ALI, SAM, item } from './test-items';

const ctx = { now: 10, by: ALI };

describe('item writes', () => {
  it('makes an item at the end of its column, or after a neighbour', () => {
    const a = item({ title: 'a', status: 'todo' }, { rank: 'i' });
    const b = item({ title: 'b', status: 'todo' }, { rank: 'r' });
    const made = makeItem(
      { type: 'bug', fields: { title: 'c' }, place: { status: 'todo' } },
      { ...ctx, id: 'newid1', key: 9, items: [a, b] },
    );
    expect(made).toMatchObject({
      id: 'newid1',
      key: 9,
      type: 'bug',
      rev: 1,
      fields: { title: 'c', status: 'todo' },
      createdBy: ALI,
    });
    expect(made.rank > 'r').toBe(true);
    const mid = makeItem(
      { type: 'task', fields: { title: 'm' }, place: { status: 'todo', after: a.id } },
      { ...ctx, id: 'newid2', key: 10, items: [a, b] },
    );
    expect(mid.rank > 'i' && mid.rank < 'r').toBe(true);
    const top = makeItem(
      { type: 'task', fields: { title: 't', status: 'todo' }, place: { after: null } },
      { ...ctx, id: 'newid3', key: 11, items: [a, b] },
    );
    expect(top.rank < 'i').toBe(true);
  });

  it('places before a neighbour, and at the end when a neighbour is gone', () => {
    const a = item({ title: 'a', status: 's' }, { rank: 'i' });
    const b = item({ title: 'b', status: 's' }, { rank: 'r' });
    expect(rankForPlace([a, b], { status: 's', before: b.id }) < 'r').toBe(true);
    expect(rankForPlace([a, b], { status: 's', before: 'missing' }) > 'r').toBe(true);
    expect(rankForPlace([a, b], { status: 's', after: 'missing' }) > 'r').toBe(true);
    expect(rankForPlace([a, b], { status: 's', before: null }) > 'r').toBe(true);
    // Equal neighbours from a concurrent insert: goes after the pair.
    const c = item({ title: 'c', status: 'q' }, { rank: 'i' });
    const d = item({ title: 'd', status: 'q' }, { rank: 'i' });
    expect(rankForPlace([c, d], { status: 'q', after: c.id }) > 'i').toBe(true);
    // ...and before the cards past the pair, never at the column's end.
    const e = item({ title: 'e', status: 'q' }, { rank: 's' });
    const f = item({ title: 'f', status: 'q' }, { rank: 'u' });
    const r = rankForPlace([c, d, e, f], { status: 'q', after: c.id });
    expect(r > 'i' && r < 's').toBe(true);
  });

  it('patches and inverts a patch', () => {
    const it0 = item({ title: 'a', due: '2026-01-01' });
    const patch = { set: { title: 'b', priority: 'high' }, clear: ['due'], type: 'bug' };
    const after = applyPatch(it0, patch, ctx);
    expect(after).toMatchObject({
      type: 'bug',
      rev: 2,
      updatedBy: ALI,
      fields: { title: 'b', priority: 'high' },
    });
    expect(after.fields['due']).toBeUndefined();
    const inv = inversePatch(it0, patch);
    expect(inv).toEqual({
      set: { title: 'a', due: '2026-01-01' },
      clear: ['priority'],
      type: 'task',
    });
    // Its status never changed, so the card keeps its last change as the moment it entered it (status-since.ts).
    expect(applyPatch(after, inv, ctx).fields).toEqual({ ...it0.fields, statusSince: 0 });
    expect(inversePatch(it0, {})).toEqual({});
  });

  it('moves between columns and sets a lane field', () => {
    const a = item({ title: 'a', status: 'todo' }, { rank: 'i' });
    const b = item({ title: 'b', status: 'done' }, { rank: 'i' });
    const moved = applyMove(
      a,
      { status: 'done', before: b.id, set: { assignee: SAM } },
      [a, b],
      ctx,
    );
    expect(moved.fields).toMatchObject({ status: 'done', assignee: SAM });
    expect(moved.rank < 'i').toBe(true);
    expect(columnItems([a, b], 'todo')).toEqual([a]);
    expect(placeOf(a, [a, b])).toEqual({ status: 'todo', before: null });
    const c = item({ title: 'c', status: 'todo' }, { rank: 'r' });
    expect(placeOf(a, [a, c])).toEqual({ status: 'todo', before: c.id });
    const cleared = applyMove(moved, { clear: ['assignee'], type: 'bug' }, [moved, b], ctx);
    expect(cleared.fields['assignee']).toBeUndefined();
    expect(cleared.type).toBe('bug');
    // Status kept when the move only reorders.
    expect(applyMove(a, { after: null }, [a, c], ctx).fields['status']).toBe('todo');
  });

  // docs/specs/026-plan/items.md "Tally" and item-types.md "Comments and Votes fields".
  it('adds a tally to the built-in Votes, or to the Votes field named', () => {
    const a = item({ votes: { p: 1 }, 'f-pri': { p: 98 } });
    const built = applyTally(a, { p: 2, q: 1, r: 0 }, ctx);
    expect(built.fields['votes']).toEqual({ p: 3, q: 1 });
    expect(built.rev).toBe(a.rev + 1);
    const own = applyTally(a, { p: 5 }, ctx, 'f-pri');
    expect(own.fields['f-pri']).toEqual({ p: ITEM_VOTES_PER_PERSON_MAX });
    expect(own.fields['votes']).toEqual({ p: 1 });
  });

  it('makes 12-character ids', () => {
    expect(newItemId()).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(newItemId(() => 0)).toBe('aaaaaaaaaaaa');
  });
});

describe('itemPlacer', () => {
  it('slots an item placed mid-column by its rank, so the next create sees the right neighbours', () => {
    const a = item({ title: 'a', status: 'todo' }, { id: 'a', rank: 'b' });
    const c = item({ title: 'c', status: 'todo' }, { id: 'c', rank: 'd' });
    const placer = itemPlacer([a, c]);
    placer.add(item({ title: 'b', status: 'todo' }, { id: 'b', rank: 'c' }));

    // After the added card, before c: the added card is a neighbour now, not skipped.
    const afterB = placer.rankFor({ status: 'todo', after: 'b' });
    expect(afterB > 'c' && afterB < 'd').toBe(true);
    // After a, the next card is the added one, so the rank lands between them.
    const afterA = placer.rankFor({ status: 'todo', after: 'a' });
    expect(afterA > 'b' && afterA < 'c').toBe(true);
  });
});
