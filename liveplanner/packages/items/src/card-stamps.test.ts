import { describe, expect, it } from 'vitest';
import {
  STAMP_FIELDS,
  isStampField,
  itemHasStamp,
  itemStampPerson,
  itemStampTime,
  stampDay,
  stampMomentLabel,
} from './card-stamps';
import { isItemEdit } from './item-edit';
import { applyMove, applyPatch, applyTally, makeItem } from './apply';
import { validateFields } from './fields';
import {
  LINKED_AT_FIELD,
  LINKED_FIELD,
  LINKED_GONE_FIELD,
  LINKED_REV_FIELD,
} from './linked-fields';
import { STATUS_SINCE_FIELD } from './item';
import { ALI, SAM, item } from './test-items';

// docs/specs/026-plan/items.md "Created and Last Edited".
const MADE = new Date(2026, 9, 3, 14, 2).getTime();
const LATER = new Date(2026, 9, 31, 9, 30).getTime();
const NOW = new Date(2026, 10, 2, 8, 0).getTime();
const stamped = (fields = {}) =>
  item(fields, { createdAt: MADE, updatedAt: LATER, createdBy: SAM, updatedBy: SAM });
const ctx = { now: NOW, by: ALI };

describe('reading the stamps', () => {
  it('names the four stamps', () => {
    expect(STAMP_FIELDS).toEqual(['createdAt', 'createdBy', 'updatedAt', 'updatedBy']);
    expect(isStampField('updatedBy')).toBe(true);
    expect(isStampField('due')).toBe(false);
    expect(isStampField(7)).toBe(false);
  });

  it('reads a moment, and nothing for a card stored without one', () => {
    const card = stamped();
    expect(itemStampTime(card, 'createdAt')).toBe(MADE);
    expect(itemStampTime(card, 'updatedAt')).toBe(LATER);
    expect(itemStampTime(item({}), 'createdAt')).toBeUndefined();
    expect(itemStampTime({ createdAt: Number.NaN }, 'createdAt')).toBeUndefined();
    expect(itemStampTime({}, 'updatedAt')).toBeUndefined();
  });

  it('reads a person, and nothing for one the api could not read (an empty id) or none', () => {
    expect(itemStampPerson(stamped(), 'createdBy')).toEqual(SAM);
    const lost = { id: '', name: 'Someone', color: '#94a3b8' };
    expect(itemStampPerson({ createdBy: lost }, 'createdBy')).toBeUndefined();
    expect(itemStampPerson({ updatedBy: { ...SAM, name: '' } }, 'updatedBy')).toBeUndefined();
    expect(itemStampPerson({}, 'updatedBy')).toBeUndefined();
  });

  it('says whether a card holds each stamp', () => {
    const card = stamped();
    for (const f of STAMP_FIELDS) expect(itemHasStamp(card, f)).toBe(true);
    expect(itemHasStamp({ createdBy: { id: '', name: 'x', color: '#000000' } }, 'createdBy')).toBe(
      false,
    );
    expect(itemHasStamp({ createdAt: 0 }, 'createdAt')).toBe(false);
  });

  it('gives the local day and the full moment', () => {
    expect(stampDay(MADE)).toBe('2026-10-03');
    expect(stampDay(new Date(2026, 0, 9, 23, 59).getTime())).toBe('2026-01-09');
    const label = stampMomentLabel(MADE);
    expect(label).toContain('2026');
    expect(label).toMatch(/14|2/);
  });
});

