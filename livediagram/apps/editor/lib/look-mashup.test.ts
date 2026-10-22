import { describe, expect, it } from 'vitest';
import { FINISHES, FONTS, sketchRandom } from '@livediagram/document';
import { PATTERNS } from '@/components/palette/palette-patterns';
import { THEMES } from '@/lib/themes';
import {
  MASHUP_COMBINATIONS,
  MASHUP_REROLLS,
  lookSettings,
  rollMashup,
  type Random,
} from './look-mashup';
import { TAB_LOOKS, activeLookId, lookMatches } from './tab-looks';

// docs/specs/011-theme/canvas-and-theme-dialog.md "Mashup": a random look from curated ingredients.

// Seeded (the package's mulberry32), so every roll here is repeatable.
const seeded = sketchRandom;

const ROLLS = 500;

describe('rollMashup', () => {
  it('draws every ingredient from the curated catalogues', () => {
    const random = seeded(1);
    const lookFonts = new Set(TAB_LOOKS.map((l) => l.font));
    const lookPatterns = new Set(TAB_LOOKS.map((l) => l.pattern));
    for (let i = 0; i < ROLLS; i++) {
      const m = rollMashup({ random });
      expect(m.id).toBe('mashup');
      expect(m.label).toBe('Mashup');
      expect(THEMES.some((t) => t.id === m.theme)).toBe(true);
      expect(FINISHES).toContain(m.finish);
      expect(lookFonts.has(m.font)).toBe(true);
      expect(lookPatterns.has(m.pattern)).toBe(true);
      // A mashup sets its whole pattern, so the tab wears exactly what the card shows.
      expect(m.patternOpacity).toBeGreaterThan(0);
      expect(m.patternOpacity).toBeLessThanOrEqual(1);
    }
  });

  it('never lands on a named look, so no look card lights up beside it', () => {
    const random = seeded(2);
    for (let i = 0; i < ROLLS; i++) {
      const m = rollMashup({ random });
      expect(activeLookId(lookSettings(m))).toBeUndefined();
    }
  });

  it('never repeats the mashup it replaces, so every press changes the tab', () => {
    const random = seeded(3);
    let previous = rollMashup({ random });
    for (let i = 0; i < ROLLS; i++) {
      const next = rollMashup({ random, previous });
      expect(
        lookMatches(lookSettings(next), previous) &&
          next.patternOpacity === previous.patternOpacity,
      ).toBe(false);
      previous = next;
    }
  });

  it('rolls within a chosen finish', () => {
    const random = seeded(4);
    for (const finish of FINISHES)
      for (let i = 0; i < 50; i++) expect(rollMashup({ random, finish }).finish).toBe(finish);
  });

  it('mixes widely: the rolls spread over every year-round theme and finish, never a seasonal one', () => {
    const random = seeded(5);
    const rolls = Array.from({ length: ROLLS * 4 }, () => rollMashup({ random }));
    const themes = new Set(rolls.map((m) => m.theme));
    expect(themes.size).toBe(THEMES.filter((t) => !t.seasonal).length);
    for (const t of THEMES.filter((t) => t.seasonal)) expect(themes.has(t.id), t.id).toBe(false);
    expect(new Set(rolls.map((m) => m.finish)).size).toBe(FINISHES.length);
    expect(MASHUP_COMBINATIONS).toBeGreaterThan(10_000);
  });

  it('names its four ingredients on the card, like a look does', () => {
    const m = rollMashup({ random: seeded(6) });
    const theme = THEMES.find((t) => t.id === m.theme)!.label;
    const pattern = PATTERNS.find((p) => p.id === m.pattern)!.label.toLowerCase();
    const font = FONTS.find((f) => f.id === m.font)?.label;
    const finish = m.finish.charAt(0).toUpperCase() + m.finish.slice(1);
    expect(m.description).toBe([theme, finish, font, pattern].filter(Boolean).join(', '));
  });

  it('gives up after MASHUP_REROLLS when the source keeps repeating', () => {
    // A stuck source rolls Everyday's ingredients every time: the roll still ends, after the bounded rerolls.
    let calls = 0;
    const stuck: Random = () => {
      calls++;
      return 0;
    };
    rollMashup({ random: stuck });
    expect(calls).toBe(4 * (MASHUP_REROLLS + 1));
  });
});
