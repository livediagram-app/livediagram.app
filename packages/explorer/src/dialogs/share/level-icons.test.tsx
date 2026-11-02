import { centreOffsetPx } from '@liveworkspace/icons/centring';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LEVEL_PASS } from './parts';

// Each level's glyph sits centred in the role picker's tile and the pass's band: ink within 0.5px of
// the box centre (docs/specs/004-interface-design/iconography.md, "Guarding"). The tile centres the
// svg, so an off-centre drawing is what the apps' optical ink audit sees in the Share dialog.
describe('share level glyphs', () => {
  it.each(Object.entries(LEVEL_PASS))('%s is centred', (_level, pass) => {
    const svg = renderToStaticMarkup(<pass.Icon />);
    const units = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]);
    const size = Number(/width="([\d.]+)"/.exec(svg)![1]);
    const sw = Number(/stroke-width="([\d.]+)"/.exec(svg)![1]);
    const off = centreOffsetPx(svg, { units, sizePx: size, strokeUnits: sw })!;
    expect(Math.abs(off.dx)).toBeLessThanOrEqual(0.25);
    expect(Math.abs(off.dy)).toBeLessThanOrEqual(0.25);
  });
});
