import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_NAMES } from './element-fields';
import { STYLE_KEYS, styleKeysFor } from '@liveworkspace/model-core/style-keys';

describe('STYLE_KEYS', () => {
  it('names each key once', () => {
    const keys = STYLE_KEYS.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // A stored arrow is a retired element (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
  // part 4) that no style key writes, so only the box keys are checked.
  it('writes only fields a boxed element stores', () => {
    const fieldsOf = (lists: readonly (readonly string[])[]) => new Set(lists.flat());
    const boxFields = fieldsOf(
      Object.entries(ELEMENT_FIELD_NAMES)
        .filter(([type]) => type !== 'arrow')
        .map(([, names]) => names),
    );
    for (const { field, on } of STYLE_KEYS) {
      if (on !== 'arrows') expect(boxFields.has(field)).toBe(true);
    }
  });

  it('gives boxes their keys', () => {
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
