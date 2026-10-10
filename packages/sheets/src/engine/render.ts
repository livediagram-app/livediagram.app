// A sheet's top-left window as plain data (blueprint sheet-element.md "Static render"): what images, thumbnails,
// PDFs and api or MCP renders draw, with no DOM. Only the cells inside the window are worked out.
import { columnLetters } from '../address';
import { colWidth, layoutIndex, posRangeOf, rowHeight } from '../layout';
import { displayValue } from '../number-format';
import { cellKey, type Border, type CellFormat } from '../sheet';
import { Workbook } from './workbook';
import type { CardSource } from '../cards';
import { sheetFromJson, type SheetJson } from '../sheet-json';

export type RenderCell = {
  r: number; // index into the model's rows
  c: number; // index into the model's columns
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
  borders?: { t?: Border; r?: Border; b?: Border; l?: Border };
};

export type SheetRenderModel = {
  title: string;
  colWidths: number[];
  rowHeights: number[];
  colLabels: string[];
  rowLabels: string[];
  frozenRows: number;
  frozenCols: number;
  cells: RenderCell[];
  // The sheet's look (Sheet Settings): gridlines and headers left out.
  hideGrid?: true;
  hideHeaders?: true;
};

// The visible positions, frozen first, filling `extent` pixels (at least one).
function visible(
  ids: readonly string[],
  hidden: ReadonlySet<string>,
  size: (id: string) => number,
  extent: number,
): number[] {
  const out: number[] = [];
  let used = 0;
  for (let i = 0; i < ids.length && (used < extent || out.length === 0); i++) {
    if (hidden.has(ids[i]!)) continue;
    out.push(i);
    used += size(ids[i]!);
  }
  return out;
}

export function renderWindow(
  wb: Workbook,
  sheetId: string,
  window: { width: number; height: number },
  locale: string,
): SheetRenderModel | undefined {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return undefined;
  const { layout } = sheet;
  const ix = layoutIndex(layout);
  const rows = visible(layout.rows, ix.hiddenRows, (id) => rowHeight(layout, id), window.height);
  const cols = visible(layout.cols, ix.hiddenCols, (id) => colWidth(layout, id), window.width);
  const rowAt = new Map(rows.map((r, i) => [r, i]));
  const colAt = new Map(cols.map((c, i) => [c, i]));
  const covered = new Set<string>();
  const spans = new Map<string, { rowSpan: number; colSpan: number }>();
  for (const m of layout.merges ?? []) {
    const p = posRangeOf(layout, m);
    if (!p) continue;
    spans.set(`${p.r1},${p.c1}`, { rowSpan: p.r2 - p.r1 + 1, colSpan: p.c2 - p.c1 + 1 });
    for (let r = p.r1; r <= p.r2; r++)
      for (let c = p.c1; c <= p.c2; c++) if (r !== p.r1 || c !== p.c1) covered.add(`${r},${c}`);
  }
  const cells: RenderCell[] = [];
  for (const r of rows)
    for (const c of cols) {
      if (covered.has(`${r},${c}`)) continue;
      const cell = sheet.cells.get(cellKey(layout.rows[r]!, layout.cols[c]!));
      const value = wb.value(sheetId, r, c);
      const f: CellFormat = cell?.format ?? {};
      const shown = displayValue(value, f, locale);
      const span = spans.get(`${r},${c}`);
      if (!shown.text && !f.bg && !f.bt && !f.br && !f.bb && !f.bl) continue;
      const out: RenderCell = {
        r: rowAt.get(r)!,
        c: colAt.get(c)!,
        text: shown.text,
        align: f.ha ?? shown.align,
        valign: f.va ?? 'm',
      };
      if (shown.kind === 'error') out.error = true;
      if (f.b) out.bold = true;
      if (f.i) out.italic = true;
      if (f.u) out.underline = true;
      if (f.st) out.strike = true;
      if (f.fc) out.color = f.fc;
      if (f.bg) out.fill = f.bg;
      if (f.fs) out.size = f.fs;
      if (f.wr) out.wrap = f.wr;
      if (span) {
        out.rowSpan = span.rowSpan;
        out.colSpan = span.colSpan;
      }
      if (f.bt || f.br || f.bb || f.bl)
        out.borders = {
          ...(f.bt ? { t: f.bt } : {}),
          ...(f.br ? { r: f.br } : {}),
          ...(f.bb ? { b: f.bb } : {}),
          ...(f.bl ? { l: f.bl } : {}),
        };
      cells.push(out);
    }
  return {
    title: sheet.title,
    colWidths: cols.map((c) => colWidth(layout, layout.cols[c]!)),
    rowHeights: rows.map((r) => rowHeight(layout, layout.rows[r]!)),
    colLabels: cols.map((c) => columnLetters(c)),
    rowLabels: rows.map((r) => String(r + 1)),
    frozenRows: Math.min(layout.frozenRows ?? 0, rows.length),
    frozenCols: Math.min(layout.frozenCols ?? 0, cols.length),
    cells,
    ...(layout.showGrid === false ? { hideGrid: true as const } : {}),
    ...(layout.showHeaders === false ? { hideHeaders: true as const } : {}),
  };
}

// The chrome around the grid a static render draws (packages/document svg-render-plan-sheet.ts).
const STATIC_HEADER_H = 40 + 22;
const STATIC_ROW_HEAD_W = 46;

export type SheetFrame = { sheetId: string; width: number; height: number };

// Every Sheet element's window on a tab, for an image, a thumbnail or an api or MCP render: one workbook over the
// tab's sheets, each element's window the size of its grid area.
export function renderModelsForTab(
  sheets: readonly SheetJson[],
  frames: readonly SheetFrame[],
  opts: { locale?: string; cards?: CardSource | null; now?: () => number } = {},
): Map<string, SheetRenderModel> {
  const out = new Map<string, SheetRenderModel>();
  if (frames.length === 0 || sheets.length === 0) return out;
  const wb = new Workbook({
    sheets: sheets.map(sheetFromJson),
    locale: opts.locale ?? 'en-GB',
    cards: opts.cards ?? null,
    ...(opts.now ? { now: opts.now } : {}),
  });
  for (const f of frames) {
    if (out.has(f.sheetId)) continue;
    const model = renderWindow(
      wb,
      f.sheetId,
      {
        width: Math.max(1, f.width - STATIC_ROW_HEAD_W),
        height: Math.max(1, f.height - STATIC_HEADER_H),
      },
      wb.locale,
    );
    if (model) out.set(f.sheetId, model);
  }
  return out;
}

// The Sheet elements of a tab, as frames (structural: any element list).
export function sheetFramesOf(
  elements: readonly {
    type?: string;
    shape?: string;
    width?: number;
    height?: number;
    planSheet?: { sheetId?: string };
  }[],
): SheetFrame[] {
  const out: SheetFrame[] = [];
  for (const el of elements)
    if (el.shape === 'plan-sheet' && el.planSheet?.sheetId)
      out.push({ sheetId: el.planSheet.sheetId, width: el.width ?? 960, height: el.height ?? 560 });
  return out;
}
