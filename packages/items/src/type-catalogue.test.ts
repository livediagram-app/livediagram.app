import { describe, expect, it } from 'vitest';
import { FALLBACK_ITEM_TYPE, ITEM_TYPES, type ItemTypeDef } from './item-types';
import { planGlyphPath, PLAN_GLYPH_FALLBACK, PLAN_GLYPHS } from './glyphs';
import {
  builtInCatalogue,
  customFieldOf,
  isBuiltInFieldId,
  ITEM_TYPES_MAX,
  newCustomFieldId,
  newItemTypeId,
  readItemTypeCatalogue,
  slugOf,
  typeIn,
  typesOf,
  validateItemTypeCatalogue,
  detailsLabelOf,
  DETAILS_LABEL_DEFAULT,
} from './type-catalogue';

// docs/specs/026-plan/item-types.md.
const call = {
  id: 'customer-call',
  label: 'Customer call',
  color: '#0891b2',
  glyph: 'chat',
  fields: ['f-outcome', 'description', 'f-followed-up'],
  custom: [
    { id: 'f-outcome', label: 'Outcome', kind: 'choice', options: ['Won', 'Lost'], onCard: true },
    { id: 'f-followed-up', label: 'Followed up', kind: 'checkbox' },
  ],
};
const withCall = (types: unknown[] = [...ITEM_TYPES, call]) => ({ version: 1, types });

describe('the type catalogue', () => {
  it('is the built-ins until a document stores its own', () => {
    expect(typesOf(null)).toBe(ITEM_TYPES);
    expect(typesOf(builtInCatalogue())).toEqual(ITEM_TYPES);
    expect(typeIn(ITEM_TYPES, 'project').label).toBe('Project');
    expect(typeIn(ITEM_TYPES, 'gone')).toBe(FALLBACK_ITEM_TYPE);
  });

  it('keeps a valid catalogue, normalised: title and status first, a new title made', () => {
    const result = validateItemTypeCatalogue(withCall());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t = typeIn(result.catalogue.types, 'customer-call');
    expect(t.fields).toEqual(['title', 'status', 'f-outcome', 'description', 'f-followed-up']);
    expect(t.newTitle).toBe('New customer call');
    expect(t.custom?.[0]).toEqual({
      id: 'f-outcome',
      label: 'Outcome',
      kind: 'choice',
      options: ['Won', 'Lost'],
      onCard: true,
    });
  });

  it('keeps a renamed Details, drops the default name, and refuses a blank or long one', () => {
    const one = (detailsLabel: unknown) =>
      validateItemTypeCatalogue(withCall([{ ...call, detailsLabel }]));
    const named = one('  Facts ');
    expect(named.ok && named.catalogue.types[0]!.detailsLabel).toBe('Facts');
    expect(detailsLabelOf(named.ok ? named.catalogue.types[0]! : {})).toBe('Facts');
    const plain = one('Details');
    expect(plain.ok && plain.catalogue.types[0]!.detailsLabel).toBeUndefined();
    expect(detailsLabelOf({})).toBe(DETAILS_LABEL_DEFAULT);
    expect(one(' ')).toMatchObject({ reason: 'types[0].detailsLabel' });
    expect(one('x'.repeat(25))).toMatchObject({ reason: 'types[0].detailsLabel' });
  });

  it('refuses a catalogue by the part that fails', () => {
    const bad = (patch: Record<string, unknown>) =>
      validateItemTypeCatalogue(withCall([{ ...call, ...patch }]));
    expect(validateItemTypeCatalogue({ version: 2, types: [call] })).toEqual({
      ok: false,
      reason: 'version',
    });
    expect(validateItemTypeCatalogue(withCall([]))).toMatchObject({ ok: false, reason: 'types' });
    expect(bad({ id: 'Has Caps' })).toMatchObject({ reason: 'types[0].id' });
    expect(bad({ id: 'item' })).toMatchObject({ reason: 'types[0].id' });
    expect(bad({ label: ' ' })).toMatchObject({ reason: 'types[0].label' });
    expect(bad({ color: 'red' })).toMatchObject({ reason: 'types[0].color' });
    expect(bad({ glyph: 'unicorn' })).toMatchObject({ reason: 'types[0].glyph' });
    expect(bad({ fields: ['f-nope'] })).toMatchObject({ reason: 'types[0].fields' });
    expect(bad({ custom: [{ id: 'nope', label: 'X', kind: 'text' }] })).toMatchObject({
      reason: 'types[0].custom[0].id',
    });
    expect(
      bad({ custom: [{ id: 'f-a', label: 'A', kind: 'choice', options: ['x', 'X'] }] }),
    ).toMatchObject({ reason: 'types[0].custom[0].options' });
    expect(bad({ custom: [{ id: 'f-a', label: 'A', kind: 'person' }] })).toMatchObject({
      reason: 'types[0].custom[0].kind',
    });
    expect(
      validateItemTypeCatalogue(withCall([call, { ...call, id: 'other', label: 'CUSTOMER CALL' }])),
    ).toMatchObject({ reason: 'types[1].label' });
    const many = Array.from({ length: ITEM_TYPES_MAX + 1 }, (_, i) => ({
      ...call,
      id: `t${i}`,
      label: `T${i}`,
    }));
    expect(validateItemTypeCatalogue(withCall(many))).toMatchObject({ reason: 'types' });
  });

  it('reads back a stored value, falling back to the built-ins when it is damaged', () => {
    expect(readItemTypeCatalogue(null)).toBeNull();
    expect(readItemTypeCatalogue('{not json')).toBeNull();
    expect(readItemTypeCatalogue(JSON.stringify(withCall()))?.types).toHaveLength(
      ITEM_TYPES.length + 1,
    );
  });

  it('makes ids from names that never clash', () => {
    expect(slugOf('  Café  Visit! ')).toBe('cafe-visit');
    expect(newItemTypeId('Task', ITEM_TYPES)).toBe('task-2');
    expect(newItemTypeId('Item', ITEM_TYPES)).toBe('item-2');
    expect(newItemTypeId('42 things', ITEM_TYPES)).toBe('type-42-things');
    expect(newCustomFieldId('Outcome', ['f-outcome'])).toBe('f-outcome-2');
    expect(newCustomFieldId('!!!', [])).toBe('f-field');
  });

  it('draws every glyph, and an unknown one as a square', () => {
    for (const id of Object.keys(PLAN_GLYPHS))
      expect(planGlyphPath(id)).not.toBe(PLAN_GLYPH_FALLBACK);
    expect(planGlyphPath('item')).toBe(PLAN_GLYPH_FALLBACK);
    expect(planGlyphPath(undefined)).toBe(PLAN_GLYPH_FALLBACK);
  });
});

describe('reading a type', () => {
  it('finds a custom field by id and tells built-in fields apart', () => {
    const type = { ...call, newTitle: 'x' } as unknown as ItemTypeDef;
    expect(customFieldOf(type, 'f-outcome')?.label).toBe('Outcome');
    expect(customFieldOf(ITEM_TYPES[0], 'f-outcome')).toBeUndefined();
    expect(isBuiltInFieldId('due')).toBe(true);
    expect(isBuiltInFieldId('f-outcome')).toBe(false);
  });

  it('starts a first change from the built-ins', () => {
    expect(builtInCatalogue()).toEqual({ version: 1, types: ITEM_TYPES });
  });
});
