import { describe, expect, it } from 'vitest';
import {
  IMAGE_FIELD_PICTURES_MAX,
  fieldImageIds,
  holdsSeveralImages,
  imageFieldValue,
  movedImage,
  storedImageIds,
  withImagesAdded,
  withoutImages,
} from './image-values';
import { boardCsvImport, boardCsvRows } from './board-csv';
import { customFieldText } from './card-text';
import {
  changedValue,
  changesValues,
  fieldKindChange,
  kindChangeRefusal,
} from './field-kind-change';
import { validateFields } from './fields';
import { FIELD_VALUES_MAX } from './limits';
import type { ItemTypeDef } from './item-types';
import { presetSetup } from './presets';
import type { PlanBoardSetup } from './board';
import { canBeRequired } from './required-fields';
import { holdsSeveral } from './several-values';
import { item } from './test-items';
import { readItemTypeCatalogue } from './type-catalogue';

// docs/specs/026-plan/item-types.md "Image fields": an Image field holds one picture's id, a Several Images field a list
// of them; each reads the other's stored value, so nothing is migrated.

const one = { id: 'f-cover', label: 'Cover', kind: 'image' as const };
const several = { id: 'f-designs', label: 'Designs', kind: 'image' as const, multiple: true };
const ids = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `img-${i + from}`);

const shots: ItemTypeDef = {
  id: 'shots',
  label: 'Shots',
  newTitle: 'New shot',
  glyph: 'page',
  color: '#2563eb',
  fields: ['title', 'status', 'f-cover', 'f-designs', 'f-note'],
  custom: [one, several, { id: 'f-note', label: 'Note', kind: 'text' }],
};

describe('a Several Images field', () => {
  it('is an Image field switched to hold several, and never a Holds Several person or card field', () => {
    expect(holdsSeveralImages(several)).toBe(true);
    expect(holdsSeveralImages(one)).toBe(false);
    expect(holdsSeveralImages({ kind: 'person', multiple: true })).toBe(false);
    expect(holdsSeveralImages(undefined)).toBe(false);
    expect(holdsSeveral(several)).toBe(false);
  });

  it('keeps the switch only as true on an Image field, as stored', () => {
    const read = readItemTypeCatalogue({
      version: 1,
      types: [
        {
          ...shots,
          custom: [
            several,
            { ...one, multiple: 'yes' },
            { id: 'f-note', label: 'Note', kind: 'text', multiple: true },
          ],
        },
      ],
    });
    const custom = read!.types[0]!.custom!;
    expect(custom.find((f) => f.id === 'f-designs')?.multiple).toBe(true);
    expect(custom.find((f) => f.id === 'f-cover')).not.toHaveProperty('multiple');
    expect(custom.find((f) => f.id === 'f-note')).not.toHaveProperty('multiple');
  });
});

describe('reading the pictures', () => {
  it('reads one id as a list of one, a list as its ids each once, and anything else as none', () => {
    expect(storedImageIds('a')).toEqual(['a']);
    expect(storedImageIds(['a', 'b', 'a', '', 3, null, 'c'])).toEqual(['a', 'b', 'c']);
    expect(storedImageIds('')).toEqual([]);
    expect(storedImageIds(undefined)).toEqual([]);
    expect(storedImageIds({ id: 'a' })).toEqual([]);
    expect(storedImageIds(ids(IMAGE_FIELD_PICTURES_MAX + 5))).toHaveLength(
      IMAGE_FIELD_PICTURES_MAX,
    );
  });

  it('shows every picture on Several Images and the first on an Image field, whichever way it was stored', () => {
    expect(fieldImageIds(several, ['a', 'b'])).toEqual(['a', 'b']);
    // Turned into Several Images: the picture an Image field held is kept.
    expect(fieldImageIds(several, 'a')).toEqual(['a']);
    // Turned back: the first picture.
    expect(fieldImageIds(one, ['a', 'b'])).toEqual(['a']);
    expect(fieldImageIds(one, 'a')).toEqual(['a']);
    expect(fieldImageIds(one, undefined)).toEqual([]);
  });
});

