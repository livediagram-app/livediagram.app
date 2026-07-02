// Headless SVG emitter for a TableElement (spec/09 Table): the real grid —
// pinned / flexible tracks, header bands, zebra striping, per-cell style
// overrides, grid lines with the border presets, and wrapped per-cell text —
// instead of the box-with-nothing the generic renderer used to draw. Shared
// by the in-app SVG/PNG/PDF export, the api worker's live image / Explorer
// thumbnail, and the MCP inline render via svgBoxed.
import { BORDER_DASH_ARRAY, BORDER_STROKE_PX } from './border-style';
import { defaultStrokeColor, defaultTextColor } from './colors';
import { PADDING_PX, type TableElement, type TextSize } from './index';
import { LABEL_LINE_HEIGHT, labelMeasure, r2, wrapLabel, xmlEscape } from './svg-render-primitives';

// Cell font size per preset, mirroring TableView's CELL_FONT_PX; 'scale'
// tracks the row height like the editor.
const CELL_FONT_PX: Record<string, number> = { sm: 11, md: 13, lg: 16 };
const scaleCellFontPx = (rowH: number): number => Math.max(9, Math.min(40, Math.round(rowH * 0.4)));

// Track sizes for one axis: pinned entries keep their px, the rest share
// whatever remains evenly (the CSS `minmax(0, 1fr)` behaviour TableView's
// grid template produces).
export function tableTrackSizes(
  total: number,
  count: number,
  pinned?: (number | null)[],
): number[] {
  const fixed = Array.from({ length: count }, (_, i) => pinned?.[i] ?? null);
  const pinnedSum = fixed.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const flexCount = fixed.filter((v) => v == null).length;
  const flexSize = flexCount > 0 ? Math.max(0, total - pinnedSum) / flexCount : 0;
  return fixed.map((v) => v ?? flexSize);
}

const cumulative = (sizes: number[]): number[] => {
  const out = [0];
  for (const s of sizes) out.push(out[out.length - 1]! + s);
  return out;
};

