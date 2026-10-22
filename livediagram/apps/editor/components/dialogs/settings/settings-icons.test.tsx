import { centreOffsetPx } from '@livediagram/icons/centring';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CATEGORY_GLYPHS } from './settings-icons';

// Each Settings category glyph sits centred in its tile: ink within 0.5px of the box centre
// (docs/specs/004-interface-design/iconography.md, "Guarding"). The tile centres the svg, so an
// off-centre drawing is what the optical ink audit sees.
describe('settings category glyphs', () => {
  it.each(Object.entries(CATEGORY_GLYPHS))('%s is centred', (_id, node) => {
    const svg = renderToStaticMarkup(<>{node}</>);
    const units = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]);
    const size = Number(/width="([\d.]+)"/.exec(svg)![1]);
    const px = Number(/stroke-width="([\d.]+)"/.exec(svg)![1]);
    const off = centreOffsetPx(svg, { units, sizePx: size, strokeUnits: (px * units) / size })!;
    expect(Math.abs(off.dx)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(off.dy)).toBeLessThanOrEqual(0.5);
  });
});
