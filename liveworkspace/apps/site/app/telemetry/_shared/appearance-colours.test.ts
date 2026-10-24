import { describe, expect, it } from 'vitest';
import { DARK_CARD, DARK_MIN_CONTRAST, darkFloor, forAppearance } from './appearance-colours';
import { contrastRatio } from './colour-maths';
import { categoryColor } from './event-vocab';
import { TEST_APPS } from './test-apps';

describe('forAppearance', () => {
  it('leaves every colour alone in light', () => {
    expect(forAppearance('#9d174d', 'light')).toBe('#9d174d');
    expect(forAppearance('#f59e0b', 'light')).toBe('#f59e0b');
  });

  it('keeps a hue that already reads on the dark card', () => {
    expect(forAppearance('#f59e0b', 'dark')).toBe('#f59e0b');
  });

  it('lifts a deep hue until it reads on the dark card', () => {
    const lifted = forAppearance('#9d174d', 'dark');
    expect(lifted).not.toBe('#9d174d');
    expect(contrastRatio(lifted, DARK_CARD)).toBeGreaterThanOrEqual(DARK_MIN_CONTRAST);
  });

  it('lifts no further than it needs to', () => {
    const t = darkFloor('#9d174d');
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(0.6);
  });
});

describe.each(TEST_APPS)('$name category colours in dark', ({ config, categories }) => {
  const colors = config.categoryColors;
  it('reads every category at text contrast on the dark card', () => {
    for (const category of [...categories, 'Unknown']) {
      const colour = categoryColor(colors, category, 'dark');
      expect(contrastRatio(colour, DARK_CARD), category).toBeGreaterThanOrEqual(DARK_MIN_CONTRAST);
    }
  });

  it('matches light when no appearance is given', () => {
    expect(categoryColor(colors, 'Page')).toBe(categoryColor(colors, 'Page', 'light'));
  });
});
