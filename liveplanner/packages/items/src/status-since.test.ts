import { describe, expect, it } from 'vitest';
import { applyMove, applyPatch, inversePatch, makeItem } from './apply';
import { STATUS_SINCE_FIELD, isMoveSettable, type ItemFields } from './item';
import { fieldsWithinBounds, validateFields } from './fields';
import { ITEM_FIELDS_MAX } from './limits';
import { applyItemWrite, inverseItemWrites, type ItemStoreState } from './store';
import {
  CARD_AGE_ALERT_DAYS,
  CARD_AGE_WARN_DAYS,
  cardAgeDays,
  cardAgeLabel,
  cardAgeText,
  cardAgeTone,
  isStatusSince,
  itemStatusSince,
  stampStatusSince,
} from './status-since';
import { SAM, item } from './test-items';

// When a card entered its status, and its Age (docs/specs/026-plan/items.md "Fields", item-types.md "Card display").

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('statusSince on every write', () => {
  const ctx = (now: number) => ({ now, by: SAM });

  it('a create stamps the moment it was made, in a status or none', () => {
    const made = makeItem(
      { type: 'task', fields: { title: 'A' }, place: { status: 'To Do' } },
      { ...ctx(500), id: 'aaaaaaaaaaaa', key: 1, items: [] },
    );
    expect(made.fields[STATUS_SINCE_FIELD]).toBe(500);
    const loose = makeItem(
      { type: 'task', fields: { title: 'A' } },
      { ...ctx(600), id: 'bbbbbbbbbbbb', key: 2, items: [] },
    );
    expect(loose.fields[STATUS_SINCE_FIELD]).toBe(600);
  });

  it('a restore keeps the stamp it carries', () => {
    const made = makeItem(
      { type: 'task', fields: { title: 'A', status: 'Doing', [STATUS_SINCE_FIELD]: 42 } },
      { ...ctx(900), id: 'aaaaaaaaaaaa', key: 1, items: [] },
    );
    expect(made.fields[STATUS_SINCE_FIELD]).toBe(42);
  });

  it('a patch that changes the status stamps now; one that does not keeps the stamp', () => {
    const card = item(
      { title: 'A', status: 'To Do', [STATUS_SINCE_FIELD]: 100 },
      { updatedAt: 150 },
    );
    expect(
      applyPatch(card, { set: { status: 'Doing' } }, ctx(700)).fields[STATUS_SINCE_FIELD],
    ).toBe(700);
    expect(applyPatch(card, { set: { title: 'B' } }, ctx(700)).fields[STATUS_SINCE_FIELD]).toBe(
      100,
    );
    // Setting the same status is no change of column.
    expect(
      applyPatch(card, { set: { status: 'To Do' } }, ctx(700)).fields[STATUS_SINCE_FIELD],
    ).toBe(100);
    expect(applyPatch(card, { clear: ['status'] }, ctx(700)).fields[STATUS_SINCE_FIELD]).toBe(700);
  });

  it('an older card without one keeps its last change on its next write, so an edit never restarts its age', () => {
    const old = item({ title: 'A', status: 'To Do' }, { updatedAt: 150 });
    expect(itemStatusSince(old)).toBe(150);
    const edited = applyPatch(old, { set: { title: 'B' } }, ctx(700));
    expect(edited.fields[STATUS_SINCE_FIELD]).toBe(150);
    expect(itemStatusSince(edited)).toBe(150);
  });

  it('a move to another column stamps now; a move within one keeps it', () => {
    const card = item({ title: 'A', status: 'To Do', [STATUS_SINCE_FIELD]: 100 });
    expect(applyMove(card, { status: 'Done' }, [card], ctx(800)).fields[STATUS_SINCE_FIELD]).toBe(
      800,
    );
    expect(applyMove(card, { after: null }, [card], ctx(800)).fields[STATUS_SINCE_FIELD]).toBe(100);
    // An undo names the old stamp, which the move keeps.
    expect(
      applyMove(card, { status: 'Done', set: { [STATUS_SINCE_FIELD]: 5 } }, [card], ctx(800))
        .fields[STATUS_SINCE_FIELD],
    ).toBe(5);
  });

  it('a written stamp that is not a moment is stamped afresh', () => {
    const card = item({ title: 'A', status: 'To Do' }, { updatedAt: 10 });
    expect(
      stampStatusSince(card, { status: 'Doing', [STATUS_SINCE_FIELD]: 'x' }, true, 99),
    ).toEqual({
      status: 'Doing',
      [STATUS_SINCE_FIELD]: 99,
    });
  });
});

