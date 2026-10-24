// A person node in the headless render (docs/specs/009-elements/org-chart.md): the initials disc, the name and the role,
// placed by the same `personNodeLayout` the canvas face uses. The box is the mind node's ordinary bordered one.

import { colorWash } from '@liveworkspace/document-core/color-wash';
import type { BoxedElement } from './index';
import { labelFontPx } from '@liveworkspace/document-core/label-font';
import { personInitials, personNodeLayout } from './person-node';
import { r2, xmlEscape } from './svg-render-primitives';
import { line as webLine } from './svg-render-web';

type Shape = BoxedElement & { type: 'shape' };

export function svgPersonNode(
  el: Shape,
  o: { stroke: string; labelColor: string; label: string; fontFamily?: string },
): string {
  const role = el.pageSubtitle?.trim() ?? '';
  const l = personNodeLayout(el.width, el.height, !!role);
  const r = l.disc.width / 2;
  const cx = el.x + l.disc.x + r;
  const cy = el.y + l.disc.y + r;
  let out =
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${xmlEscape(colorWash(o.stroke, 0.16))}"/>` +
    webLine(el, personInitials(o.label), l.disc, Math.round(r * 0.75), o.stroke, {
      bold: true,
      fontFamily: o.fontFamily,
    });
  out += webLine(el, o.label, l.name, Math.min(labelFontPx(el.textSize), 18), o.labelColor, {
    align: 'start',
    bold: true,
    fontFamily: o.fontFamily,
  });
  if (l.role && role)
    out += webLine(el, role, l.role, 12, o.labelColor, {
      align: 'start',
      opacity: 0.7,
      fontFamily: o.fontFamily,
    });
  return out;
}
