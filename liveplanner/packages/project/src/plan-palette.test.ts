import { PLAN_PRESET_HUES } from './plan-presets';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import {
  accentOn,
  chipInkOn,
  liftAccent,
  planPalette,
  PLAN_BORDER_ACCENT_SHARE,
  PLAN_CHIP_TINT,
} from './plan-palette';
import { canvasSurface } from './colors';
import { THEMES } from './themes-data';
import { themeHalf } from './theme-halves';
import { mixHex } from './svg-render-face-kit';

// docs/specs/026-plan/plan-board.md "Theme and style".
describe('planPalette', () => {
  it('is the surface neutral set for a board with no colours of its own', () => {
    expect(planPalette('light').surface).toBe('#f8fafc');
    expect(planPalette('dark').surface).toBe('#111827');
    expect(planPalette('light', { fill: null, stroke: undefined })).toEqual(planPalette('light'));
  });

  it("takes a board's fill, stroke and text, mixing columns and cards from them", () => {
    const p = planPalette('light', { fill: '#fef3c7', stroke: '#b45309', text: '#451a03' });
    expect(p.surface).toBe('#fef3c7');
    // The border is the accent mixed into the paper (quiet lines); focus keeps the full accent, leaned a step toward
    // the ink where it would not read as text on the column (#b45309 is 4.4:1 there).
    expect(p.border).toBe(mixHex('#b45309', '#fef3c7', PLAN_BORDER_ACCENT_SHARE));
    expect(p.focus).not.toBe('#b45309');
    expect(contrastRatio(p.focus, p.column)).toBeGreaterThanOrEqual(4.5);
    expect(p.text).toBe('#451a03');
    expect(p.column).not.toBe(p.surface);
    expect(p.card).not.toBe(p.surface);
  });

  it('swaps ink that would not read on the fill for a readable one', () => {
    const p = planPalette('light', { fill: '#1e1b4b', text: '#1e293b' });
    expect(contrastRatio(p.text, p.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('ignores a colour it cannot read', () => {
    expect(planPalette('light', { fill: 'transparent' })).toEqual(planPalette('light'));
  });
});

describe('type accents on dark surfaces', () => {
  it('lifts an accent too dark to see, and leaves the rest', () => {
    expect(contrastRatio(liftAccent('#18181b'), '#0f172a')).toBeGreaterThanOrEqual(3);
    expect(liftAccent('#eab308')).toBe('#eab308');
    expect(accentOn('#18181b', planPalette('light'))).toBe('#18181b');
    expect(
      contrastRatio(accentOn('#18181b', planPalette('dark')), '#0f172a'),
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps muted words at WCAG AA on the column, a card and the board, plain or in any preset', () => {
    // At 62% of the ink every preset's muted text fell to about 3.8:1 (light) and 4.2:1 (dark), and the plain
    // light set's slate 500 to 4.3:1 on its column.
    for (const surface of ['light', 'dark'] as const)
      for (const preset of [undefined, ...PLAN_PRESET_HUES.map((h) => h.id)]) {
        const p = planPalette(surface, preset ? { preset } : {});
        for (const fill of [p.column, p.card, p.surface])
          expect(
            contrastRatio(p.muted, fill),
            `${surface} ${preset ?? 'plain'} on ${fill}`,
          ).toBeGreaterThanOrEqual(4.5);
      }
  });
});

// docs/specs/026-plan/plan-board.md "Theme and style": every theme reads on a board, light and dark. Before the guards
// a dark theme's cards sat 1.1:1 on their list, Pine's type accents fell to 1.3:1 on its card and Pastel's accent to
// 2.8:1 on its column.
describe('every theme on a board', () => {
  const ACCENTS = [
    '#18181b',
    '#71717a',
    '#2563eb',
    '#eab308',
    '#dc2626',
    '#16a34a',
    '#d97706',
    '#db2777',
  ];
  for (const theme of THEMES)
    for (const appearance of ['light', 'dark'] as const) {
      const half = themeHalf(theme, appearance);
      const surface = canvasSurface(half.backgroundColor);
      const p = planPalette(surface, {
        fill: half.elementFill,
        stroke: half.elementStroke,
        text: half.elementText,
      });
      it(`${theme.id} (${appearance}) keeps its words, accents and cards readable`, () => {
        for (const fill of [p.column, p.card, p.surface]) {
          expect(contrastRatio(p.text, fill)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(p.muted, fill)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(p.focus, fill)).toBeGreaterThanOrEqual(4.5);
        }
        // The neutral light set's white card on its slate list is 1.1:1, the least any theme gives.
        expect(contrastRatio(p.card, p.column)).toBeGreaterThanOrEqual(1.09);
        // The neutral light set's card edge is 1.23:1; a theme's is held at 1.3:1.
        expect(contrastRatio(p.cardBorder, p.card)).toBeGreaterThanOrEqual(1.2);
        for (const colour of ACCENTS) {
          expect(contrastRatio(accentOn(colour, p), p.card)).toBeGreaterThanOrEqual(3);
          const ink = chipInkOn(colour, p);
          expect(contrastRatio(ink, mixHex(ink, p.card, PLAN_CHIP_TINT))).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      });
    }

  it('keeps an accent that already reads as chosen', () => {
    const p = planPalette('light');
    expect(accentOn('#2563eb', p)).toBe('#2563eb');
    expect(chipInkOn('#1d4ed8', p)).toBe('#1d4ed8');
  });

  it('leaves a colour it cannot read, and falls back to the ink where nothing reads', () => {
    expect(chipInkOn('transparent', planPalette('light'))).toBe('transparent');
    expect(accentOn('#2563eb', { card: 'transparent' })).toBe('#2563eb');
    expect(chipInkOn('#777777', { card: '#777777', text: '#777777' })).toBe('#777777');
  });
});
