import { describe, expect, it } from 'vitest';
import { RAIL_CLEAR_PADDING } from './share-rail-clearance';

// The rail card's measured width at xl (two icon columns' worth of padding round a 16px icon), and
// the max-w-7xl column it must keep clear of. Tailwind spacing is 4px a step.
const RAIL_WIDTH = 47;
const COLUMN = 1280;

function paddingAt(width: number): number {
  const steps: Record<string, number> = {};
  for (const token of RAIL_CLEAR_PADDING.split(' ')) {
    const m = /^(?:(xl|2xl):)?px-(\d+)$/.exec(token);
    if (m) steps[m[1] ?? 'base'] = Number(m[2]) * 4;
  }
  if (width >= 1536 && steps['2xl'] !== undefined) return steps['2xl'];
  if (width >= 1280 && steps.xl !== undefined) return steps.xl;
  return steps.base!;
}

describe('RAIL_CLEAR_PADDING', () => {
  it('keeps a max-w-7xl column clear of the share rail at every width the rail shows', () => {
    for (let width = 1280; width <= 2560; width += 1) {
      const contentRight = (width + Math.min(width, COLUMN)) / 2 - paddingAt(width);
      expect(contentRight, `at ${width}px`).toBeLessThan(width - RAIL_WIDTH);
    }
  });

  it('keeps the usual 24px padding below xl, where the rail is hidden', () => {
    expect(paddingAt(390)).toBe(24);
    expect(paddingAt(1279)).toBe(24);
  });
});
