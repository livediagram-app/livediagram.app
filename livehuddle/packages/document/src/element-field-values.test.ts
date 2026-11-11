import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_VALUES, fieldValueIssue } from './element-field-values';

describe('fieldValueIssue', () => {
  it('passes a value on its list, an absent value and a field with no list', () => {
    expect(fieldValueIssue('textSize', 'lg')).toBeNull();
    expect(fieldValueIssue('textSize', undefined)).toBeNull();
    expect(fieldValueIssue('label', 'anything')).toBeNull();
  });

  it('refuses a value off its list, naming what the field takes', () => {
    expect(fieldValueIssue('textSize', 'xl')).toBe('textSize "xl" is not one of sm, md, lg, scale');
  });

  it('passes a pixel text size, as a Step number stores one', () => {
    expect(fieldValueIssue('textSize', 14)).toBeNull();
    expect(fieldValueIssue('textSize', Number.NaN)).not.toBeNull();
    expect(fieldValueIssue('borderRadius', 4)).not.toBeNull();
  });

  // The accent edge left with the square and the stadium it drew on (part 5).
  it('no longer checks the accent edge or the retired layout kinds’ fields', () => {
    for (const field of [
      'accentEdge',
      'chipLook',
      'cardMedia',
      'boundaryStyle',
      'attachAt',
      'stackDirection',
      'stackAlign',
    ])
      expect(ELEMENT_FIELD_VALUES[field], field).toBeUndefined();
  });
});
