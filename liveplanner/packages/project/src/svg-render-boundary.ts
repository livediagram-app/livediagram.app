// A boundary's body in the headless render (docs/specs/009-elements/boundary.md): its tint, then its title (in a tab on the top edge, inside the corner, or C4's bottom-left) with its icon and meta line,
// placed from the same boundaryLayout the canvas face uses. The border is the ordinary box svgBoxed draws.

import { BOUNDARY_TINT, boundaryLayout, boundaryStyleOf } from './boundary';
import { colorWash } from './color-wash';
import { labelOn } from './readable-colour';
import type { BoxedElement } from './index';
import { borderOf } from './svg-render-border';
import type { ResolveIconArt } from './svg-render-describe';
import { r2, svgIconGlyph as glyph, xmlEscape } from './svg-render-primitives';
import { line as webLine } from './svg-render-web';

type Shape = BoxedElement & { type: 'shape' };

export function svgBoundary(
  el: Shape,
  o: {
    stroke: string;
    labelColor: string;
    label: string;
    fontFamily?: string;
    resolveIconArt?: ResolveIconArt;
  },
): string {
  const style = boundaryStyleOf(el);
  const art = style !== 'c4' && el.iconId ? o.resolveIconArt?.(el.iconId) : undefined;
  const l = boundaryLayout(el.width, el.height, {
    style,
    icon: !!art,
    titleChars: o.label.length,
    meta: !!el.pageSubtitle,
  });
  let out = '';
  if (!el.fillColor) {
    const b = borderOf(el);
    out += `<rect x="${r2(el.x + b.width / 2)}" y="${r2(el.y + b.width / 2)}" width="${r2(Math.max(0, el.width - b.width))}" height="${r2(Math.max(0, el.height - b.width))}" rx="${r2(Math.max(0, b.radius - b.width / 2))}" fill="${xmlEscape(colorWash(o.stroke, BOUNDARY_TINT))}"/>`;
  }
  const onTab = labelOn(o.stroke);
  if (l.tab)
    out += `<rect x="${r2(el.x + l.tab.x)}" y="${r2(el.y + l.tab.y)}" width="${r2(l.tab.width)}" height="${r2(l.tab.height)}" rx="6" fill="${xmlEscape(o.stroke)}"/>`;
  if (art && l.icon) out += glyph(el, art, l.icon, l.tab ? onTab : o.stroke);
  const titleColour = l.tab ? onTab : style === 'inset' ? o.stroke : o.labelColor;
  out += webLine(el, o.label, l.title, l.titlePx, titleColour, {
    align: 'start',
    bold: true,
    fontFamily: o.fontFamily,
  });
  if (l.meta && el.pageSubtitle) {
    const meta = style === 'c4' ? `[${el.pageSubtitle}]` : el.pageSubtitle;
    out += webLine(el, meta, l.meta, l.metaPx, o.labelColor, {
      align: 'start',
      opacity: 0.7,
      fontFamily: o.fontFamily,
    });
  }
  return out;
}
