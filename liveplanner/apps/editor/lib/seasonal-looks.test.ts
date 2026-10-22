import { describe, expect, it } from 'vitest';
import {
  FINISHES,
  FONTS,
  isAnimatedPattern,
  isSeasonalPattern,
  SEASONAL_BACKGROUND_PATTERNS,
} from '@liveplanner/project';
import { resolveTheme } from '@/lib/themes';
import { patternLabel } from '@/components/palette/palette-patterns';
import {
  SEASONAL_LOOKS,
  SEASON_LABELS,
  easterSunday,
  seasonOrder,
  seasonalLooksFor,
  type Season,
} from './seasonal-looks';
import { TAB_LOOKS, activeLookId, tabLookById, withLookApplied } from './tab-looks';
import type { Tab } from '@liveplanner/project';

// Seasonal looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Seasonal looks").
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const blank = { id: 't', name: 'T', elements: [] } as unknown as Tab;

describe('SEASONAL_LOOKS', () => {
  it('holds one New Year, one Easter, one Halloween and three Christmas looks', () => {
    const count = (s: Season) => SEASONAL_LOOKS.filter((l) => l.season === s).length;
    expect([count('new-year'), count('easter'), count('halloween'), count('christmas')]).toEqual([
      1, 1, 1, 3,
    ]);
  });

  it('builds each from a seasonal theme and a font and pattern that exist', () => {
    for (const look of SEASONAL_LOOKS) {
      const theme = resolveTheme(look.theme);
      expect(theme?.seasonal, look.id).toBe(true);
      if (look.font)
        expect(
          FONTS.some((f) => f.id === look.font),
          look.id,
        ).toBe(true);
      expect(isSeasonalPattern(look.pattern) || isAnimatedPattern(look.pattern), look.id).toBe(
        true,
      );
      // Its card names its ingredients: the theme first, the pattern last.
      expect(look.description.startsWith(theme!.label), look.id).toBe(true);
      expect(look.description.endsWith(patternLabel(look.pattern).toLowerCase()), look.id).toBe(
        true,
      );
    }
  });

  it('wears every seasonal pattern, and offers every finish', () => {
    for (const p of SEASONAL_BACKGROUND_PATTERNS)
      expect(
        SEASONAL_LOOKS.some((l) => l.pattern === p),
        p,
      ).toBe(true);
    expect(new Set(SEASONAL_LOOKS.map((l) => l.finish))).toEqual(new Set(FINISHES));
  });

  it('never shares an id or a mix with any look, so at most one reads as selected', () => {
    const all = [...TAB_LOOKS, ...SEASONAL_LOOKS];
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    const keys = all.map((l) => [l.theme, l.finish, l.font, l.pattern].join('|'));
    expect(new Set(keys).size).toBe(all.length);
  });

  it('stays out of the everyday carousel, yet a tab wearing one reads as that look', () => {
    for (const look of SEASONAL_LOOKS) {
      expect(TAB_LOOKS.some((l) => l.id === look.id)).toBe(false);
      expect(tabLookById(look.id)).toBe(look);
      expect(activeLookId(withLookApplied(blank, look))).toBe(look.id);
    }
  });

  it('labels every season', () => {
    expect(Object.values(SEASON_LABELS)).toEqual(['New Year', 'Easter', 'Halloween', 'Christmas']);
  });
});

describe('easterSunday', () => {
  it('matches the published dates', () => {
    const known: [number, number, number][] = [
      [2024, 3, 31],
      [2025, 4, 20],
      [2026, 4, 5],
      [2027, 3, 28],
      [2038, 4, 25],
      [2285, 3, 22],
    ];
    for (const [y, m, d] of known) expect(easterSunday(y)).toEqual(day(y, m, d));
  });
});

describe('seasonOrder', () => {
  it('leads with the season on now, or the next one coming', () => {
    expect(seasonOrder(day(2026, 10, 15))).toEqual([
      'halloween',
      'christmas',
      'new-year',
      'easter',
    ]);
    expect(seasonOrder(day(2026, 10, 31))[0]).toBe('halloween');
    expect(seasonOrder(day(2026, 11, 1))[0]).toBe('christmas');
    expect(seasonOrder(day(2026, 12, 26))[0]).toBe('christmas');
    expect(seasonOrder(day(2026, 12, 27))[0]).toBe('new-year');
    expect(seasonOrder(day(2027, 1, 7))[0]).toBe('new-year');
    expect(seasonOrder(day(2027, 1, 8))).toEqual(['easter', 'halloween', 'christmas', 'new-year']);
    // Easter 2027 is 28 March: it leads through Easter Monday, then Halloween.
    expect(seasonOrder(day(2027, 3, 29))[0]).toBe('easter');
    expect(seasonOrder(day(2027, 3, 30))[0]).toBe('halloween');
  });

  it('ignores the time of day', () => {
    expect(seasonOrder(new Date(2026, 9, 31, 23, 59))[0]).toBe('halloween');
  });
});

describe('seasonalLooksFor', () => {
  it('lists every seasonal look once, the leading season’s first, in catalogue order within a season', () => {
    const looks = seasonalLooksFor(day(2026, 11, 20));
    expect(looks).toHaveLength(SEASONAL_LOOKS.length);
    expect(looks.map((l) => l.id)).toEqual([
      'christmas-morning',
      'winter-wonderland',
      'fireside',
      'countdown',
      'egg-hunt',
      'haunted',
    ]);
  });
});
