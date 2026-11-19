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

  it('deepens the colour on a dark canvas', () => {
    const day = wallColourVars('#d5e6d3', false)!['--space-wall'];
    const evening = wallColourVars('#d5e6d3', true)!['--space-wall'];
    expect(contrastRatio(evening, '#000000')).toBeLessThan(contrastRatio(day, '#000000'));
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
