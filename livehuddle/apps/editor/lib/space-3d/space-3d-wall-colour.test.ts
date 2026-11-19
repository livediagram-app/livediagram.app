import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@livehuddle/document';
import { wallColourVars } from './space-3d-wall-colour';

// docs/specs/008-canvas/3d-view.md "Themes": a tab's walls in its colour, deeper in evening light, signs readable.
describe('wallColourVars', () => {
  it('keeps the plaster when unset or not a colour', () => {
    expect(wallColourVars(undefined, false)).toBeUndefined();
    expect(wallColourVars('red', false)).toBeUndefined();
  });

  it('paints the face, a darker shade and a lighter top', () => {
    const vars = wallColourVars('#D5E6D3', false)!;
    expect(vars['--space-wall']).toBe('#d5e6d3');
    expect(contrastRatio(vars['--space-wall-shade'], '#000000')).toBeLessThan(
      contrastRatio(vars['--space-wall'], '#000000'),
    );
    expect(contrastRatio(vars['--space-wall-top'], '#000000')).toBeGreaterThan(
      contrastRatio(vars['--space-wall'], '#000000'),
    );
  });

  it('takes the shade a third toward black and the top a quarter toward white, not past them', () => {
    const vars = wallColourVars('#ef4444', false)!;
    // A third darker: each channel at two thirds of the face's, so red stays red.
    expect(vars['--space-wall-shade']).toBe('#9f2d2d');
    expect(vars['--space-wall-top']).toBe('#f37373');
  });

  it('deepens the colour on a dark canvas, gently, so the hue stays recognisable', () => {
    const lightness = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return (Math.max(...c) + Math.min(...c)) / 2 / 255;
    };
    for (const color of ['#d5e6d3', '#ef4444', '#dc2626', '#1e293b', '#fafafa']) {
      const day = wallColourVars(color, false)!['--space-wall'];
      const evening = wallColourVars(color, true)!['--space-wall'];
      expect(contrastRatio(evening, '#000000'), color).toBeLessThan(contrastRatio(day, '#000000'));
      // Down a tenth of its lightness at most, and never more than 0.06 (plus a rounding step).
      const drop = lightness(day) - lightness(evening);
      expect(drop, color).toBeLessThanOrEqual(Math.min(lightness(day) / 10, 0.06) + 1 / 255);
    }
    // A red wall stays red in evening light: its red channel well above the others, nowhere near black.
    const red = wallColourVars('#ef4444', true)!;
    expect(red['--space-wall']).toBe('#d73d3d');
    expect(Number.parseInt(red['--space-wall-shade'].slice(1, 3), 16)).toBeGreaterThan(128);
    expect(wallColourVars('#000000', true)!['--space-wall']).toBe('#000000');
  });

  it('inks a sign dark on a light wall and light on a dark one, readable either way', () => {
    for (const color of ['#f5f5f4', '#1e293b', '#7c3aed', '#808080']) {
      for (const dark of [false, true]) {
        const vars = wallColourVars(color, dark)!;
        expect(
          contrastRatio(vars['--space-wall-ink'], vars['--space-wall']),
          `${color} ${dark}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
    expect(wallColourVars('#f5f5f4', false)!['--space-wall-ink']).toBe('#2b241d');
    expect(wallColourVars('#1e293b', false)!['--space-wall-ink']).toBe('#f7f3ec');
  });
});
