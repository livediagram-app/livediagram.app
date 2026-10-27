import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from './board';
import { boardCsvImport, boardCsvMessage } from './board-csv';
import type { ItemTypeDef } from './item-types';
import {
  canBeRequired,
  isEmptyFieldValue,
  missingRequiredFields,
  requiredCleared,
  requiredCustomFieldsOf,
  requiredFieldEmptied,
  requiredFieldsMessage,
} from './required-fields';
import { item } from './test-items';
import { ITEM_TYPE_CATALOGUE_VERSION, validateItemTypeCatalogue } from './type-catalogue';
import { applyCardTypeChanges } from './type-changes';
import { createRefusal, requiredClearedBy, writtenItemsRefusal } from './write-checks';

// Required custom fields (docs/specs/026-plan/item-types.md "Required fields").

const bug: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'f-sev', 'f-area', 'f-tags', 'f-done'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['S1', 'S2'], required: true },
    { id: 'f-area', label: 'Area', kind: 'text', required: true },
    { id: 'f-tags', label: 'Tags', kind: 'multichoice', options: ['a', 'b'], required: true },
    // A checkbox is never enforced, even stored as required; nor a field the type no longer offers.
    { id: 'f-done', label: 'Done', kind: 'checkbox', required: true },
    { id: 'f-gone', label: 'Gone', kind: 'text', required: true },
  ],
};
const types = [bug];

describe('which fields a type requires', () => {
  it('is every required custom field the type offers, but a checkbox', () => {
    expect(canBeRequired('checkbox')).toBe(false);
    expect(canBeRequired('card')).toBe(true);
    expect(requiredCustomFieldsOf(bug).map((f) => f.id)).toEqual(['f-sev', 'f-area', 'f-tags']);
    expect(requiredCustomFieldsOf({ fields: ['title'] })).toEqual([]);
  });

  it('reads empty as no value: absent, null, blank text or an empty list', () => {
    for (const v of [undefined, null, '', '  ', []]) expect(isEmptyFieldValue(v)).toBe(true);
    for (const v of ['x', 0, false, ['a']]) expect(isEmptyFieldValue(v)).toBe(false);
  });

  it('names what a card lacks, in the type’s order', () => {
    expect(
      missingRequiredFields(bug, { title: 'A', 'f-area': ' ', 'f-tags': [] }).map((f) => f.id),
    ).toEqual(['f-sev', 'f-area', 'f-tags']);
    expect(
      missingRequiredFields(bug, { title: 'A', 'f-sev': 'S1', 'f-area': 'UI', 'f-tags': ['a'] }),
    ).toEqual([]);
    expect(requiredFieldsMessage(bug, [{ label: 'Severity' }])).toBe('Bug cards need Severity');
    expect(requiredFieldsMessage(bug, [{ label: 'A' }, { label: 'B' }])).toBe(
      'Bug cards need A and B',
    );
    expect(requiredFieldsMessage(bug, [{ label: 'A' }, { label: 'B' }, { label: 'C' }])).toBe(
      'Bug cards need A, B and C',
    );
    expect(requiredFieldsMessage(bug, [])).toBe('Bug cards need ');
  });

  it('refuses emptying a value, never a field that was already empty', () => {
    const had = { 'f-sev': 'S1', 'f-area': 'UI' };
    expect(requiredCleared(bug, had, { 'f-sev': 'S1' })?.id).toBe('f-area');
    expect(requiredCleared(bug, had, { 'f-sev': 'S2', 'f-area': 'API' })).toBeUndefined();
    expect(requiredCleared(bug, {}, {})).toBeUndefined();
    expect(requiredFieldEmptied(bug, had, 'f-area', undefined)?.label).toBe('Area');
    expect(requiredFieldEmptied(bug, had, 'f-area', 'x')).toBeUndefined();
    expect(requiredFieldEmptied(bug, {}, 'f-area', '')).toBeUndefined();
    expect(requiredFieldEmptied(bug, { title: 'x' }, 'title', '')).toBeUndefined();
  });
});

describe('the write checks', () => {
  const filled = { title: 'A', 'f-sev': 'S1', 'f-area': 'UI', 'f-tags': ['a'] };

  it('refuses a new card missing one, but lets a restore through', () => {
    expect(createRefusal(types, { type: 'bug', fields: { title: 'A' } })).toEqual({
      error: 'field_required',
      field: 'f-sev',
    });
    expect(createRefusal(types, { type: 'bug', fields: filled })).toBeNull();
    expect(createRefusal(types, { type: 'bug', fields: { title: 'A' }, key: 4 })).toBeNull();
    expect(createRefusal(types, { type: 'bug', fields: { title: 'A' }, votes: {} })).toBeNull();
    expect(createRefusal(types, { type: 'bug', fields: { title: 'A' }, comments: [] })).toBeNull();
    // A type the catalogue lacks requires nothing.
    expect(createRefusal(types, { type: 'other', fields: { title: 'A' } })).toBeNull();
    expect(
      writtenItemsRefusal(
        { kind: 'create', creates: [{ id: 'item-one', type: 'bug', fields: { title: 'A' } }] },
        [],
        [],
        types,
      ),
    ).toEqual({ error: 'field_required', field: 'f-sev', id: 'item-one' });
    expect(
      writtenItemsRefusal(
        { kind: 'create', creates: [{ type: 'bug', fields: { title: 'A' } }] },
        [],
        [],
        types,
      ),
    ).toEqual({ error: 'field_required', field: 'f-sev' });
    expect(
      writtenItemsRefusal(
        { kind: 'create', creates: [{ type: 'bug', fields: filled }] },
        [],
        [],
        types,
      ),
    ).toBeNull();
  });

  it('refuses a change emptying one, but not an undo', () => {
    const was = item(filled, { type: 'bug' });
    const next = { ...was, fields: { ...filled, 'f-area': '' } };
    expect(requiredClearedBy(types, next, was, false)).toBe('f-area');
    expect(requiredClearedBy(types, next, was, true)).toBeNull();
    expect(requiredClearedBy(types, was, was, false)).toBeNull();
    const patch = { kind: 'patch' as const, id: was.id, patch: { clear: ['f-area'] } };
    expect(writtenItemsRefusal(patch, [was], [next], types)).toEqual({
      error: 'field_required',
      id: was.id,
      field: 'f-area',
    });
    expect(writtenItemsRefusal({ ...patch, undo: true }, [was], [next], types)).toBeNull();
  });
});

