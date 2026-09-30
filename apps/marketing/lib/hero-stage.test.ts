import { describe, expect, it } from 'vitest';
import { snapStage } from './hero-stage';

describe('snapStage (docs/specs/019-marketing/marketing-site.md)', () => {
  const box = { width: 1104, left: 168 };

  it('sizes windows and gutters in whole pixels', () => {
    const { cardPx, gapPx } = snapStage(box, 68, 3, 0);
    expect(Number.isInteger(cardPx)).toBe(true);
    expect(Number.isInteger(gapPx)).toBe(true);
  });

  it('puts every centred window on a whole page pixel, near the true centre', () => {
    for (const left of [168, 168.5, 23.25]) {
      for (let active = 0; active < 6; active++) {
        const { cardPx, gapPx, translatePx } = snapStage({ ...box, left }, 68, 3, active);
        const windowLeft = left + translatePx + active * (cardPx + gapPx);
        expect(Number.isInteger(Math.round(windowLeft * 1e6) / 1e6)).toBe(true);
        expect(Math.abs(windowLeft - (left + (box.width - cardPx) / 2))).toBeLessThanOrEqual(0.5);
      }
    }
  });
});
