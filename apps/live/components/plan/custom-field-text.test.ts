import { describe, expect, it } from 'vitest';
import type { CustomFieldDef } from '@livediagram/items';
import { customFieldText } from './custom-field-text';

// docs/specs/026-plan/item-types.md "An item type": a custom field's value on a card face.
const field = (kind: CustomFieldDef['kind']): CustomFieldDef => ({ id: 'f-x', label: 'X', kind });

describe('customFieldText', () => {
  it('writes each kind as one line, and nothing for no value', () => {
    expect(customFieldText(field('text'), 'Hello\nworld')).toBe('Hello');
    expect(customFieldText(field('checkbox'), true)).toBe('Yes');
    expect(customFieldText(field('checkbox'), false)).toBe('No');
    expect(customFieldText(field('number'), 3.5)).toBe('3.5');
    expect(customFieldText(field('link'), 'https://acme.test/a')).toBe('acme.test/a');
    expect(customFieldText(field('choice'), 'Won')).toBe('Won');
    expect(customFieldText(field('date'), '2026-10-05')).toMatch(/2026/);
    expect(customFieldText(field('text'), undefined)).toBeNull();
    expect(customFieldText(field('text'), '')).toBeNull();
  });

  it('shows nothing for a value of the wrong kind', () => {
    expect(customFieldText(field('number'), 'three')).toBeNull();
    expect(customFieldText(field('checkbox'), 'yes')).toBeNull();
    expect(customFieldText(field('date'), 5)).toBeNull();
  });
});
