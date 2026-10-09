// A Sheet element in an export, thumbnail or api image (docs/specs/029-sheets/sheet.md "Exports and images"; blueprint
// sheet-element.md "Static render"): its header, column letters and row numbers, and the cells of the top-left
// window with their formats, from a render model the caller worked out with the sheets engine. The document
// package never imports the engine: the model's shape is restated here, structurally.
import type { BoxedElement } from './index';
import type { CanvasSurface } from './colors';
import { planPalette } from './plan-palette';
import { r2, xmlEscape } from './svg-render-primitives';
import { wrapLines } from './svg-render-face-kit';

type Shape = BoxedElement & { type: 'shape' };

type RenderBorder = { w: 1 | 2 | 3; s: 'solid' | 'dashed' | 'dotted'; c: string };

// @livediagram/sheets SheetRenderModel (engine/render.ts), restated.
export type SheetRenderModel = {
  title: string;
  colWidths: number[];
  rowHeights: number[];
  colLabels: string[];
  rowLabels: string[];
  frozenRows: number;
  frozenCols: number;
  cells: {
    r: number;
    c: number;
    text: string;
    align: 'l' | 'c' | 'r';
    valign: 't' | 'm' | 'b';
    error?: true;
    bold?: true;
    italic?: true;
    underline?: true;
    strike?: true;
    color?: string;
    fill?: string;
    size?: number;
    wrap?: 'o' | 'w' | 'c';
    rowSpan?: number;
    colSpan?: number;
    borders?: { t?: RenderBorder; r?: RenderBorder; b?: RenderBorder; l?: RenderBorder };
  }[];
  // The sheet's look (Sheet Settings): gridlines and headers left out.
  hideGrid?: true;
  hideHeaders?: true;
};

const FONT = 'system-ui, sans-serif';
export const SHEET_HEADER_H = 40;
export const SHEET_COL_HEAD_H = 22;
export const SHEET_ROW_HEAD_W = 46;
const PAD = 12;
const CELL_PAD = 4;
const ERROR_INK = '#dc2626';

function dash(s: RenderBorder['s'], w: number): string {
  return s === 'dashed'
    ? ` stroke-dasharray="${w * 3} ${w * 2}"`
    : s === 'dotted'
      ? ` stroke-dasharray="${w} ${w * 1.5}"`
      : '';
}

function line(x1: number, y1: number, x2: number, y2: number, b: RenderBorder): string {
  return `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${b.c}" stroke-width="${b.w}"${dash(b.s, b.w)}/>`;
}

