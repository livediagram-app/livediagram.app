// A Sankey diagram in the headless render (docs/specs/009-elements/sankey.md "Everywhere else it appears"):
// the same frame the canvas view draws from, so an export, a thumbnail and the canvas show one diagram. The
// hover readouts and the motion are the canvas's alone.

import type { BoxedElement, ShapeElement } from './index';
import { chartTextInk } from './chart-ink';
import {
  SANKEY_BAND_OPACITY,
  sankeyFrame,
  sankeyLabelHalo,
  type SankeyLabel,
} from './sankey-frame';
import { r2, xmlEscape } from './svg-render-primitives';

type Sankey = BoxedElement & { type: 'shape' };

// An id for a gradient that cannot collide with another element's in the same export.
const gradientId = (el: Sankey, i: number) => `lvd-sk-${el.id.replace(/[^\w-]/g, '_')}-${i}`;

function svgLabel(
  el: Sankey,
  l: SankeyLabel,
  fontPx: number,
  textColor: string,
  font: string,
): string {
  const x = r2(el.x + l.x);
  const y = el.y + l.y;
  const halo = ` stroke="${sankeyLabelHalo(textColor)}" stroke-width="3" stroke-opacity="0.75" stroke-linejoin="round" paint-order="stroke"`;
  const common = `x="${x}" text-anchor="${l.anchor}"${font} fill="${xmlEscape(textColor)}"${halo}`;
  const name = xmlEscape(l.name);
  const detail = xmlEscape(l.detail);
  if (!l.detail)
    return `<text ${common} y="${r2(y)}" font-size="${fontPx}" font-weight="600" dominant-baseline="central">${name}</text>`;
  if (l.inline)
    return `<text ${common} y="${r2(y)}" font-size="${fontPx}" dominant-baseline="central"><tspan font-weight="600">${name}</tspan><tspan fill-opacity="0.72"> ${detail}</tspan></text>`;
  const gap = fontPx * 0.6;
  return (
    `<text ${common} y="${r2(y - gap)}" font-size="${fontPx}" font-weight="600" dominant-baseline="central">${name}</text>` +
    `<text ${common} y="${r2(y + gap)}" font-size="${r2(fontPx * 0.92)}" fill-opacity="0.72" dominant-baseline="central">${detail}</text>`
  );
}

/** A Sankey diagram: its bands, then its nodes, then their labels over both. */
export function svgSankey(
  el: Sankey,
  labelColor: string,
  palette?: readonly string[],
  fontFamily?: string,
  // What the diagram sits on (chartPageGrounds): its nodes and names drawn adapted to it.
  ground?: readonly string[],
): string {
  const textColor = chartTextInk(labelColor, ground);
  const f = sankeyFrame(el as ShapeElement, palette, ground);
  const font = fontFamily ? ` font-family="${xmlEscape(fontFamily)}"` : '';
  if (f.layout.links.length === 0) {
    // The empty state, as the canvas draws it for someone who cannot edit: an outline and a line of text.
    return (
      `<rect x="${r2(el.x + 1)}" y="${r2(el.y + 1)}" width="${r2(f.w - 2)}" height="${r2(f.h - 2)}" rx="8" fill="none" stroke="${xmlEscape(textColor)}" stroke-opacity="0.3" stroke-dasharray="6 4"/>` +
      `<text x="${r2(el.x + f.w / 2)}" y="${r2(el.y + f.h / 2)}" text-anchor="middle" dominant-baseline="central"${font} font-size="${f.fontPx}" fill="${xmlEscape(textColor)}" fill-opacity="0.6">No flows yet</text>`
    );
  }
  const defs: string[] = [];
  const bands = f.layout.links
    .map((b, i) => {
      const paint = f.bandPaint(b);
      let fill: string;
      if (paint.kind === 'gradient') {
        // userSpaceOnUse is the referencing band's space, the translated group below: element coordinates.
        const id = gradientId(el, i);
        defs.push(
          `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r2(b.x0)}" y1="0" x2="${r2(b.x1)}" y2="0">` +
            `<stop offset="0" stop-color="${xmlEscape(paint.from)}"/><stop offset="1" stop-color="${xmlEscape(paint.to)}"/></linearGradient>`,
        );
        fill = `url(#${id})`;
      } else fill = xmlEscape(paint.color);
      return `<path d="${b.path}" fill="${fill}" fill-opacity="${SANKEY_BAND_OPACITY}"/>`;
    })
    .join('');
  const nodes = f.layout.nodes
    .map(
      (n) =>
        `<rect x="${r2(el.x + n.x0)}" y="${r2(el.y + n.y0)}" width="${r2(n.x1 - n.x0)}" height="${r2(Math.max(1, n.y1 - n.y0))}" rx="2" fill="${xmlEscape(f.nodeColor(n.index))}"/>`,
    )
    .join('');
  const labels = f.labels
    .filter((l) => !l.hidden)
    .map((l) => svgLabel(el, l, f.fontPx, textColor, font))
    .join('');
  // The bands' paths are in the element's own space; one translate puts them on the page.
  return (
    (defs.length > 0 ? `<defs>${defs.join('')}</defs>` : '') +
    `<g transform="translate(${r2(el.x)} ${r2(el.y)})">${bands}</g>` +
    nodes +
    labels
  );
}
