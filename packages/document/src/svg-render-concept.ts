// A concept graphic in the headless render (docs/specs/009-elements/concept-graphics.md): its rows in the accent ramp,
// placed from the same layouts the canvas face uses. The rest frame: every row shown, no animation.

import {
  arrowheadPoints,
  conceptDrawsNotes,
  conceptFitPx,
  cycleLayout,
  layerStackLayout,
  pyramidLayout,
  pyramidVariantOf,
} from './concept';
import { conceptRamp } from './concept-ramp';
import type { BoxedElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';
import { line as webLine, label as webLabel } from './svg-render-web';

type Shape = BoxedElement & { type: 'shape' };

export function svgConcept(
  el: Shape,
  o: { stroke: string; fill: string; labelColor: string; label: string; fontFamily?: string },
): string {
  const rows = el.conceptRows ?? [];
  const n = rows.length;
  if (n === 0 && el.shape !== 'cycle') return '';
  const ramp = conceptRamp(n, o.stroke, o.fill);
  const fontFamily = o.fontFamily;
  if (el.shape === 'layer-stack') {
    const l = layerStackLayout(
      el.width,
      el.height,
      n,
      rows.some((r) => !!r.note),
    );
    return rows
      .map((row, i) => {
        const b = l.bands[i]!;
        const labelRect = {
          x: b.x + 14,
          y: b.y,
          width: Math.max(0, b.width - 28),
          height: b.height,
        };
        let out =
          `<rect x="${r2(el.x + b.x)}" y="${r2(el.y + b.y)}" width="${r2(b.width)}" height="${r2(b.height)}" rx="8"` +
          ` fill="${xmlEscape(ramp[i]!.fill)}"/>` +
          webLine(
            el,
            row.label,
            labelRect,
            conceptFitPx(row.label, labelRect.width, l.labelPx),
            ramp[i]!.text,
            {
              align: 'start',
              bold: true,
              fontFamily,
            },
          );
        const note = l.notes[i];
        const rule = l.rules[i];
        if (note && rule && row.note) {
          out +=
            `<line x1="${r2(el.x + rule.x1)}" y1="${r2(el.y + rule.y)}" x2="${r2(el.x + rule.x2)}" y2="${r2(el.y + rule.y)}"` +
            ` stroke="${xmlEscape(o.labelColor)}" stroke-opacity="0.35" stroke-width="1"/>` +
            webLine(
              el,
              row.note,
              note,
              conceptFitPx(row.note, note.width, l.notePx),
              o.labelColor,
              {
                align: 'start',
                opacity: 0.7,
                fontFamily,
              },
            );
        }
        return out;
      })
      .join('');
  }
  if (el.shape === 'pyramid') {
    const variant = pyramidVariantOf(el);
    const l = pyramidLayout(el.width, el.height, n, variant);
    const notes = conceptDrawsNotes(el);
    return rows
      .map((row, i) => {
        const t = l.tiers[i]!;
        const points = t.points.map((p) => `${r2(el.x + p.x)},${r2(el.y + p.y)}`).join(' ');
        const text = notes && row.note ? `${row.label}  ${row.note}` : row.label;
        return (
          `<polygon points="${points}" fill="${xmlEscape(ramp[i]!.fill)}" stroke-linejoin="round"/>` +
          webLine(el, text, t.label, conceptFitPx(text, t.label.width, l.labelPx), ramp[i]!.text, {
            bold: true,
            fontFamily,
          })
        );
      })
      .join('');
  }
  // Cycle: arcs under the discs, the first disc solid in the accent, the rest the fill ringed in the accent.
  const l = cycleLayout(el.width, el.height, n);
  const head = Math.min(10, Math.max(6, l.discR * 0.14));
  const arcs = l.arcs
    .map(
      (a) =>
        `<path d="${a.d}" transform="translate(${r2(el.x)} ${r2(el.y)})" fill="none" stroke="${xmlEscape(o.stroke)}" stroke-width="2" stroke-linecap="round"/>` +
        `<polygon points="${arrowheadPoints({ x: el.x + a.end.x, y: el.y + a.end.y }, a.angle, head)}" fill="${xmlEscape(o.stroke)}"/>`,
    )
    .join('');
  const discs = rows
    .map((row, i) => {
      const d = l.discs[i]!;
      const first = i === 0;
      const rect = {
        x: d.x - l.discR + 4,
        y: d.y - l.discR,
        width: Math.max(0, l.discR * 2 - 8),
        height: l.discR * 2,
      };
      return (
        `<circle cx="${r2(el.x + d.x)}" cy="${r2(el.y + d.y)}" r="${r2(l.discR)}" fill="${xmlEscape(first ? o.stroke : o.fill)}"` +
        (first ? '' : ` stroke="${xmlEscape(o.stroke)}" stroke-width="2"`) +
        '/>' +
        webLine(
          el,
          row.label,
          rect,
          conceptFitPx(row.label, rect.width, l.labelPx),
          first ? ramp[0]!.text : o.labelColor,
          {
            bold: true,
            fontFamily,
          },
        )
      );
    })
    .join('');
  return arcs + discs + webLabel(el, o.label, l.centreLabel, o.labelColor, fontFamily);
}