describe('the catalogue', () => {
  const stored = (custom: unknown[]) =>
    validateItemTypeCatalogue({
      version: ITEM_TYPE_CATALOGUE_VERSION,
      types: [{ ...bug, custom, fields: ['title', 'status', 'f-a'] }],
    });

  it('keeps required only as true, and never on a checkbox', () => {
    const read = (field: Record<string, unknown>) => {
      const r = stored([{ id: 'f-a', label: 'A', ...field }]);
      if (!r.ok) throw new Error(r.reason);
      return r.catalogue.types[0]!.custom![0]!;
    };
    expect(read({ kind: 'text', required: true }).required).toBe(true);
    expect(read({ kind: 'text', required: 'yes' }).required).toBeUndefined();
    expect(read({ kind: 'text', required: false })).not.toHaveProperty('required');
    expect(read({ kind: 'checkbox', required: true })).not.toHaveProperty('required');
  });

  it('is set and unset by name through change_card_types, a checkbox refused', () => {
    const made = applyCardTypeChanges(
      null,
      [
        {
          op: 'add',
          name: 'Bug',
          custom: [
            { name: 'Severity', kind: 'text', required: true },
            { name: 'Area', kind: 'text' },
          ],
        },
        { op: 'set', type: 'Bug', editCustom: [{ field: 'Area', required: true }] },
      ],
      [],
    );
    if (!made.ok) throw new Error(made.message);
    const custom = made.catalogue!.types[0]!.custom!;
    expect(custom.map((f) => f.required)).toEqual([true, true]);
    const unset = applyCardTypeChanges(
      made.catalogue,
      [
        {
          op: 'set',
          type: 'Bug',
          editCustom: [{ field: 'Area', required: false }],
          addCustom: [{ name: 'Owner', kind: 'card', linkType: 'Bug', required: true }],
        },
      ],
      [],
    );
    if (!unset.ok) throw new Error(unset.message);
    expect(unset.catalogue!.types[0]!.custom!.map((f) => [f.label, f.required])).toEqual([
      ['Severity', true],
      ['Area', undefined],
      ['Owner', true],
    ]);
    const box = applyCardTypeChanges(
      null,
      [{ op: 'add', name: 'Bug', custom: [{ name: 'Ok', kind: 'checkbox', required: true }] }],
      [],
    );
    expect(box).toMatchObject({
      ok: false,
      message: '"Ok" is a checkbox: a checkbox can\'t be required.',
    });
    // Nor a Calculated field, which nobody fills in (item-types.md "Calculated fields").
    const calc = applyCardTypeChanges(
      null,
      [
        {
          op: 'add',
          name: 'Epic',
          custom: [{ name: 'Kids', kind: 'calculated', calculation: 'childCount', required: true }],
        },
      ],
      [],
    );
    expect(calc).toMatchObject({
      ok: false,
      message: '"Kids" is calculated: the plan works it out, so it can\'t be required.',
    });
    expect(canBeRequired('calculated')).toBe(false);
    const boxEdit = applyCardTypeChanges(
      null,
      [
        { op: 'add', name: 'Bug', custom: [{ name: 'Ok', kind: 'checkbox' }] },
        { op: 'set', type: 'Bug', editCustom: [{ field: 'Ok', required: true }] },
      ],
      [],
    );
    expect(boxEdit.ok).toBe(false);
  });
});

describe('Import CSV', () => {
  const setup: PlanBoardSetup = {
    title: 'Bugs',
    columns: [{ id: 'c1', status: 'todo', name: 'To Do' }],
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    addTypes: ['bug'],
  };

  it('skips a row missing a required field, and says so', () => {
    const result = boardCsvImport(
      [
        ['Title', 'Severity', 'Area', 'Tags'],
        ['Crash', 'S1', 'UI', 'a'],
        ['Slow', '', 'API', 'b'],
        [' ', '', '', ''],
        ['', 'S2', '', ''],
      ],
      { setup, types, people: [], room: 100 },
    );
    expect(result.creates.map((c) => c.fields['title'])).toEqual(['Crash']);
    expect(result).toMatchObject({ skipped: 2, missingRequired: 1 });
    expect(boardCsvMessage({ ...result, added: 1 })).toBe(
      'Added 1 card; skipped 2 rows, 1 missing a required field',
    );
    expect(boardCsvMessage({ added: 0, skipped: 2, missingRequired: 2 })).toBe(
      'No cards added; skipped 2 rows missing a required field',
    );
  });
});
