// The patterned rugs (docs/specs/009-elements/office.md "Rug types"): each drawn to its own size, its border bands and
// pattern keeping their thickness however big the rug, its stripes, rows and diamonds repeating to fill it rather than
// stretching. Woven in the rug's own fill: tints of the stroke, a white sheen, and a few dyes half seen through, so a
// recoloured rug keeps its pattern and one on dark paper reads as one on light. The Oval keeps its OFFICE_ART drawing.
// Shared by the canvas (PieceArt) and the export (svg-render-faces). Pure.

import { ellipse, path, rect } from './furniture-parts';
import { pieceVariant } from './piece-variants';
import type { FurniturePart } from './seating';

// The dyes the patterned rugs are woven with, each half seen through the rug's fill.
const DYE = {
  crimson: '#9f1239',
  navy: '#1e3a8a',
  terracotta: '#c2410c',
  teal: '#0f766e',
  sage: '#4d7c0f',
  gold: '#ca8a04',
} as const;

// No pattern repeats more than this many times however big the rug, so a huge one stays a few hundred parts.
const MAX_REPEATS = 48;

const r2 = (v: number) => Math.round(v * 100) / 100;

/** How many `step`-wide repeats fit in `length` (at least one, at most MAX_REPEATS). */
function repeats(length: number, step: number): number {
  return Math.max(1, Math.min(MAX_REPEATS, Math.floor(length / step)));
}

/** A diamond centred on (cx, cy), `rx` across and `ry` up. */
function diamond(cx: number, cy: number, rx: number, ry: number): string {
  return `M${r2(cx)} ${r2(cy - ry)}L${r2(cx + rx)} ${r2(cy)}L${r2(cx)} ${r2(cy + ry)}L${r2(cx - rx)} ${r2(cy)}Z`;
}

/** A fringe of short threads off a rug's left and right ends. */
function fringe(w: number, h: number, inset: number): FurniturePart {
  const n = repeats(h - 2 * inset, 6);
  const gap = (h - 2 * inset) / n;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const y = r2(inset + i * gap);
    d += `M-6 ${y}H0M${r2(w)} ${y}H${r2(w + 6)}`;
  }
  return path('rail', d);
}

/** Whether a rug is drawn by `rugParts` (every type but the Oval, which keeps its scaled OFFICE_ART drawing). */
export function rugDrawnToSize(el: { shape: string; variant?: unknown }): boolean {
  return el.shape === 'rug' && pieceVariant(el) !== 'oval';
}

/** A patterned rug's parts in its own px (0..width, 0..height); none for the Oval. */
export function rugParts(width: number, height: number, variant: unknown): FurniturePart[] {
  const w = Math.max(8, width);
  const h = Math.max(8, height);
  const type = pieceVariant({ shape: 'rug', variant });
  switch (type) {
    case 'round':
      return roundRug(w, h);
    case 'bordered':
      return [
        rect('panel', 0, 0, w, h, 4),
        rect('tint', 6, 6, w - 12, h - 12, 3),
        rect('floor', 18, 18, w - 36, h - 36, 2),
        rect('rail', 23, 23, w - 46, h - 46, 2),
        rect('sheen', 9, 9, w - 18, 3, 1.5),
        rect('sheen', 9, h - 12, w - 18, 3, 1.5),
      ];
    case 'runner':
      return runnerRug(w, h);
    case 'striped':
      return stripedRug(w, h);
    case 'persian':
      return persianRug(w, h);
    case 'kilim':
      return kilimRug(w, h);
    case 'doormat':
      return doormat(w, h);
    default:
      return [];
  }
}

// A circle with a braided border (alternating tints round it) and rings to a sage middle.
function roundRug(w: number, h: number): FurniturePart[] {
  const cx = w / 2;
  const cy = h / 2;
  const ring = (inset: number) => [r2(cx), r2(cy), r2(cx - inset), r2(cy - inset)] as const;
  return [
    ellipse('panel', ...ring(1)),
    ellipse('tint', ...ring(4)),
    ellipse('floor', ...ring(11)),
    ellipse('rail', ...ring(7.5)),
    ellipse('sheen', ...ring(16)),
    ellipse('floor', ...ring(20)),
    ellipse('dye', r2(cx), r2(cy), r2((cx - 20) * 0.62), r2((cy - 20) * 0.62), DYE.sage),
    ellipse('floor', r2(cx), r2(cy), r2((cx - 20) * 0.48), r2((cy - 20) * 0.48)),
    ellipse('rail', r2(cx), r2(cy), r2((cx - 20) * 0.3), r2((cy - 20) * 0.3)),
    ellipse('tint', r2(cx), r2(cy), r2((cx - 20) * 0.14), r2((cy - 20) * 0.14)),
  ];
}

// A long narrow rug: banded ends, a row of small diamonds down the middle and a fringe.
function runnerRug(w: number, h: number): FurniturePart[] {
  const band = Math.min(28, w / 6);
  const parts: FurniturePart[] = [
    fringe(w, h, 6),
    rect('panel', 0, 0, w, h, 3),
    rect('tint', 4, 4, r2(band), h - 8, 2),
    rect('tint', r2(w - 4 - band), 4, r2(band), h - 8, 2),
    rect('sheen', r2(band / 2), 4, 3, h - 8, 1.5),
    rect('sheen', r2(w - band / 2 - 3), 4, 3, h - 8, 1.5),
    rect('rail', r2(8 + band), 8, r2(w - 16 - 2 * band), h - 16, 2),
  ];
  const run = w - 2 * band - 24;
  const n = repeats(run, 30);
  const step = run / n;
  let d = '';
  for (let i = 0; i < n; i++)
    d += diamond(band + 12 + step * (i + 0.5), h / 2, Math.min(9, step / 3), Math.min(12, h / 4));
  if (d) parts.push(path('dye', d, DYE.navy));
  return parts;
}

