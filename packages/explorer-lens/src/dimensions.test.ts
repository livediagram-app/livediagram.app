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
    expect(LENS_DIMENSIONS).toEqual(['opens-in', 'board', 'made-by', 'edited', 'people', 'space']);
  });

  it('labels every fixed value of every fixed dimension', () => {
    for (const [dimension, values] of Object.entries(FIXED_VALUES)) {
      const labels = VALUE_LABELS[dimension as keyof typeof FIXED_VALUES];
      expect(Object.keys(labels)).toEqual([...values]);
    }
  });

  it('never calls an editor mode a type', () => {
    const copy = [
      ...Object.values(DIMENSION_LABELS),
      ...Object.values(VALUE_LABELS).flatMap(Object.values),
    ];
    expect(copy.filter((label) => /\btype\b/i.test(label))).toEqual([]);
  });

  it('names one closed telemetry type per facet', () => {
    expect(LENS_TELEMETRY_TYPES).toEqual({
      text: 'Text',
      'opens-in': 'OpensIn',
      board: 'Board',
      'made-by': 'MadeBy',
      edited: 'Edited',
      people: 'People',
      space: 'Space',
    });
  });

  it('names every issue reason', () => {
    expect(LENS_ISSUE_REASONS).toHaveLength(7);
  });
});

describe('isLensDimension', () => {
  it.each(['opens-in', 'space'])('accepts %s', (key) => {
    expect(isLensDimension(key)).toBe(true);
  });

  it.each(['type', 'Board', 'opens', ''])('refuses %j', (key) => {
    expect(isLensDimension(key)).toBe(false);
  });
});