describe('undo puts the stamp back', () => {
  const store = (fields: Record<string, unknown>): ItemStoreState => ({
    items: [item({ title: 'A', ...fields }, { id: 'aaaaaaaaaaaa', updatedAt: 30 })],
    rev: 1,
    nextKey: 2,
  });

  it('a status patch inverts with its old stamp, and a patch that keeps the status adds none', () => {
    const before = item({ title: 'A', status: 'To Do', [STATUS_SINCE_FIELD]: 20 });
    expect(inversePatch(before, { set: { status: 'Doing' } })).toEqual({
      set: { status: 'To Do', [STATUS_SINCE_FIELD]: 20 },
    });
    expect(inversePatch(before, { clear: ['status'] })).toEqual({
      set: { status: 'To Do', [STATUS_SINCE_FIELD]: 20 },
    });
    expect(inversePatch(before, { set: { status: 'To Do' } })).toEqual({
      set: { status: 'To Do' },
    });
    expect(inversePatch(before, { set: { title: 'B' } })).toEqual({ set: { title: 'A' } });
    // A patch naming the stamp itself inverts as any field does.
    expect(inversePatch(before, { set: { status: 'Doing', [STATUS_SINCE_FIELD]: 1 } })).toEqual({
      set: { status: 'To Do', [STATUS_SINCE_FIELD]: 20 },
    });
  });

  it('a move to another column, undone, reads its old age again', () => {
    const state = store({ status: 'To Do', [STATUS_SINCE_FIELD]: 20 });
    const write = { kind: 'move' as const, id: 'aaaaaaaaaaaa', move: { status: 'Doing' } };
    const [undo] = inverseItemWrites(state, write)!;
    const moved = applyItemWrite(state, write, { now: 900, by: SAM });
    if (!moved.ok) throw new Error('move refused');
    expect(moved.upserts[0]!.fields[STATUS_SINCE_FIELD]).toBe(900);
    const back = applyItemWrite(moved.state, undo!, { now: 950, by: SAM });
    if (!back.ok) throw new Error('undo refused');
    expect(back.upserts[0]!.fields).toMatchObject({ status: 'To Do', [STATUS_SINCE_FIELD]: 20 });
  });

  it('a move within its column carries no stamp back', () => {
    const state = store({ status: 'To Do', [STATUS_SINCE_FIELD]: 20 });
    const [undo] = inverseItemWrites(state, {
      kind: 'move',
      id: 'aaaaaaaaaaaa',
      move: { after: null },
    })!;
    expect(undo).toMatchObject({ kind: 'move' });
    expect(undo!.kind === 'move' && undo!.move.set).toBeUndefined();
  });

  it('a card that had no status gets its stamp back from the clearing patch', () => {
    const state = store({});
    const writes = inverseItemWrites(state, {
      kind: 'move',
      id: 'aaaaaaaaaaaa',
      move: { status: 'Doing' },
    })!;
    expect(writes[1]).toEqual({
      kind: 'patch',
      id: 'aaaaaaaaaaaa',
      patch: { set: { [STATUS_SINCE_FIELD]: 30 }, clear: ['status'] },
    });
  });

  it('a move may carry the stamp', () => {
    expect(isMoveSettable(STATUS_SINCE_FIELD)).toBe(true);
  });
});

describe('the stamp as a field', () => {
  it('a patch takes only a moment; a create drops a bad one rather than refusing the card', () => {
    expect(validateFields({ [STATUS_SINCE_FIELD]: 12 }, 'patch')).toEqual({
      ok: true,
      fields: { [STATUS_SINCE_FIELD]: 12 },
    });
    for (const bad of ['12', -1, 1.5, null])
      expect(validateFields({ [STATUS_SINCE_FIELD]: bad }, 'patch')).toMatchObject({
        ok: false,
        error: 'field_value_invalid',
      });
    expect(validateFields({ title: 'A', [STATUS_SINCE_FIELD]: 'x' }, 'create')).toEqual({
      ok: true,
      fields: { title: 'A' },
    });
  });

  it('never counts against the field bounds, so a full card can still be written', () => {
    const full: ItemFields = { title: 'A' };
    for (let i = 1; i < ITEM_FIELDS_MAX; i++) full[`k${i}`] = i;
    expect(validateFields({ ...full, [STATUS_SINCE_FIELD]: 1 }, 'create').ok).toBe(true);
    expect(fieldsWithinBounds({ ...full, [STATUS_SINCE_FIELD]: 1 })).toBeNull();
    expect(fieldsWithinBounds({ ...full, extra: 1 })).toBe('fields_too_many');
  });

  it('reads a stored value only when it is a moment', () => {
    expect(isStatusSince(0)).toBe(true);
    expect(isStatusSince(Number.NaN)).toBe(false);
    expect(itemStatusSince(item({ [STATUS_SINCE_FIELD]: 'x' }, { updatedAt: 7 }))).toBe(7);
  });
});

describe('a card’s Age', () => {
  it('counts whole local days, rolling over at midnight', () => {
    const since = at(2026, 10, 1, 23);
    expect(cardAgeDays(since, new Date(2026, 9, 1, 23, 59))).toBe(0);
    expect(cardAgeDays(since, new Date(2026, 9, 2, 0, 1))).toBe(1);
    expect(cardAgeDays(since, new Date(2026, 9, 5, 9))).toBe(4);
    // A clock behind the stamp's never reads a negative age.
    expect(cardAgeDays(since, new Date(2026, 8, 30))).toBe(0);
  });

  it('counts a day across a clock change as one', () => {
    // Europe and the US change their clocks in late March and early November; either way the count holds.
    expect(cardAgeDays(at(2026, 3, 20), new Date(at(2026, 4, 3)))).toBe(14);
    expect(cardAgeDays(at(2026, 10, 25), new Date(at(2026, 11, 8)))).toBe(14);
  });

  it('is quiet under a week, amber from 7 days and red from 14', () => {
    expect(CARD_AGE_WARN_DAYS).toBe(7);
    expect(CARD_AGE_ALERT_DAYS).toBe(14);
    expect(cardAgeTone(0)).toBe('quiet');
    expect(cardAgeTone(6)).toBe('quiet');
    expect(cardAgeTone(7)).toBe('warn');
    expect(cardAgeTone(13)).toBe('warn');
    expect(cardAgeTone(14)).toBe('alert');
    expect(cardAgeTone(90)).toBe('alert');
  });

  it('reads "4d", and is spoken with its column', () => {
    expect(cardAgeText(4)).toBe('4d');
    expect(cardAgeLabel(1, 'Doing')).toBe('In Doing for 1 day');
    expect(cardAgeLabel(4, 'Doing')).toBe('In Doing for 4 days');
  });
});
