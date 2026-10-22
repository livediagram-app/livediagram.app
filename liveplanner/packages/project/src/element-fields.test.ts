import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_NAMES, isElementFieldName } from './element-fields';
import { ELEMENT_TYPES } from './validate';

// docs/specs/024-agents/blueprints/edit-operations.md "Fields and values": a `set` names a stored
// field of the element's type. The compile-time check in element-fields.ts keeps every list
// exhaustive; these pin the lookups the engine makes.
describe('ELEMENT_FIELD_NAMES', () => {
  it('has one list for every element type', () => {
    expect(new Set(Object.keys(ELEMENT_FIELD_NAMES))).toEqual(ELEMENT_TYPES);
  });

  it('lists each field once', () => {
    for (const names of Object.values(ELEMENT_FIELD_NAMES))
      expect(new Set(names).size).toBe(names.length);
  });

  it('lists the identity, geometry and content of a shape', () => {
    expect(ELEMENT_FIELD_NAMES.shape).toEqual(
      expect.arrayContaining(['id', 'type', 'shape', 'x', 'y', 'width', 'height', 'label', 'note']),
    );
  });

  it('lists an arrow by its ends, not a box', () => {
    expect(ELEMENT_FIELD_NAMES.arrow).toEqual(expect.arrayContaining(['from', 'to', 'arrowStyle']));
    expect(ELEMENT_FIELD_NAMES.arrow).not.toContain('x');
  });
});

describe('isElementFieldName', () => {
  it('accepts a stored field of the type', () => {
    expect(isElementFieldName('sticky', 'fillColor')).toBe(true);
  });

  it('refuses a field another type has', () => {
    expect(isElementFieldName('arrow', 'width')).toBe(false);
  });

  it('refuses prototype keys', () => {
    expect(isElementFieldName('shape', '__proto__')).toBe(false);
    expect(isElementFieldName('shape', 'constructor')).toBe(false);
  });
});