// Bold stripes across it, alternating a dye and the stroke's tint, a thin sheen between each.
function stripedRug(w: number, h: number): FurniturePart[] {
  const parts: FurniturePart[] = [rect('panel', 0, 0, w, h, 3)];
  const run = w - 12;
  const n = repeats(run, 28);
  const step = run / n;
  let dye = '';
  let tint = '';
  let sheen = '';
  for (let i = 0; i < n; i++) {
    const x = 6 + i * step;
    const band = `M${r2(x + 2)} 4h${r2(step * 0.42)}V${r2(h - 4)}h${r2(-step * 0.42)}Z`;
    if (i % 2 === 0) dye += band;
    else tint += band;
    sheen += `M${r2(x + step * 0.62)} 4h2.5V${r2(h - 4)}h-2.5Z`;
  }
  parts.push(path('dye', dye, DYE.teal), path('tint', tint), path('sheen', sheen));
  parts.push(rect('rail', 4, 4, w - 8, h - 8, 2));
  return parts;
}

// A medallion in the middle, corner spandrels, a double border and a fringe: crimson and navy through the fill.
function persianRug(w: number, h: number): FurniturePart[] {
  const cx = w / 2;
  const cy = h / 2;
  const inner = { x: 22, y: 22, w: w - 44, h: h - 44 };
  const s = Math.min(inner.w, inner.h) * 0.3;
  const spandrels =
    `M${r2(inner.x)} ${r2(inner.y)}h${r2(s)}A${r2(s)} ${r2(s)} 0 0 1 ${r2(inner.x)} ${r2(inner.y + s)}Z` +
    `M${r2(inner.x + inner.w)} ${r2(inner.y)}v${r2(s)}A${r2(s)} ${r2(s)} 0 0 1 ${r2(inner.x + inner.w - s)} ${r2(inner.y)}Z` +
    `M${r2(inner.x)} ${r2(inner.y + inner.h)}v${r2(-s)}A${r2(s)} ${r2(s)} 0 0 1 ${r2(inner.x + s)} ${r2(inner.y + inner.h)}Z` +
    `M${r2(inner.x + inner.w)} ${r2(inner.y + inner.h)}h${r2(-s)}A${r2(s)} ${r2(s)} 0 0 1 ${r2(inner.x + inner.w)} ${r2(inner.y + inner.h - s)}Z`;
  const mx = Math.max(4, inner.w * 0.22);
  const my = Math.max(4, inner.h * 0.36);
  return [
    fringe(w, h, 5),
    rect('panel', 0, 0, w, h, 2),
    rect('dye', 5, 5, w - 10, h - 10, 2, DYE.navy),
    rect('floor', 13, 13, w - 26, h - 26, 1),
    rect('rail', 17, 17, w - 34, h - 34, 1),
    rect('dye', inner.x, inner.y, inner.w, inner.h, 1, DYE.crimson),
    path('tint', spandrels),
    path('dye', diamond(cx, cy, mx, my), DYE.navy),
    ellipse('floor', r2(cx), r2(cy), r2(mx * 0.62), r2(my * 0.62)),
    ellipse('dye', r2(cx), r2(cy), r2(mx * 0.42), r2(my * 0.42), DYE.gold),
    path('sheen', diamond(cx, cy, mx * 0.2, my * 0.2)),
    path('rail', diamond(cx, cy, mx * 0.82, my * 0.82)),
  ];
}

// Rows of stepped diamonds, terracotta with a sheen at each heart, between banded edges.
function kilimRug(w: number, h: number): FurniturePart[] {
  const parts: FurniturePart[] = [
    rect('panel', 0, 0, w, h, 2),
    rect('tint', 3, 3, w - 6, 7, 1),
    rect('tint', 3, h - 10, w - 6, 7, 1),
  ];
  const fieldY = 14;
  const fieldH = h - 28;
  const rows = repeats(fieldH, 40);
  const rowH = fieldH / rows;
  const cols = repeats(w - 12, 40);
  const colW = (w - 12) / cols;
  let dye = '';
  let sheen = '';
  let lines = '';
  for (let r = 0; r < rows; r++) {
    const cy = fieldY + rowH * (r + 0.5);
    if (r > 0) lines += `M6 ${r2(fieldY + rowH * r)}H${r2(w - 6)}`;
    // Every other row steps half a diamond across, as a woven kilim does: one fewer, between the row above's.
    const odd = r % 2 === 1;
    for (let c = odd ? 1 : 0; c < cols; c++) {
      const cx = 6 + colW * (odd ? c : c + 0.5);
      dye += diamond(cx, cy, colW * 0.42, rowH * 0.4);
      sheen += diamond(cx, cy, colW * 0.14, rowH * 0.14);
    }
  }
  parts.push(path('dye', dye, DYE.terracotta), path('sheen', sheen));
  if (lines) parts.push(path('rail', lines));
  return parts;
}

// A small coir mat: a darker woven field with fine ribs, inside a border.
function doormat(w: number, h: number): FurniturePart[] {
  const n = repeats(h - 14, 5);
  const step = (h - 14) / n;
  let ribs = '';
  for (let i = 0; i < n; i++)
    ribs += `M9 ${r2(7 + step * (i + 0.5))}H${r2(w - 9)}`;
  return [
    rect('panel', 0, 0, w, h, 6),
    rect('tint', 5, 5, w - 10, h - 10, 4),
    rect('dye', 5, 5, w - 10, h - 10, 4, DYE.gold),
    path('rail', ribs),
    rect('sheen', 8, 7, w - 16, 2, 1),
  ];
}
