import { describe, expect, it } from 'vitest';
import { quickFilterMatches } from './board';
import type { ItemTypeDef } from './item-types';
import { isNotified, notifiedPeople, notifyingFieldsOf } from './notify-fields';
import { item } from './test-items';
import { FALLBACK_ITEM_TYPE } from './item-types';
import { applyCardTypeChanges } from './type-changes';

// Notifying Person fields (docs/specs/026-plan/item-types.md "Notifies").

const SAM = { id: 'p-sam', name: 'Sam', color: '#2563eb' };
const ALEX = { id: 'p-alex', name: 'Alex', color: '#16a34a' };
const NAMED = { id: 'n-jo', name: 'Jo', color: '#9333ea' };

const review: ItemTypeDef = {
  id: 'review',
  label: 'Review',
  newTitle: 'New review',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'f-reviewer', 'assignee', 'f-owner', 'f-qa'],
  custom: [
    { id: 'f-reviewer', label: 'Reviewer', kind: 'person', notifies: true },
    { id: 'f-owner', label: 'Owner', kind: 'person' },
    { id: 'f-qa', label: 'QA', kind: 'person', notifies: true },
    // Not offered by the type any more: never notifies.
    { id: 'f-gone', label: 'Gone', kind: 'person', notifies: true },
    // Not a Person field: a stray flag reads as nothing.
    { id: 'f-note', label: 'Note', kind: 'text', notifies: true },
  ],
};

describe('notifyingFieldsOf', () => {
  it('takes the Assignee and the switched-on Person fields the type offers, in its field order', () => {
    expect(notifyingFieldsOf(review)).toEqual(['f-reviewer', 'assignee', 'f-qa']);
    expect(notifyingFieldsOf({ ...review, fields: [...review.fields, 'f-note'] })).toEqual([
      'f-reviewer',
      'assignee',
      'f-qa',
    ]);
  });

  it('leaves the Assignee out when the type switched it off', () => {
    expect(notifyingFieldsOf({ ...review, assigneeNotifies: false })).toEqual([
      'f-reviewer',
      'f-qa',
    ]);
  });

  it('reads a type with no custom fields as its Assignee alone', () => {
    expect(notifyingFieldsOf(FALLBACK_ITEM_TYPE)).toEqual(['assignee']);
    expect(notifyingFieldsOf({ fields: ['title'] })).toEqual([]);
  });
});

describe('notifiedPeople', () => {
  it('tells each person once, by the first field in the type order that names them', () => {
    const card = item({ assignee: SAM, 'f-reviewer': ALEX, 'f-qa': SAM, 'f-owner': ALEX });
    expect(notifiedPeople(review, card)).toEqual([
      { fieldId: 'f-reviewer', person: ALEX },
      { fieldId: 'assignee', person: SAM },
    ]);
  });

  it('skips empty fields, values that are no person and custom people', () => {
    const card = item({ assignee: NAMED, 'f-reviewer': 'Alex', 'f-qa': SAM, 'f-gone': ALEX });
    expect(notifiedPeople(review, card)).toEqual([{ fieldId: 'f-qa', person: SAM }]);
    expect(notifiedPeople(review, item({}))).toEqual([]);
  });
});

describe('isNotified', () => {
  it('is true for a person a notifying field holds', () => {
    const card = item({ assignee: SAM, 'f-owner': ALEX });
    expect(isNotified(review, card, SAM.id)).toBe(true);
    expect(isNotified(review, card, ALEX.id)).toBe(false);
    expect(isNotified({ ...review, assigneeNotifies: false }, card, SAM.id)).toBe(false);
  });
});

describe('Only Mine', () => {
  it('matches a card any notifying field of its type gives the viewer', () => {
    const card = { ...item({ 'f-qa': SAM, assignee: ALEX }), type: 'review' };
    expect(quickFilterMatches({ mine: SAM.id }, card, [review])).toBe(true);
    expect(quickFilterMatches({ mine: ALEX.id }, card, [review])).toBe(true);
    expect(
      quickFilterMatches({ mine: ALEX.id }, card, [{ ...review, assigneeNotifies: false }]),
    ).toBe(false);
  });

  it('reads the Assignee alone without a catalogue, as before', () => {
    const card = { ...item({ 'f-qa': SAM, assignee: ALEX }), type: 'review' };
    expect(quickFilterMatches({ mine: ALEX.id }, card)).toBe(true);
    expect(quickFilterMatches({ mine: SAM.id }, card)).toBe(false);
  });

  it('never matches a custom person', () => {
    expect(quickFilterMatches({ mine: NAMED.id }, item({ assignee: NAMED }))).toBe(false);
  });
});

describe('agents set Notifies (applyCardTypeChanges)', () => {
  const statuses = [{ status: 'todo~a1', name: 'To Do' }];
  const change = (changes: Parameters<typeof applyCardTypeChanges>[1]) => {
    const r = applyCardTypeChanges(null, changes, statuses);
    if (!r.ok) throw new Error(r.message);
    return r.catalogue!.types[0]!;
  };
  const added = {
    op: 'add' as const,
    name: 'Review',
    custom: [
      { name: 'Reviewer', kind: 'person', notifies: true },
      { name: 'Owner', kind: 'person' },
    ],
  };

  it('adds a notifying Person field and switches the Assignee off', () => {
    const type = change([{ ...added, assigneeNotifies: false }]);
    expect(type.assigneeNotifies).toBe(false);
    expect(type.custom).toEqual([
      { id: 'f-reviewer', label: 'Reviewer', kind: 'person', notifies: true },
      { id: 'f-owner', label: 'Owner', kind: 'person' },
    ]);
    expect(notifyingFieldsOf(type)).toEqual(['f-reviewer']);
  });

  it('switches a field and the Assignee on and off in place, storing only what differs', () => {
    const type = change([
      { ...added, assigneeNotifies: true },
      {
        op: 'set',
        type: 'Review',
        assigneeNotifies: false,
        editCustom: [
          { field: 'Reviewer', notifies: false },
          { field: 'Owner', notifies: true },
        ],
      },
      { op: 'set', type: 'Review', assigneeNotifies: true },
      { op: 'set', type: 'Review', name: 'Reviewed' },
    ]);
    expect(type).not.toHaveProperty('assigneeNotifies');
    expect(type.custom).toEqual([
      { id: 'f-reviewer', label: 'Reviewer', kind: 'person' },
      { id: 'f-owner', label: 'Owner', kind: 'person', notifies: true },
    ]);
  });

  it('refuses Notifies on a field that is no Person field', () => {
    const r = applyCardTypeChanges(
      null,
      [{ op: 'add', name: 'Note', custom: [{ name: 'Area', kind: 'text', notifies: true }] }],
      statuses,
    );
    expect(r).toMatchObject({
      ok: false,
      message: '"Area" is a text field: only a person field notifies.',
    });
    const edit = applyCardTypeChanges(
      null,
      [
        { op: 'add', name: 'Note', custom: [{ name: 'Area', kind: 'text' }] },
        { op: 'set', type: 'Note', editCustom: [{ field: 'Area', notifies: true }] },
      ],
      statuses,
    );
    expect(edit).toMatchObject({ ok: false });
  });
});
