import { describe, expect, it } from 'vitest';
import { ALL_ANCHORS } from './arrow-types';

describe('ALL_ANCHORS', () => {
  it('lists the sixteen anchors once each, clockwise from the top', () => {
    expect(ALL_ANCHORS).toHaveLength(16);
    expect(new Set(ALL_ANCHORS).size).toBe(16);
    expect(ALL_ANCHORS[0]).toBe('n');
    expect(ALL_ANCHORS[4]).toBe('e');
  });
});
