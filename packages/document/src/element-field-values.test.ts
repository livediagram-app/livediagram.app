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

  it('checks the diagram-building kinds’ closed fields', () => {
    expect(ELEMENT_FIELD_VALUES.chipLook).toContain('solid');
    expect(fieldValueIssue('cardMedia', 'tile')).toBeNull();
    expect(fieldValueIssue('boundaryStyle', 'dashed')).toMatch(/tab, inset, c4/);
    expect(fieldValueIssue('pyramidVariant', 'funnel')).toBeNull();
    expect(fieldValueIssue('attachAt', 'middle')).not.toBeNull();
    expect(fieldValueIssue('accentEdge', 'right')).toMatch(/left, top, bottom/);
    expect(fieldValueIssue('stackDirection', 'grid')).toBeNull();
    expect(fieldValueIssue('stackAlign', 'middle')).toMatch(/start, center, end/);
    expect(fieldValueIssue('mindLook', 'avatar')).toMatch(/person/);
  });
});
