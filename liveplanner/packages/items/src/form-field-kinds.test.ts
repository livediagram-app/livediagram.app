// The Multiple Choice and Rating field kinds (docs/specs/030-forms/forms.md "New card field kinds"): read from a
// stored catalogue, shown on a card, carried by CSV and named by agents.
import { describe, expect, it } from 'vitest';
import { multiChoiceOf } from './board-csv';
import { customFieldText, multiChoiceText, ratingText } from './card-text';
import { ratingScaleOf, type CustomFieldDef, type ItemTypeDef } from './item-types';
import { resolveFields } from './plan-names';
import { readItemTypeCatalogue } from './type-catalogue';
import { applyCardTypeChanges } from './type-changes';

const DIET: CustomFieldDef = {
  id: 'f-diet',
  label: 'Diet',
  kind: 'multichoice',
  options: ['Vegan', 'Gluten free', 'Nuts, none'],
};
const SCORE: CustomFieldDef = { id: 'f-score', label: 'Score', kind: 'rating' };
const TEN: CustomFieldDef = { id: 'f-ten', label: 'Ten', kind: 'rating', scale: 10 };

const type = (custom: CustomFieldDef[]): ItemTypeDef => ({
  id: 'guest',
  label: 'Guest',
  newTitle: 'New guest',
  glyph: 'star',
  color: '#2563eb',
  fields: ['title', 'status', ...custom.map((f) => f.id)],
  custom,
});

const catalogue = (custom: unknown[]) => ({
  version: 1,
  types: [{ ...type([]), fields: ['title', 'status'], custom }],
});

describe('reading the new kinds from a catalogue', () => {
  it('keeps a Multiple Choice with its options', () => {
    const read = readItemTypeCatalogue(catalogue([DIET]));
    expect(read?.types[0]?.custom?.[0]).toEqual(DIET);
  });

  it('refuses a Multiple Choice with no options or repeated ones', () => {
    expect(readItemTypeCatalogue(catalogue([{ ...DIET, options: [] }]))).toBeNull();
    expect(readItemTypeCatalogue(catalogue([{ ...DIET, options: ['A', 'a'] }]))).toBeNull();
  });

  it('keeps a Rating scale of 3 to 10, the default 5 left unstored', () => {
    expect(readItemTypeCatalogue(catalogue([TEN]))?.types[0]?.custom?.[0]?.scale).toBe(10);
    const five = readItemTypeCatalogue(catalogue([{ ...SCORE, scale: 5 }]))?.types[0]?.custom?.[0];
    expect(five?.scale).toBeUndefined();
    expect(ratingScaleOf(five!)).toBe(5);
    expect(readItemTypeCatalogue(catalogue([{ ...SCORE, scale: 2 }]))).toBeNull();
    expect(readItemTypeCatalogue(catalogue([{ ...SCORE, scale: 11 }]))).toBeNull();
    expect(readItemTypeCatalogue(catalogue([{ ...SCORE, scale: 4.5 }]))).toBeNull();
  });
});

describe('on a card', () => {
  it('joins Multiple Choice picks', () => {
    expect(customFieldText(DIET, ['Vegan', 'Gluten free'])).toBe('Vegan, Gluten free');
    expect(multiChoiceText([])).toBeNull();
    expect(multiChoiceText('Vegan')).toBe('Vegan');
    expect(multiChoiceText(undefined)).toBeNull();
  });

  it('draws a Rating as stars up to five, else as a score', () => {
    expect(customFieldText(SCORE, 4)).toBe('★★★★☆');
    expect(customFieldText(TEN, 7)).toBe('7 / 10');
    expect(ratingText(9, 5)).toBe('★★★★★');
    expect(ratingText(0, 5)).toBeNull();
    expect(ratingText('4', 5)).toBeNull();
  });
});

describe('CSV', () => {
  it('reads picks split by semicolons, or by commas when every part is an option', () => {
    expect(multiChoiceOf(DIET.options!, 'gluten free; vegan')).toEqual(['Vegan', 'Gluten free']);
    expect(multiChoiceOf(DIET.options!, 'Vegan, Gluten free')).toEqual(['Vegan', 'Gluten free']);
    expect(multiChoiceOf(DIET.options!, 'Nuts, none')).toEqual(['Nuts, none']);
    expect(multiChoiceOf(DIET.options!, 'Fish')).toBeUndefined();
  });
});

describe('agents naming values', () => {
  const naming = { statuses: [], items: [] };

  it('takes Multiple Choice picks by name, in option order', () => {
    const r = resolveFields({ Diet: ['gluten free', 'Vegan', 'vegan'] }, type([DIET]), naming);
    expect(r).toEqual({ ok: true, fields: { 'f-diet': ['Vegan', 'Gluten free'] } });
    expect(resolveFields({ Diet: 'Vegan' }, type([DIET]), naming)).toEqual({
      ok: true,
      fields: { 'f-diet': ['Vegan'] },
    });
    expect(resolveFields({ Diet: ['Fish'] }, type([DIET]), naming).ok).toBe(false);
  });

  it('takes a Rating within its scale', () => {
    expect(resolveFields({ Score: 4 }, type([SCORE]), naming)).toEqual({
      ok: true,
      fields: { 'f-score': 4 },
    });
    expect(resolveFields({ Score: '3' }, type([SCORE]), naming).ok).toBe(true);
    expect(resolveFields({ Score: 6 }, type([SCORE]), naming).ok).toBe(false);
    expect(resolveFields({ Score: true }, type([SCORE]), naming).ok).toBe(false);
  });

  it('adds the kinds through change_card_types', () => {
    const r = applyCardTypeChanges(
      null,
      [
        {
          op: 'add',
          name: 'Guest',
          custom: [
            { name: 'Diet', kind: 'Multi Choice', options: ['Vegan', 'Halal'] },
            { name: 'Score', kind: 'rating', scale: 10 },
          ],
        },
      ],
      [],
    );
    expect(r.ok).toBe(true);
    const guest = r.ok ? r.catalogue?.types.find((t) => t.label === 'Guest') : undefined;
    expect(guest?.custom?.map((f) => [f.kind, f.options ?? f.scale])).toEqual([
      ['multichoice', ['Vegan', 'Halal']],
      ['rating', 10],
    ]);
  });

  it('refuses a Rating scale out of range', () => {
    const r = applyCardTypeChanges(
      null,
      [{ op: 'add', name: 'Guest', custom: [{ name: 'Score', kind: 'rating', scale: 20 }] }],
      [],
    );
    expect(r.ok).toBe(false);
  });
});
