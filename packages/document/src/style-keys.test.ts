import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_NAMES } from './element-fields';
import { STYLE_KEYS, styleKeysFor } from './style-keys';

describe('STYLE_KEYS', () => {
  it('names each key once', () => {
    const keys = STYLE_KEYS.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('writes only fields an element of its target stores', () => {
    const fieldsOf = (lists: readonly (readonly string[])[]) => new Set(lists.flat());
    const boxFields = fieldsOf(
      Object.entries(ELEMENT_FIELD_NAMES)
        .filter(([type]) => type !== 'arrow')
        .map(([, names]) => names),
    );
    const arrowFields = fieldsOf([ELEMENT_FIELD_NAMES.arrow]);
    for (const { field, on } of STYLE_KEYS) {
      if (on !== 'arrows') expect(boxFields.has(field)).toBe(true);
      if (on !== 'boxes') expect(arrowFields.has(field)).toBe(true);
    }
  });

  it('gives arrows their line keys and boxes theirs', () => {
    expect(styleKeysFor('arrow').map((k) => k.key)).toEqual(['stroke', 'line']);
    expect(styleKeysFor('shape').map((k) => k.key)).toEqual([
      'fill',
      'stroke',
      'text-color',
      'border',
      'text',
      'font',
    ]);
  });
});
