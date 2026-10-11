// A sheet template drawn into a sheet (docs/specs/029-sheets/sheet.md "Sheet templates"): the one write that sets a
// sheet up from a design, in a look, a cell size and the canvas's light or dark tints, and the charts that sit over
// its cells (by row and column id, for the editor or a template path to place as chart elements).
import type { Border, IdRange } from '../sheet';
import type { CellChange, SheetWrite } from '../store';
import type { FormatPatch } from '../format';
import type { Rand } from '../ids';
import type { Workbook } from '../engine/workbook';
import type { StarterCell } from '../sheet-starters';
import {
  grownFor,
  setupOptions,
  SHEET_CELL_SIZES,
  type SheetCellSize,
  type SheetLook,
} from '../sheet-starters';
import {
  accentChartPalette,
  templateTints,
  type TemplateChartPalette,
  type TemplateTints,
} from './accents';
import {
  GAP_ROW,
  GAP_ROW_PX,
  HEAD_ROW_PX,
  RESULT_SIZE,
  SUBTITLE_ROW,
  SUBTITLE_ROW_PX,
  TITLE_ROW,
  TITLE_ROW_PX,
  TITLE_SIZE,
  type DesignBlock,
  type SheetDesign,
} from './design';

export type TemplateSetup = {
  look: SheetLook;
  freezeHeader: boolean;
  size: SheetCellSize;
  dark: boolean;
};

// A chart a template places: its kind, the range it reads (and only these columns of it), where it sits over the
// cells (px from A1's corner) and its size.
export type TemplateChart = {
  kind: 'pie-chart' | 'bar-chart' | 'line-chart';
  range: IdRange;
  cols?: string[];
  anchor: { x: number; y: number };
  width: number;
  height: number;
  // Its colours, in the template's accent family.
  palette: TemplateChartPalette;
};

// A chart's gap from the cells to its left (px).
export const CHART_GAP_PX = 16;

type Draft = { v: StarterCell; f: FormatPatch };

// The rows a block reaches down to (exclusive).
function blockEnd(b: DesignBlock): number {
  if (b.kind === 'table') return b.at[0] + 1 + b.rows.length + (b.total ? 1 : 0);
  if (b.kind === 'fields') return b.at[0] + (b.heading ? 1 : 0) + b.items.length;
  return b.at[0] + 1;
}

// The rows a design fills, and the columns.
export function designExtent(d: SheetDesign): { rows: number; cols: number } {
  let rows = 2;
  let cols = d.span;
  for (const b of d.blocks) {
    rows = Math.max(rows, blockEnd(b));
    const w = b.kind === 'table' ? b.head.length : b.kind === 'fields' ? 2 : 1;
    cols = Math.max(cols, b.at[1] + w);
  }
  return { rows, cols };
}

// Each cell's value and format, by role, in the look's way (see sheet.md "Sheet templates" for the table of roles).
function draftCells(d: SheetDesign, look: SheetLook, t: TemplateTints): Map<string, Draft> {
  const out = new Map<string, Draft>();
  const plain = look === 'plain';
  const filled = look === 'header' || look === 'banded' || look === 'boxed';
  const put = (r: number, c: number, v: StarterCell, f: FormatPatch) => {
    const key = `${r},${c}`;
    const was = out.get(key);
    out.set(key, { v: v ?? was?.v ?? null, f: { ...(was?.f ?? {}), ...f } });
  };
  const colour = (f: FormatPatch): FormatPatch => (plain ? {} : f);
  const rule = (w: 1 | 2): Border => ({ w, s: 'solid', c: t.rule });
  const thin: Border = { w: 1, s: 'solid', c: t.line };

  put(TITLE_ROW, 0, d.heading, { b: true, fs: TITLE_SIZE, ...colour({ fc: t.ink }) });
  put(SUBTITLE_ROW, 0, d.subtitle, colour({ fc: t.muted }));

  for (const b of d.blocks) {
    const [r0, c0] = b.at;
    if (b.kind === 'note') {
      put(r0, c0, b.text, { i: true, ...colour({ fc: t.muted }) });
      continue;
    }
    if (b.kind === 'fields') {
      let r = r0;
      if (b.heading) {
        for (let j = 0; j < 2; j++)
          put(r, c0 + j, j === 0 ? b.heading : null, {
            b: true,
            ...colour({ fc: t.ink, bb: rule(2) }),
          });
        r++;
      }
      for (const item of b.items) {
        put(r, c0, item.label, colour({ fc: t.muted }));
        const kind = item.kind ?? 'value';
        put(r, c0 + 1, item.value, {
          ...(item.f ?? {}),
          ...(kind === 'input' ? colour({ bg: t.input }) : {}),
          ...(kind === 'result' ? { b: true, fs: RESULT_SIZE, ...colour({ fc: t.ink }) } : {}),
        });
        r++;
      }
      continue;
    }
    const width = b.head.length;
    const fmt = (j: number) => b.formats?.[j] ?? {};
    const boxed = look === 'boxed' ? { bt: thin, br: thin, bb: thin, bl: thin } : {};
    b.head.forEach((h, j) => {
      const ha = fmt(j).ha ?? (fmt(j).nf && fmt(j).nf !== 'text' ? 'r' : undefined);
      put(
        r0,
        c0 + j,
        { s: h },
        {
          b: true,
          ...(ha ? { ha } : {}),
          ...(filled ? { bg: t.head, fc: t.headInk } : {}),
          ...(look === 'minimal' ? { fc: t.ink, bb: rule(2) } : {}),
          ...boxed,
        },
      );
    });
    b.rows.forEach((row, i) => {
      const banded = look === 'banded' && i % 2 === 1;
      for (let j = 0; j < width; j++)
        put(r0 + 1 + i, c0 + j, row[j] ?? null, {
          ...fmt(j),
          ...(banded ? { bg: t.band } : {}),
          ...(b.inputs?.includes(j) && !plain ? { bg: t.input } : {}),
          ...boxed,
        });
    });
    if (b.total) {
      const r = r0 + 1 + b.rows.length;
      for (let j = 0; j < width; j++)
        put(r, c0 + j, b.total[j] ?? null, {
          ...fmt(j),
          b: true,
          ...colour({ bt: rule(2) }),
          ...(filled ? { bg: t.total } : {}),
          ...(look === 'boxed' ? { br: thin, bb: thin, bl: thin } : {}),
        });
    }
  }
  return out;
}

