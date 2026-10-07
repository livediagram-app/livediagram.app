import { describe, expect, it } from 'vitest';
import { validateFields } from './fields';
import { itemColourOf, itemColourValue } from './item-colour';
import { ITEM_TYPES } from './item-types';
import { BUILT_IN_FIELD_IDS, PLAN_TYPE_COLOURS } from './type-catalogue';
import { item } from './test-items';

// docs/specs/026-plan/items.md "Colour".
describe('an item colour', () => {
  it('keeps one of the twelve swatches, as the palette spells it', () => {
    for (const c of PLAN_TYPE_COLOURS) expect(itemColourValue(c)).toBe(c);
    expect(itemColourValue('#2563EB')).toBe('#2563eb');
    expect(itemColourValue('#123456')).toBeUndefined();
    expect(itemColourValue('blue')).toBeUndefined();
    expect(itemColourValue(3)).toBeUndefined();
  });

  it('is a field the validators keep or refuse', () => {
    expect(validateFields({ color: '#16A34A' }, 'patch')).toEqual({
      ok: true,
      fields: { color: '#16a34a' },
    });
    // Making an item from older data drops a colour that is not a swatch instead of refusing the item.
    expect(validateFields({ title: 'Old', color: 'teal' }, 'create')).toEqual({
      ok: true,
      fields: { title: 'Old' },
    });
    expect(validateFields({ color: '#000001' }, 'patch')).toMatchObject({
      ok: false,
      error: 'field_value_invalid',
      field: 'color',
    });
  });

  it('reads an item colour, and nothing for none or a stored stray', () => {
    expect(itemColourOf(item({ title: 'P', color: '#db2777' }))).toBe('#db2777');
    expect(itemColourOf(item({ title: 'P' }))).toBeUndefined();
    expect(itemColourOf(item({ title: 'P', color: 'red' }))).toBeUndefined();
  });

  it('is a default field of a Project, before Start, and a built-in any type can add', () => {
    const project = ITEM_TYPES.find((t) => t.id === 'project')!;
    const f = project.fields as readonly string[];
    expect(f).toContain('color');
    expect(f.indexOf('color')).toBeLessThan(f.indexOf('start'));
    expect(
      ITEM_TYPES.filter((t) => (t.fields as readonly string[]).includes('color')),
    ).toHaveLength(1);
    expect(BUILT_IN_FIELD_IDS).toContain('color');
  });
});
