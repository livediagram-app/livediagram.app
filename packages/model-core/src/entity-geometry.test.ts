import { describe, expect, it } from 'vitest';
import { entityHeaderHeight, entityHeight } from './entity-geometry';

// docs/specs/009-elements/entity.md: the title bar follows the title's size, and a box sized with
// entityHeight shows every row with nothing to spare.

describe('entityHeaderHeight', () => {
  it('leaves the default size exactly where it was', () => {
    // Existing diagrams must not shift by a pixel.
    expect(entityHeaderHeight(undefined)).toBe(30);
    expect(entityHeaderHeight('scale')).toBe(30);
    expect(entityHeaderHeight('sm')).toBe(30);
  });

  it('grows with the title, so the rule stays under the text', () => {
    // The bug: a 32px `lg` title in a 30px band overflowed it.
    expect(entityHeaderHeight('lg')).toBeGreaterThan(32);
    expect(entityHeaderHeight('md')).toBeGreaterThan(entityHeaderHeight('scale'));
    expect(entityHeaderHeight('lg')).toBeGreaterThan(entityHeaderHeight('md'));
  });
});

describe('entityHeight', () => {
  it('is the title bar alone with no rows', () => {
    expect(entityHeight(0, 'sm')).toBe(30);
  });

  it('adds the padded list: 13.75 px a row, 3 px between rows, 6 px above and below', () => {
    // 30 + 5 * 13.75 + 4 * 3 + 12 = 122.75, rounded up.
    expect(entityHeight(5, 'sm')).toBe(123);
    expect(entityHeight(5, 'lg')).toBe(entityHeight(5, 'sm') + entityHeaderHeight('lg') - 30);
  });
});