// The one write that sets a sheet up from `design`, and the charts to place over it. Null when the sheet is gone or
// a design's formula cannot be read (a bug in the design, caught by its test).
export function designWrite(
  wb: Workbook,
  sheetId: string,
  design: SheetDesign,
  setup: TemplateSetup,
  rand: Rand = Math.random,
): { write: SheetWrite; charts: TemplateChart[] } | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const extent = designExtent(design);
  const { changes, rowIds, read } = grownFor(wb, sheet, extent.rows, rand);
  const colIds = sheet.layout.cols;
  if (colIds.length < extent.cols) return null;
  const tints = templateTints(design.accent, setup.dark);
  const cells: CellChange[] = [];
  for (const [key, draft] of draftCells(design, setup.look, tints)) {
    const [ri, ci] = key.split(',').map(Number) as [number, number];
    const r = rowIds[ri];
    const c = colIds[ci];
    if (!r || !c) continue;
    const ch: CellChange = { r, c };
    let f: FormatPatch = {};
    if (draft.v !== null) {
      const got = read(draft.v, r, c);
      if (!got) return null;
      ch.i = got.i;
      // The design's own number format wins over the one the reading hints.
      if (got.f) f = { ...got.f };
    }
    Object.assign(f, draft.f);
    if (Object.keys(f).length) ch.f = f;
    if (ch.i !== undefined || ch.f) cells.push(ch);
  }

  changes.push(setupOptions(setup.look, setup.size));
  if (setup.freezeHeader && design.freeze > 0) changes.push({ k: 'freeze', rows: design.freeze });
  // The title and subtitle span the design's width.
  const spanEnd = colIds[design.span - 1]!;
  changes.push({
    k: 'merges',
    merges: [TITLE_ROW, SUBTITLE_ROW].map((i) => ({
      r1: rowIds[i]!,
      c1: colIds[0]!,
      r2: rowIds[i]!,
      c2: spanEnd,
    })),
  });

  // Heights: the title, subtitle and gap rows, and each table's header row.
  const size = SHEET_CELL_SIZES[setup.size];
  const heights = new Map<number, number>([
    [TITLE_ROW, TITLE_ROW_PX],
    [SUBTITLE_ROW, SUBTITLE_ROW_PX],
    [GAP_ROW, GAP_ROW_PX],
  ]);
  for (const b of design.blocks)
    if (b.kind === 'table') heights.set(b.at[0], Math.max(HEAD_ROW_PX, size.height));
  const byPx = new Map<number, string[]>();
  for (const [i, px] of heights) byPx.set(px, [...(byPx.get(px) ?? []), rowIds[i]!]);
  for (const [px, ids] of byPx) changes.push({ k: 'size', axis: 'r', ids, px });

  // Widths, grown with the cell size (a Roomy sheet's columns are wider too).
  const scale = size.width / SHEET_CELL_SIZES.default.width;
  const widthAt = (j: number) =>
    design.widths[j] !== undefined ? Math.round(design.widths[j]! * scale) : size.width;
  design.widths.forEach((_, j) => {
    const c = colIds[j];
    if (c) changes.push({ k: 'size', axis: 'c', ids: [c], px: widthAt(j) });
  });
  const heightAt = (i: number) => heights.get(i) ?? size.height;

  const charts: TemplateChart[] = [];
  for (const ch of design.charts ?? []) {
    const b = design.blocks[ch.table];
    if (!b || b.kind !== 'table') continue;
    const [r0, c0] = b.at;
    const range = {
      r1: rowIds[r0]!,
      c1: colIds[c0]!,
      r2: rowIds[r0 + b.rows.length]!,
      c2: colIds[c0 + b.head.length - 1]!,
    };
    // Clear of the cells to its left by a gap, as Insert Chart sits clear of its range.
    let x = ch.at[1] > 0 ? CHART_GAP_PX : 0;
    for (let j = 0; j < ch.at[1]; j++) x += widthAt(j);
    let y = 0;
    for (let i = 0; i < ch.at[0]; i++) y += heightAt(i);
    charts.push({
      kind: ch.kind,
      range,
      ...(ch.cols ? { cols: ch.cols.map((j) => colIds[c0 + j]!) } : {}),
      anchor: { x, y },
      width: ch.width,
      height: ch.height,
      palette: accentChartPalette(design.accent),
    });
  }
  return { write: { kind: 'layout', changes, cells }, charts };
}
