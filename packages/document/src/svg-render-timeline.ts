// A Timeline in the headless render (docs/specs/009-elements/concept-graphics.md "Timeline"), from the same layout the
// canvas face uses: the spine and its arrowhead in the accent, each milestone a dot in the ramp ringed in the fill so
// it sits clear of the spine, a stem out to its when (in the accent) and its name (in the ink). The rest frame.

import { arrowheadPoints, conceptFitPx, type ConceptRow } from './concept';
import { timelineLayout } from './concept-timeline';
import type { BoxedElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';
import { line as webLine } from './svg-render-web';

type Shape = BoxedElement & { type: 'shape' };

export function svgTimeline(
  el: Shape,
  rows: readonly ConceptRow[],
  ramp: readonly { fill: string; text: string }[],
  o: { stroke: string; fill: string; labelColor: string; fontFamily?: string },
): string {
  const l = timelineLayout(el.width, el.height, rows.length);
  const at = (x: number, y: number) => ({ x: el.x + x, y: el.y + y });
  const spine =
    `<line x1="${r2(el.x + l.spine.x1)}" y1="${r2(el.y + l.spine.y)}" x2="${r2(el.x + l.spine.x2)}" y2="${r2(el.y + l.spine.y)}"` +
    ` stroke="${xmlEscape(o.stroke)}" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round"/>` +
    `<polygon points="${arrowheadPoints(at(l.head.tip.x, l.head.tip.y), 0, l.head.size)}" fill="${xmlEscape(o.stroke)}"/>`;
  const milestones = rows
    .map((row, i) => {
      const m = l.milestones[i]!;
      let out =
        `<line x1="${r2(el.x + m.dot.x)}" y1="${r2(el.y + m.stem.y1)}" x2="${r2(el.x + m.dot.x)}" y2="${r2(el.y + m.stem.y2)}"` +
        ` stroke="${xmlEscape(o.stroke)}" stroke-opacity="0.5" stroke-width="1.5"/>` +
        `<circle cx="${r2(el.x + m.dot.x)}" cy="${r2(el.y + m.dot.y)}" r="${r2(l.dotR)}" fill="${xmlEscape(ramp[i]!.fill)}"` +
        ` stroke="${xmlEscape(o.fill)}" stroke-width="3"/>`;
      if (row.note)
        out += webLine(
          el,
          row.note,
          m.note,
          conceptFitPx(row.note, m.note.width, l.notePx),
          o.stroke,
          {
            bold: true,
            fontFamily: o.fontFamily,
          },
        );
      out += webLine(
        el,
        row.label,
        m.label,
        conceptFitPx(row.label, m.label.width, l.labelPx),
        o.labelColor,
        { bold: true, fontFamily: o.fontFamily },
      );
      return out;
    })
    .join('');
  return spine + milestones;
}