describe('storing the pictures', () => {
  it('stores a list on Several Images, the first on an Image field, and clears for none', () => {
    expect(imageFieldValue(several, ['a', 'b', 'a'])).toEqual(['a', 'b']);
    expect(imageFieldValue(one, ['a', 'b'])).toBe('a');
    expect(imageFieldValue(several, [])).toBeUndefined();
    expect(imageFieldValue(one, [''])).toBeUndefined();
    expect(imageFieldValue(several, ids(30))).toHaveLength(IMAGE_FIELD_PICTURES_MAX);
  });

  it('is a value every door takes as it is', () => {
    expect(IMAGE_FIELD_PICTURES_MAX).toBe(FIELD_VALUES_MAX);
    const fields = { 'f-designs': ids(IMAGE_FIELD_PICTURES_MAX), 'f-cover': 'img-a' };
    expect(validateFields(fields, 'patch')).toEqual({ ok: true, fields });
  });

  it('adds at the end, never twice, up to the cap, saying how many did not fit', () => {
    expect(withImagesAdded(['a'], ['b', 'a', '', 'c'])).toEqual({
      ids: ['a', 'b', 'c'],
      skipped: 0,
    });
    const full = withImagesAdded(ids(19), ['x', 'y', 'z']);
    expect(full.ids).toHaveLength(IMAGE_FIELD_PICTURES_MAX);
    expect(full.ids.at(-1)).toBe('x');
    expect(full.skipped).toBe(2);
  });

  it('removes and reorders, leaving the list as it was for a move outside it', () => {
    expect(withoutImages(['a', 'b', 'c'], ['b', 'z'])).toEqual(['a', 'c']);
    expect(movedImage(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(movedImage(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(movedImage(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
    expect(movedImage(['a', 'b', 'c'], 3, 0)).toEqual(['a', 'b', 'c']);
    expect(movedImage(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(movedImage(['a', 'b', 'c'], 0.5, 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('the readers that never show a picture', () => {
  const setup: PlanBoardSetup = { ...presetSetup('kanban'), addTypes: ['shots'] };
  const todo = setup.columns[0]!.status;

  it('card text says nothing for one picture or several', () => {
    expect(customFieldText(several, ['a', 'b'])).toBeNull();
    expect(customFieldText(one, ['a', 'b'])).toBeNull();
    expect(customFieldText(one, 'a')).toBeNull();
  });

  it('Export CSV leaves both out, and Import CSV skips their columns', () => {
    const card = item(
      { title: 'S', status: todo, 'f-cover': 'a', 'f-designs': ['b', 'c'], 'f-note': 'Hi' },
      { type: 'shots' },
    );
    const rows = boardCsvRows(setup, new Map([[card.id, card]]), [shots]);
    expect(rows[0]).toContain('Note');
    expect(rows[0]).not.toContain('Cover');
    expect(rows[0]).not.toContain('Designs');
    const { creates } = boardCsvImport(
      [
        ['Title', 'Designs', 'Cover'],
        ['New', 'img-1, img-2', 'img-3'],
      ],
      { setup, types: [shots], people: [], room: 10 },
    );
    expect(creates[0]!.fields).not.toHaveProperty('f-designs');
    expect(creates[0]!.fields).not.toHaveProperty('f-cover');
  });

  it('is never required', () => {
    expect(canBeRequired('image')).toBe(false);
  });
});

describe('Image and Several Images, one into the other', () => {
  const on = { field: 'f-x', typeIds: new Set(['shots']) };
  const cards = [
    item({ title: 'A', 'f-x': 'a' }, { id: 'c1', type: 'shots' }),
    item({ title: 'B', 'f-x': ['b', 'c'] }, { id: 'c2', type: 'shots' }),
    item({ title: 'C', 'f-x': ['d'] }, { id: 'c3', type: 'shots' }),
  ];

  it('is open both ways, and to nothing else', () => {
    expect(kindChangeRefusal(one, several)).toBeNull();
    expect(kindChangeRefusal(several, one)).toBeNull();
    expect(kindChangeRefusal(several, { kind: 'text' })).toMatch(/Image/);
  });

  it('keeps every picture into Several Images, rewriting no card', () => {
    expect(changesValues(one, several)).toBe(false);
    expect(changedValue(one, several, 'a')).toEqual({ kind: 'kept' });
    expect(fieldKindChange(one, several, cards, on).patches).toEqual([]);
  });

  it('keeps the first picture into an Image field, the rest leaving the card', () => {
    expect(changesValues(several, one)).toBe(true);
    expect(changesValues(several, several)).toBe(false);
    expect(changedValue(several, one, ['b', 'c'])).toEqual({
      kind: 'rewritten',
      value: 'b',
      trimmed: true,
    });
    const out = fieldKindChange(several, one, cards, on);
    expect(out).toMatchObject({ held: 3, trimmed: 1, cleared: 0 });
    expect(out.patches).toEqual([{ id: 'c2', patch: { set: { 'f-x': 'b' } } }]);
  });
});
