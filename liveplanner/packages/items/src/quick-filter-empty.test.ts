import { describe, expect, it } from 'vitest';
import { isQuickFilterEmpty } from './board';

// A board with no quick filter on reuses its own projection for the header's widgets rather than projecting twice.
describe('isQuickFilterEmpty', () => {
  it('holds for no filter, an empty one and blank search text', () => {
    expect(isQuickFilterEmpty(undefined)).toBe(true);
    expect(isQuickFilterEmpty({})).toBe(true);
    expect(isQuickFilterEmpty({ text: '   ', filters: [] })).toBe(true);
  });

  it('breaks for any part set', () => {
    for (const quick of [
      { text: 'bug' },
      { mine: 'p1' },
      { person: 'p1' },
      { type: 'task' },
      { priority: 'high' as const },
      { due: { to: '2026-11-08' } },
      { filters: [{} as never] },
    ])
      expect(isQuickFilterEmpty(quick)).toBe(false);
  });
});