export function svgTableShape(el: TableElement): string {
  const rows = el.cells.length;
  const cols = el.cells[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return '';
  const stroke = el.strokeColor ?? defaultStrokeColor(el);
  const textColor = el.textColor ?? defaultTextColor(el);
  const headerTextColor = el.headerTextColor ?? textColor;
  const borderW = BORDER_STROKE_PX[el.strokeWidth ?? 'thin'];
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? 'solid'];
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
  const lineAttrs =
    borderW > 0 ? ` stroke="${xmlEscape(stroke)}" stroke-width="${borderW}"${dashAttr}` : '';
  const pad = PADDING_PX[el.padding ?? 'sm'];
  const xs = cumulative(tableTrackSizes(el.width, cols, el.colWidths)).map((v) => el.x + v);
  const ys = cumulative(tableTrackSizes(el.height, rows, el.rowHeights)).map((v) => el.y + v);
  const rowH = rows > 0 ? el.height / rows : el.height;
  const baseFontPx =
    el.textSize === 'scale' ? scaleCellFontPx(rowH) : (CELL_FONT_PX[el.textSize ?? 'md'] ?? 13);
  const alignX = el.textAlignX ?? 'center';
  const alignY = el.textAlignY ?? 'middle';

  const parts: string[] = [];
  // Table body fill (when set — the editor default is transparent).
  if (el.fillColor && el.fillColor !== 'transparent') {
    parts.push(
      `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" fill="${xmlEscape(el.fillColor)}"/>`,
    );
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cs = el.cellStyles?.[r]?.[c] ?? null;
      const isHeader = (el.headerRow && r === 0) || (el.headerColumn && c === 0);
      const bodyRow = el.headerRow ? r - 1 : r;
      const zebra = !!el.zebra && !isHeader && bodyRow >= 0 && bodyRow % 2 === 1;
      const cx0 = xs[c]!;
      const cy0 = ys[r]!;
      const cw = xs[c + 1]! - cx0;
      const ch = ys[r + 1]! - cy0;
      // Cell background: an explicit per-cell colour wins; otherwise the
      // header band / zebra stripe render as a translucent wash of the grid
      // stroke over the body fill (~18% / ~7%, matching the editor's
      // color-mix / #RRGGBB11 tints without relying on CSS color-mix, which
      // headless rasterisers don't parse).
      if (cs?.bg) {
        parts.push(
          `<rect x="${r2(cx0)}" y="${r2(cy0)}" width="${r2(cw)}" height="${r2(ch)}" fill="${xmlEscape(cs.bg)}"/>`,
        );
      } else if (el.headerFill && isHeader) {
        parts.push(
          `<rect x="${r2(cx0)}" y="${r2(cy0)}" width="${r2(cw)}" height="${r2(ch)}" fill="${xmlEscape(el.headerFill)}"/>`,
        );
      } else if (isHeader || zebra) {
        parts.push(
          `<rect x="${r2(cx0)}" y="${r2(cy0)}" width="${r2(cw)}" height="${r2(ch)}" fill="${xmlEscape(stroke)}" opacity="${isHeader ? 0.18 : 0.07}"/>`,
        );
      }

      const text = el.cells[r]?.[c] ?? '';
      if (!text) continue;
      const fontPx = cs?.textSize
        ? cs.textSize === 'scale'
          ? scaleCellFontPx(rowH)
          : (CELL_FONT_PX[cs.textSize as TextSize] ?? baseFontPx)
        : baseFontPx;
      const bold = isHeader || (cs?.bold ?? el.textBold) === true;
      const weight = isHeader ? 700 : bold ? 600 : 400;
      const italic = (cs?.italic ?? el.textItalic) === true;
      const colour = cs?.textColor ?? (isHeader ? headerTextColor : textColor);
      const cellAlignX = cs?.alignX ?? alignX;
      const anchor = cellAlignX === 'left' ? 'start' : cellAlignX === 'right' ? 'end' : 'middle';
      const tx =
        cellAlignX === 'left' ? cx0 + pad : cellAlignX === 'right' ? cx0 + cw - pad : cx0 + cw / 2;
      const lineH = fontPx * LABEL_LINE_HEIGHT;
      const maxLines = Math.max(1, Math.floor((ch - pad) / lineH));
      const lines = wrapLabel(
        text,
        Math.max(8, cw - pad * 2),
        labelMeasure(fontPx, weight >= 600, italic),
      ).slice(0, maxLines);
      const blockH = (lines.length - 1) * lineH;
      // Vertical placement: the FIRST line's central baseline, per the
      // table's vertical alignment.
      const firstY =
        alignY === 'top'
          ? cy0 + pad + fontPx / 2
          : alignY === 'bottom'
            ? cy0 + ch - pad - fontPx / 2 - blockH
            : cy0 + ch / 2 - blockH / 2;
      const tspans = lines
        .map(
          (line, i) =>
            `<tspan x="${r2(tx)}" dy="${i === 0 ? 0 : r2(lineH)}">${xmlEscape(line)}</tspan>`,
        )
        .join('');
      parts.push(
        `<text x="${r2(tx)}" y="${r2(firstY)}" font-family="system-ui, sans-serif" font-size="${fontPx}"` +
          ` font-weight="${weight}"${italic ? ' font-style="italic"' : ''}` +
          ` fill="${xmlEscape(colour)}" text-anchor="${anchor}" dominant-baseline="central">${tspans}</text>`,
      );
    }
  }

  // Grid lines over the cell fills: internal dividers + the outer frame.
  if (borderW > 0) {
    for (let c = 1; c < cols; c++) {
      parts.push(
        `<line x1="${r2(xs[c]!)}" y1="${r2(el.y)}" x2="${r2(xs[c]!)}" y2="${r2(el.y + el.height)}" fill="none"${lineAttrs}/>`,
      );
    }
    for (let r = 1; r < rows; r++) {
      parts.push(
        `<line x1="${r2(el.x)}" y1="${r2(ys[r]!)}" x2="${r2(el.x + el.width)}" y2="${r2(ys[r]!)}" fill="none"${lineAttrs}/>`,
      );
    }
    parts.push(
      `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" fill="none"${lineAttrs}/>`,
    );
  }
  return parts.join('');
}