export function svgPlanSheet(
  el: Shape,
  model: SheetRenderModel | undefined,
  surface: CanvasSurface,
): string {
  const p = planPalette(surface, {
    fill: el.fillColor,
    stroke: el.strokeColor,
    text: el.textColor,
  });
  const { x, y, width: w, height: h } = el;
  const id = `ps-${el.id.replace(/[^A-Za-z0-9_-]/g, '')}`;
  let out = `<clipPath id="${id}"><rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="12"/></clipPath>`;
  out += `<g clip-path="url(#${id})">`;
  out += `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${p.surface}"/>`;
  const title = model?.title ?? 'Sheet';
  out += `<text x="${r2(x + PAD)}" y="${r2(y + SHEET_HEADER_H / 2 + 5)}" font-size="14" font-weight="600" fill="${p.text}">${xmlEscape(
    wrapLines(title, w - PAD * 2, 14, 1)[0] ?? '',
  )}</text>`;
  // A sheet that hides its row numbers and column letters (Sheet Settings) starts its cells at the edge.
  const heads = !model?.hideHeaders;
  const headW = heads ? SHEET_ROW_HEAD_W : 0;
  const headH = heads ? SHEET_COL_HEAD_H : 0;
  const gx = x + headW;
  const gy = y + SHEET_HEADER_H + headH;
  if (heads) {
    out += `<rect x="${r2(x)}" y="${r2(y + SHEET_HEADER_H)}" width="${r2(w)}" height="${SHEET_COL_HEAD_H}" fill="${p.column}"/>`;
    out += `<rect x="${r2(x)}" y="${r2(y + SHEET_HEADER_H)}" width="${SHEET_ROW_HEAD_W}" height="${r2(h - SHEET_HEADER_H)}" fill="${p.column}"/>`;
  }
  if (!model)
    return `<g font-family="${FONT}">${out}</g></g><rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="12" fill="none" stroke="${p.border}"/>`;
  const xs = [gx];
  for (const cw of model.colWidths) xs.push(xs[xs.length - 1]! + cw);
  const ys = [gy];
  for (const rh of model.rowHeights) ys.push(ys[ys.length - 1]! + rh);
  // Headers and grid lines, unless the sheet hides them.
  if (heads)
    model.colLabels.forEach((label, i) => {
      out += `<text x="${r2((xs[i]! + xs[i + 1]!) / 2)}" y="${r2(y + SHEET_HEADER_H + 15)}" font-size="11" fill="${p.muted}" text-anchor="middle">${label}</text>`;
    });
  if (heads)
    model.rowLabels.forEach((label, i) => {
      out += `<text x="${r2(x + SHEET_ROW_HEAD_W - 6)}" y="${r2((ys[i]! + ys[i + 1]!) / 2 + 4)}" font-size="11" fill="${p.muted}" text-anchor="end">${label}</text>`;
    });
  const right = Math.min(xs[xs.length - 1]!, x + w);
  const bottom = Math.min(ys[ys.length - 1]!, y + h);
  if (!model.hideGrid)
    for (const gxi of xs)
      out += `<line x1="${r2(gxi)}" y1="${r2(y + SHEET_HEADER_H)}" x2="${r2(gxi)}" y2="${r2(bottom)}" stroke="${p.cardBorder}" stroke-width="1"/>`;
  if (!model.hideGrid)
    for (const gyi of ys)
      out += `<line x1="${r2(x)}" y1="${r2(gyi)}" x2="${r2(right)}" y2="${r2(gyi)}" stroke="${p.cardBorder}" stroke-width="1"/>`;
  if (model.frozenRows > 0)
    out += `<line x1="${r2(x)}" y1="${r2(ys[model.frozenRows]!)}" x2="${r2(right)}" y2="${r2(ys[model.frozenRows]!)}" stroke="${p.border}" stroke-width="2"/>`;
  if (model.frozenCols > 0)
    out += `<line x1="${r2(xs[model.frozenCols]!)}" y1="${r2(y + SHEET_HEADER_H)}" x2="${r2(xs[model.frozenCols]!)}" y2="${r2(bottom)}" stroke="${p.border}" stroke-width="2"/>`;
  // Cells: fills, then text, then borders on top.
  for (const cell of model.cells) {
    const cx = xs[cell.c]!;
    const cy = ys[cell.r]!;
    const cw = (xs[Math.min(cell.c + (cell.colSpan ?? 1), xs.length - 1)] ?? cx) - cx;
    const ch = (ys[Math.min(cell.r + (cell.rowSpan ?? 1), ys.length - 1)] ?? cy) - cy;
    if (cell.fill || cell.colSpan || cell.rowSpan)
      out += `<rect x="${r2(cx + 0.5)}" y="${r2(cy + 0.5)}" width="${r2(Math.max(0, cw - 1))}" height="${r2(Math.max(0, ch - 1))}" fill="${cell.fill ?? p.surface}"/>`;
    if (cell.text) {
      const size = cell.size ? Math.round((cell.size * 4) / 3) : 13;
      const tx =
        cell.align === 'r' ? cx + cw - CELL_PAD : cell.align === 'c' ? cx + cw / 2 : cx + CELL_PAD;
      const ty =
        cell.valign === 't'
          ? cy + size + 2
          : cell.valign === 'm'
            ? cy + ch / 2 + size / 3
            : cy + ch - 6;
      const anchor =
        cell.align === 'r'
          ? ' text-anchor="end"'
          : cell.align === 'c'
            ? ' text-anchor="middle"'
            : '';
      const deco = [cell.underline ? 'underline' : '', cell.strike ? 'line-through' : '']
        .filter(Boolean)
        .join(' ');
      const clip = `${id}-${cell.r}-${cell.c}`;
      out += `<clipPath id="${clip}"><rect x="${r2(cx)}" y="${r2(cy)}" width="${r2(cell.wrap === 'o' || !cell.wrap ? Math.max(cw, right - cx) : cw)}" height="${r2(ch)}"/></clipPath>`;
      out += `<text clip-path="url(#${clip})" x="${r2(tx)}" y="${r2(ty)}" font-size="${size}"${cell.bold ? ' font-weight="700"' : ''}${
        cell.italic ? ' font-style="italic"' : ''
      }${deco ? ` text-decoration="${deco}"` : ''} fill="${cell.error ? ERROR_INK : (cell.color ?? p.text)}"${anchor}>${xmlEscape(cell.text.split('\n')[0]!)}</text>`;
    }
    const b = cell.borders;
    if (b?.t) out += line(cx, cy, cx + cw, cy, b.t);
    if (b?.b) out += line(cx, cy + ch, cx + cw, cy + ch, b.b);
    if (b?.l) out += line(cx, cy, cx, cy + ch, b.l);
    if (b?.r) out += line(cx + cw, cy, cx + cw, cy + ch, b.r);
  }
  out += '</g>';
  out += `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="12" fill="none" stroke="${p.border}"/>`;
  return `<g font-family="${FONT}">${out}</g>`;
}
