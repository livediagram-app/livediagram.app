// A concept graphic in the headless render (docs/specs/009-elements/concept-graphics.md): its rows in the accent ramp,
// placed from the same layouts the canvas face uses. The rest frame: every row shown, no animation.

import {
  arrowheadPoints,
  chevronLayout,
  conceptDrawsNotes,
  conceptFitPx,
  cycleLayout,
  hubDrawsSpokes,
  hubLayout,
  layerStackLayout,
  onionLayout,
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
  if (n === 0 && el.shape !== 'cycle' && el.shape !== 'hub') return '';
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
  if (el.shape === 'hub') {
    // Spokes under the discs, the hub solid in the accent, the satellites the fill ringed in the accent.
    const l = hubLayout(el.width, el.height, n);
    const spokes = hubDrawsSpokes(el)
      ? l.spokes
          // One spoke per satellite drawn: the layout keeps one even for a hub with no rows, which the canvas draws bare.
          .slice(0, rows.length)
          .map(
            (sp) =>
              `<line x1="${r2(el.x + sp.x1)}" y1="${r2(el.y + sp.y1)}" x2="${r2(el.x + sp.x2)}" y2="${r2(el.y + sp.y2)}"` +
              ` stroke="${xmlEscape(o.stroke)}" stroke-opacity="0.5" stroke-width="2"/>`,
          )
          .join('')
      : '';
    const hub =
      `<circle cx="${r2(el.x + l.centre.x)}" cy="${r2(el.y + l.centre.y)}" r="${r2(l.hubR)}" fill="${xmlEscape(o.stroke)}"/>` +
      webLabel(el, o.label, l.hubLabel, ramp[0]?.text ?? o.labelColor, fontFamily);
    const sats = rows
      .map((row, i) => {
        const d = l.satellites[i]!;
        const rect = {
          x: d.x - l.satR + 2,
          y: d.y - l.satR,
          width: Math.max(0, l.satR * 2 - 4),
          height: l.satR * 2,
        };
        return (
          `<circle cx="${r2(el.x + d.x)}" cy="${r2(el.y + d.y)}" r="${r2(l.satR)}" fill="${xmlEscape(o.fill)}"` +
          ` stroke="${xmlEscape(o.stroke)}" stroke-width="2"/>` +
          webLine(
            el,
            row.label,
            rect,
            conceptFitPx(row.label, rect.width, l.labelPx),
            o.labelColor,
            {
              bold: true,
              fontFamily,
            },
          )
        );
      })
      .join('');
    return spokes + hub + sats;
  }
  if (el.shape === 'onion') {
    // Outermost ring first, so each smaller one sits on top; the core is the accent, the rings step down the ramp.
    const l = onionLayout(el.width, el.height, n);
    const discs = l.radii
      .map((R, k) => ({ R, k }))
      .reverse()
      .map(
        ({ R, k }) =>
          `<circle cx="${r2(el.x + l.centre.x)}" cy="${r2(el.y + l.centre.y)}" r="${r2(R)}" fill="${xmlEscape(ramp[k]!.fill)}"/>`,
      )
      .join('');
    const labels = rows
      .map((row, k) => {
        const rect = l.labels[k]!;
        return webLine(
          el,
          row.label,
          rect,
          conceptFitPx(row.label, rect.width, l.labelPx),
          ramp[k]!.text,
          {
            bold: true,
            fontFamily,
          },
        );
      })
      .join('');
    return discs + labels;
  }
  if (el.shape === 'chevrons') {
    const notes = rows.some((r) => !!r.note);
    const l = chevronLayout(el.width, el.height, n, notes);
    return rows
      .map((row, i) => {
        const st = l.stages[i]!;
        const points = st.points.map((pt) => `${r2(el.x + pt.x)},${r2(el.y + pt.y)}`).join(' ');
        let out =
          `<polygon points="${points}" fill="${xmlEscape(ramp[i]!.fill)}" stroke-linejoin="round"/>` +
          webLine(
            el,
            row.label,
            st.label,
            conceptFitPx(row.label, st.label.width, l.labelPx),
            ramp[i]!.text,
            {
              bold: true,
              fontFamily,
            },
          );
        if (st.note && row.note)
          out += webLine(
            el,
            row.note,
            st.note,
            conceptFitPx(row.note, st.note.width, l.notePx),
            o.labelColor,
            {
              opacity: 0.7,
              fontFamily,
            },
          );
        return out;
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
