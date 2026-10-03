import { describe, expect, it } from 'vitest';
import {
  DIMENSION_LABELS,
  FIXED_VALUES,
  LENS_DIMENSIONS,
  LENS_TELEMETRY_TYPES,
  VALUE_LABELS,
  isLensDimension,
} from './dimensions';
import { LENS_ISSUE_REASONS } from './types';

describe('the dimension catalogue', () => {
  it('lists the dimensions in canonical order', () => {
    expect(LENS_DIMENSIONS).toEqual([
      'opens-in',
      'kind',
      'template',
      'made-by',
      'edited',
      'people',
      'space',
    ]);
  });

  it('labels every fixed value of every fixed dimension', () => {
    for (const [dimension, values] of Object.entries(FIXED_VALUES)) {
      const labels = VALUE_LABELS[dimension as keyof typeof FIXED_VALUES];
      expect(Object.keys(labels)).toEqual([...values]);
    }
  });

  it('never calls a mode, a tab kind or a template family a type, nor a dimension a board', () => {
    const copy = [
      ...Object.values(DIMENSION_LABELS),
      ...Object.values(VALUE_LABELS).flatMap(Object.values),
    ];
    expect(copy.filter((label) => /\b(type|board)\b/i.test(label))).toEqual([]);
  });

  it('names one closed telemetry type per facet', () => {
    expect(LENS_TELEMETRY_TYPES).toEqual({
      text: 'Text',
      'opens-in': 'OpensIn',
      kind: 'Kind',
      template: 'Template',
      'made-by': 'MadeBy',
      edited: 'Edited',
      people: 'People',
      space: 'Space',
    });
  });

  it('names every issue reason', () => {
    expect(LENS_ISSUE_REASONS).toEqual([
      'unknown_dimension',
      'missing_value',
      'unknown_value',
      'unknown_team',
      'space_not_here',
      'too_long',
    ]);
  });
});

describe('isLensDimension', () => {
  it.each(['opens-in', 'space'])('accepts %s', (key) => {
    expect(isLensDimension(key)).toBe(true);
  });

  it.each(['type', 'board', 'Kind', 'opens', ''])('refuses %j', (key) => {
    expect(isLensDimension(key)).toBe(false);
  });
});
