// A diagram key in the headless render (docs/specs/009-elements/diagram-key.md): its title and each stored row, a
// swatch (a short arrow in the row's pattern, or a card edge in the tag's colour) beside the row's meaning, placed by
// the same `diagramKeyLayout` the canvas face uses. The box is the ordinary bordered shape's, drawn by the caller.

import { BORDER_DASH_ARRAY, type BorderStyle } from '@liveworkspace/document-core/border-style';
import { KEY_EMPTY_HINT, diagramKeyLayout, meaningOf } from './diagram-key';
import type { BoxedElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';
import { line as webLine } from './svg-render-web';

type Shape = BoxedElement & { type: 'shape' };

export function svgDiagramKey(
  el: Shape,
  o: { stroke: string; fill: string; labelColor: string; label: string; fontFamily?: string },
): string {
  const rows = el.keyRows ?? [];
  const l = diagramKeyLayout(el.width, rows.length);
  const ink = xmlEscape(o.labelColor);
  let out = webLine(el, o.label, l.title, 13, o.labelColor, {
    align: 'start',
    bold: true,
    fontFamily: o.fontFamily,
  });
  if (rows.length === 0)
    return (
      out +
      webLine(el, KEY_EMPTY_HINT, l.rows[0]!.meaning, 11, o.labelColor, {
        align: 'start',
        opacity: 0.55,
        fontFamily: o.fontFamily,
      })
    );
  rows.forEach((row, i) => {
    const { swatch: s, meaning } = l.rows[i]!;
    const x = el.x + s.x;
    const y = el.y + s.y;
    if (row.kind === 'line') {
      const dash = BORDER_DASH_ARRAY[(row.style ?? 'solid') as BorderStyle];
      const midY = r2(y + s.height / 2);
      out +=
        `<line x1="${r2(x)}" y1="${midY}" x2="${r2(x + s.width - 6)}" y2="${midY}" stroke="${ink}" stroke-width="1.5"` +
        (dash ? ` stroke-dasharray="${dash}"` : '') +
        '/>' +
        `<polygon points="${r2(x + s.width)},${midY} ${r2(x + s.width - 7)},${r2(y + s.height / 2 - 4)} ${r2(x + s.width - 7)},${r2(y + s.height / 2 + 4)}" fill="${ink}"/>`;
    } else {
      out +=
        `<rect x="${r2(x)}" y="${r2(y)}" width="${s.width}" height="${s.height}" rx="3" fill="${xmlEscape(o.fill)}" stroke="${xmlEscape(o.stroke)}" stroke-opacity="0.4"/>` +
        `<rect x="${r2(x)}" y="${r2(y)}" width="4" height="${s.height}" fill="${xmlEscape(row.color ?? o.stroke)}"/>`;
    }
    out += webLine(el, meaningOf(el, row), meaning, 12, o.labelColor, {
      align: 'start',
      fontFamily: o.fontFamily,
    });
  });
  return out;
}
