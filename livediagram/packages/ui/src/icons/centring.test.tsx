import { centreOffsetPx } from '@livediagram/icons/centring';
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { IconProps } from './Glyph';
import * as icons from './index';

// Every shared chrome glyph's ink sits within 0.5px of its box centre at its default size
// (docs/specs/004-interface-design/iconography.md, "Guarding").
const TOLERANCE_PX = 0.5;

// Glyphs asymmetric by design, each with the reason it is allowed off-centre.
export const CENTRING_EXCEPTIONS: Record<string, string> = {
  // The tab-activity clock (the editor's history button): its rewind arrow leaves the dial at the
  // top left, so the ink leans that way by design; centring it would push the dial off-centre.
};

const ICONS = (Object.entries(icons) as [string, unknown][]).filter(
  (e): e is [string, ComponentType<IconProps>] =>
    e[0].endsWith('Icon') && typeof e[1] === 'function',
);

function offset(Icon: ComponentType<IconProps>) {
  const svg = renderToStaticMarkup(<Icon />);
  const units = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]);
  const size = Number(/width="([\d.]+)"/.exec(svg)![1]);
  // On-screen px (non-scaling) back to viewBox units for the geometry.
  const sw = (Number(/stroke-width="([\d.]+)"/.exec(svg)?.[1] ?? 0) * units) / size;
  return centreOffsetPx(svg, { units, sizePx: size, strokeUnits: sw });
}

describe('shared chrome glyph centring', () => {
  it('centres every glyph within tolerance, or names why not', () => {
    const off = ICONS.filter(([name]) => !CENTRING_EXCEPTIONS[name])
      .map(([name, Icon]) => ({ name, o: offset(Icon) }))
      .filter(({ o }) => o && (Math.abs(o.dx) > TOLERANCE_PX || Math.abs(o.dy) > TOLERANCE_PX))
      .map(({ name, o }) => `${name} dx=${o!.dx} dy=${o!.dy}`);
    expect(off).toEqual([]);
  });

  it('draws the check on the centre line of its box', () => {
    expect(offset(icons.CheckIcon)).toEqual({ dx: 0, dy: 0 });
  });

  it('lists only exceptions that still exist', () => {
    const names = new Set(ICONS.map(([n]) => n));
    expect(Object.keys(CENTRING_EXCEPTIONS).filter((n) => !names.has(n))).toEqual([]);
  });
});