describe('which writes are an edit', () => {
  it('stamps Last Edited on a create and a field change, never Created', () => {
    const made = makeItem(
      { type: 'task', fields: { title: 'New' } },
      { ...ctx, id: 'a', key: 1, items: [] },
    );
    expect(made).toMatchObject({ createdAt: NOW, updatedAt: NOW, createdBy: ALI, updatedBy: ALI });
    const next = applyPatch(stamped({ title: 'A' }), { set: { title: 'B' } }, ctx);
    expect(next).toMatchObject({ createdAt: MADE, createdBy: SAM, updatedAt: NOW, updatedBy: ALI });
  });

  it('stamps a cleared field and a changed type', () => {
    expect(
      applyPatch(stamped({ title: 'A', due: '2026-11-01' }), { clear: ['due'] }, ctx).updatedBy,
    ).toEqual(ALI);
    expect(applyPatch(stamped({ title: 'A' }), { type: 'bug' }, ctx).updatedAt).toBe(NOW);
  });

  it('leaves Last Edited alone for a value set to what it was', () => {
    const next = applyPatch(stamped({ title: 'A' }), { set: { title: 'A' } }, ctx);
    expect(next).toMatchObject({ updatedAt: LATER, updatedBy: SAM, rev: 2 });
  });

  it('weighs a list or a person by its value, and a missing or null one as a change', () => {
    const before = stamped({ title: 'A', assignee: { ...SAM }, labels: ['x'], note: null });
    const same = { ...before.fields, assignee: { ...SAM }, labels: ['x'] };
    expect(isItemEdit(before, same, 'task', ['assignee', 'labels'])).toBe(false);
    expect(
      isItemEdit(before, { ...before.fields, assignee: { ...ALI } }, 'task', ['assignee']),
    ).toBe(true);
    expect(isItemEdit(before, { ...before.fields, note: { a: 1 } }, 'task', ['note'])).toBe(true);
    expect(isItemEdit(before, { ...before.fields, labels: null }, 'task', ['labels'])).toBe(true);
    expect(isItemEdit(before, { ...before.fields, due: '2026-11-01' }, 'task', ['due'])).toBe(true);
  });

  it('leaves Last Edited alone for the linked board keeping a card with its record', () => {
    for (const k of [LINKED_FIELD, LINKED_AT_FIELD, LINKED_REV_FIELD, LINKED_GONE_FIELD]) {
      const heal = applyPatch(
        stamped({ title: 'A', status: 'todo', [k]: 1 }),
        { set: { title: 'Renamed on the canvas', [LINKED_REV_FIELD]: 2 }, clear: [k] },
        ctx,
      );
      expect(heal).toMatchObject({ updatedAt: LATER, updatedBy: SAM });
      expect(heal.fields['title']).toBe('Renamed on the canvas');
    }
  });

  it('leaves Last Edited alone for a tally, its rev still rising', () => {
    const next = applyTally(stamped({ title: 'A' }), { v1: 2 }, ctx);
    expect(next).toMatchObject({ updatedAt: LATER, updatedBy: SAM, rev: 2 });
    expect(next.fields['votes']).toEqual({ v1: 2 });
  });

  it('counts a move to another column, never a move within its own', () => {
    const a = stamped({ title: 'A', status: 'todo' });
    const b = stamped({ title: 'B', status: 'todo' });
    const items = [a, b];
    const within = applyMove(a, { status: 'todo', after: b.id }, items, ctx);
    expect(within).toMatchObject({ updatedAt: LATER, updatedBy: SAM });
    const across = applyMove(a, { status: 'done' }, items, ctx);
    expect(across).toMatchObject({ updatedAt: NOW, updatedBy: ALI });
    // A lane drop that sets a field is an edit even within the column.
    const lane = applyMove(a, { status: 'todo', set: { priority: 'high' } }, items, ctx);
    expect(lane.updatedBy).toEqual(ALI);
  });

  it('does not count the status stamp on its own', () => {
    const before = stamped({ title: 'A', status: 'todo', [STATUS_SINCE_FIELD]: MADE });
    expect(
      isItemEdit(before, { ...before.fields, [STATUS_SINCE_FIELD]: NOW }, 'task', [
        STATUS_SINCE_FIELD,
      ]),
    ).toBe(false);
    expect(isItemEdit(before, { ...before.fields, status: 'done' }, 'task', [])).toBe(true);
  });
});

describe('clients never write them', () => {
  it('refuses a stamp named as a field, on a create and a patch', () => {
    for (const k of STAMP_FIELDS) {
      expect(validateFields({ title: 'A', [k]: 1 }, 'create')).toEqual({
        ok: false,
        error: 'field_key_invalid',
        field: k,
      });
      expect(validateFields({ [k]: SAM }, 'patch')).toMatchObject({ ok: false, field: k });
    }
  });
});
