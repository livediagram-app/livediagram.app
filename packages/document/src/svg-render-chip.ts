// A badge or step number's body in the headless render (docs/specs/009-elements/badge.md): the pill or disc in its
// look. The label draws over it through the ordinary label path, in the look's text colour (svg-render-describe).

import { chipColours, chipLookOf } from './chip';
import type { BoxedElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';

export function svgChip(
  el: BoxedElement & { type: 'shape' },
  o: { stroke: string; fill: string; ink: string },
): string {
  const c = chipColours(chipLookOf(el), { accent: o.stroke, surface: o.fill, ink: o.ink });
  const rx = Math.min(el.width, el.height) / 2;
  const border = c.border ? ` stroke="${xmlEscape(c.border)}" stroke-width="1.5"` : '';
  const inset = c.border ? 0.75 : 0;
  const ground = c.base
    ? `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="${r2(rx)}" fill="${xmlEscape(c.base)}"/>`
    : '';
  return (
    ground +
    `<rect x="${r2(el.x + inset)}" y="${r2(el.y + inset)}" width="${r2(el.width - inset * 2)}" height="${r2(el.height - inset * 2)}"` +
    ` rx="${r2(rx - inset)}" fill="${xmlEscape(c.fill)}"${border}/>`
  );
}
