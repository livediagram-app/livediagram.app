// A sheet an agent lays out as a template is (docs/specs/029-sheets/sheet-store.md "Agents", "A design"): a heading,
// blocks of tables, fields and notes, a look and an accent, compiled by the templates' own step (designWrite), so it
// reads as a template does. Blocks without a place stack from row 4 down column A, one blank row apart. Dropdown
// columns become validation rules, widths are fitted to the cells unless given, and charts over tables are handed
// back for the caller to place on the tab. Pure.
import {
  HEAD_ROW,
  SHEET_ACCENTS,
  Workbook,
  accentChartPalette,
  applySheetWrite,
  columnLetters,
  designExtent,
  designWrite,
  fittedWidths,
  formatA1,
  NOBODY,
  NUMBER_FORMATS,
  parseA1,
  readTypedInput,
  type DesignBlock,
  type FormatPatch,
  type Rand,
  type SheetAccent,
  type SheetDesign,
  type SheetLook,
  type SheetWrite,
  type StarterCell,
  type AgentValue,
} from '@liveplanner/sheets';
import { isLightColor, type ChartPaletteId, type ChartType } from '@liveplanner/document';
import { formatPatchOf, type SheetFormatInput } from './sheet-change-build';
import { buildRuleChange } from './sheet-rule-change';
import { designCharts, seriesNote, type SheetChartOut } from './sheet-charts';
import type { SheetRefusal } from './sheet-state';

// A column's or a value's format: a number format by name, or a format in words.
export type DesignFormat = string | SheetFormatInput;

export type DesignChartInput = {
  type: ChartType;
  // The columns charted, by header (the first a label column); all of the table's when left out.
  columns?: string[];
  // The cell its top-left sits on; right of the table, level with its header, when left out.
  at?: string;
  width?: number;
  height?: number;
  // Its colours; the design's accent's family when left out.
  palette?: ChartPaletteId;
};

export type DesignTableInput = {
  kind: 'table';
  at?: string;
  head: string[];
  rows: AgentValue[][];
  total?: AgentValue[];
  formats?: Record<string, DesignFormat>;
  inputs?: string[];
  dropdowns?: Record<string, { options: string[]; colors?: (string | null)[] }>;
  checkboxes?: string[];
  chart?: DesignChartInput;
};

export type DesignFieldsInput = {
  kind: 'fields';
  at?: string;
  heading?: string;
  items: {
    label: string;
    value: AgentValue;
    kind?: 'input' | 'value' | 'result';
    format?: DesignFormat;
  }[];
};

export type DesignNoteInput = { kind: 'note'; at?: string; text: string };

export type SheetDesignInput = {
  heading: string;
  subtitle?: string;
  accent?: SheetAccent;
  look?: SheetLook;
  blocks: (DesignTableInput | DesignFieldsInput | DesignNoteInput)[];
  // Column widths in px from A; fitted to the cells when left out.
  widths?: number[];
  // Rows frozen at the top; through the main table's header when left out (0 for none).
  freeze?: number;
};

type DesignBuilt =
  { ok: true; writes: SheetWrite[]; line: string; charts: SheetChartOut[] } | SheetRefusal;

// Whether a tab's canvas is dark (a design is tinted for it); a tab with no colour of its own is light.
export const darkCanvas = (background: string | undefined): boolean =>
  !!background && !isLightColor(background);

// The accent and look a design takes when it names none.
export const DESIGN_ACCENT_DEFAULT: SheetAccent = 'blue';
const DESIGN_LOOK_DEFAULT: SheetLook = 'banded';
// The blank row between stacked blocks.
const BLOCK_GAP_ROWS = 1;
// The deepest main table whose header a design freezes by default: one lower down would freeze most of the view.
const FREEZE_HEADER_ROW_MAX = 12;

const refuse = (code: string, message: string): SheetRefusal => ({ ok: false, code, message });

// A value as a template's cell: text read as typed, a number kept, a boolean as TRUE or FALSE.
const starter = (v: AgentValue): StarterCell =>
  v === null
    ? null
    : typeof v === 'number'
      ? { n: v }
      : typeof v === 'boolean'
        ? v
          ? 'TRUE'
          : 'FALSE'
        : v;

function formatOf(f: DesignFormat): FormatPatch | null {
  if (typeof f === 'string')
    return (NUMBER_FORMATS as readonly string[]).includes(f)
      ? formatPatchOf({ numberFormat: f })
      : null;
  return formatPatchOf(f);
}

const blockRows = (b: DesignBlock) =>
  b.kind === 'table'
    ? 1 + b.rows.length + (b.total ? 1 : 0)
    : b.kind === 'fields'
      ? (b.heading ? 1 : 0) + b.items.length
      : 1;

// Where each block lands, A1 of each part, for the answer and for the caller's later changes.
function blockLines(blocks: readonly DesignBlock[]): string[] {
  return blocks.map((b) => {
    const [r, c] = b.at;
    if (b.kind === 'table') {
      const last = columnLetters(c + b.head.length - 1);
      const first = columnLetters(c);
      const body = b.rows.length ? `, rows ${first}${r + 2}:${last}${r + 1 + b.rows.length}` : '';
      const total = b.total
        ? `, total ${first}${r + 2 + b.rows.length}:${last}${r + 2 + b.rows.length}`
        : '';
      return `table "${b.head[0]!}…" header ${first}${r + 1}:${last}${r + 1}${body}${total}`;
    }
    if (b.kind === 'fields') {
      const top = r + (b.heading ? 2 : 1);
      return `fields ${formatA1(top - 1, c)}:${formatA1(top - 2 + b.items.length, c + 1)} (values in ${columnLetters(c + 1)})`;
    }
    return `note ${formatA1(r, c)}`;
  });
}

// The design as the templates' SheetDesign: blocks placed, formats by column, inputs by header.
function compileInput(
  input: SheetDesignInput,
):
  { design: SheetDesign; tables: (DesignTableInput & { at0: [number, number] })[] } | SheetRefusal {
  const blocks: DesignBlock[] = [];
  const tables: (DesignTableInput & { at0: [number, number] })[] = [];
  let next = HEAD_ROW;
  for (const [i, b] of input.blocks.entries()) {
    let at: [number, number] = [next, 0];
    if (b.at !== undefined) {
      const p = parseA1(b.at);
      if (!p)
        return refuse(
          'range_invalid',
          `Block ${i + 1}'s at "${b.at}" is not a cell in A1 form ("A4").`,
        );
      if (p.r < HEAD_ROW)
        return refuse(
          'range_invalid',
          `Block ${i + 1} starts on row 4 or below (rows 1 to 3 hold the heading).`,
        );
      at = [p.r, p.c];
    }
    let block: DesignBlock;
    if (b.kind === 'table') {
      if (b.head.length === 0) return refuse('write_invalid', `Table ${i + 1} has no header.`);
      const col = (name: string) =>
        b.head.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase());
      const unknown = [
        ...Object.keys(b.formats ?? {}),
        ...(b.inputs ?? []),
        ...Object.keys(b.dropdowns ?? {}),
        ...(b.checkboxes ?? []),
        ...(b.chart?.columns ?? []),
      ].find((name) => col(name) < 0);
      if (unknown !== undefined)
        return refuse(
          'write_invalid',
          `Table ${i + 1} has no column "${unknown}". Its columns: ${b.head.join(', ')}.`,
        );
      const formats: (FormatPatch | null)[] = b.head.map(() => null);
      for (const [name, f] of Object.entries(b.formats ?? {})) {
        const patch = formatOf(f);
        if (!patch)
          return refuse(
            'format_invalid',
            `Column "${name}"'s format is not one a cell takes: a number format (${NUMBER_FORMATS.join(', ')}) or a format in words.`,
          );
        formats[col(name)] = patch;
      }
      block = {
        kind: 'table',
        at,
        head: b.head,
        rows: b.rows.map((row) => row.map(starter)),
        ...(b.total ? { total: b.total.map(starter) } : {}),
        formats,
        ...(b.inputs?.length ? { inputs: b.inputs.map(col) } : {}),
      };
      tables.push({ ...b, at0: at });
    } else if (b.kind === 'fields') {
      const items = [];
      for (const item of b.items) {
        const f = item.format === undefined ? undefined : formatOf(item.format);
        if (f === null)
          return refuse('format_invalid', `"${item.label}"'s format is not one a cell takes.`);
        items.push({
          label: item.label,
          value: starter(item.value),
          ...(f ? { f } : {}),
          ...(item.kind ? { kind: item.kind } : {}),
        });
      }
      block = { kind: 'fields', at, ...(b.heading ? { heading: b.heading } : {}), items };
    } else block = { kind: 'note', at, text: b.text };
    blocks.push(block);
    if (b.at === undefined) next = at[0] + blockRows(block) + BLOCK_GAP_ROWS;
    else next = Math.max(next, at[0] + blockRows(block) + BLOCK_GAP_ROWS);
  }
  // The main table, the one with the most rows (the first of those): its header is what scrolling keeps in view.
  const mainTable = blocks.reduce<Extract<DesignBlock, { kind: 'table' }> | undefined>(
    (best, b) => (b.kind === 'table' && (!best || b.rows.length > best.rows.length) ? b : best),
    undefined,
  );
  const draft: SheetDesign = {
    heading: input.heading,
    subtitle: input.subtitle ?? '',
    span: 1,
    accent: input.accent ?? DESIGN_ACCENT_DEFAULT,
    blocks,
    widths: input.widths ?? [],
    freeze:
      input.freeze ??
      (mainTable && mainTable.at[0] < FREEZE_HEADER_ROW_MAX ? mainTable.at[0] + 1 : 0),
  };
  // The heading spans every column the blocks fill.
  return { design: { ...draft, span: designExtent(draft).cols }, tables };
}

// The first formula of the design that cannot be read, with where it is.
function badFormula(wb: Workbook, sheetId: string, design: SheetDesign): SheetRefusal | null {
  const ctx = wb.ctxFor(sheetId);
  const check = (v: StarterCell, r: number, c: number): SheetRefusal | null => {
    if (typeof v !== 'string' || !v.startsWith('=')) return null;
    const read = readTypedInput(v, wb.locale, ctx);
    return read.kind === 'invalid'
      ? refuse(
          'formula_invalid',
          `The formula in ${formatA1(r, c)} cannot be read: ${read.reason}.`,
        )
      : null;
  };
  for (const b of design.blocks) {
    const [r0, c0] = b.at;
    if (b.kind === 'table') {
      const rows = [...b.rows, ...(b.total ? [b.total] : [])];
      for (const [i, row] of rows.entries())
        for (const [j, v] of row.entries()) {
          const bad = check(v, r0 + 1 + i, c0 + j);
          if (bad) return bad;
        }
    } else if (b.kind === 'fields')
      for (const [i, item] of b.items.entries()) {
        const bad = check(item.value, r0 + (b.heading ? 1 : 0) + i, c0 + 1);
        if (bad) return bad;
      }
  }
  return null;
}

export function buildDesign(
  wb: Workbook,
  sheetId: string,
  input: SheetDesignInput,
  opts: { dark: boolean },
  rand: Rand = Math.random,
): DesignBuilt {
  const sheet = wb.sheet(sheetId)!;
  if (sheet.cells.size > 0)
    return refuse(
      'sheet_not_empty',
      'A design lays out an empty sheet, and this one has cells: clear it first (clear with a range covering them), or add_sheet a new one.',
    );
  if (input.accent !== undefined && !SHEET_ACCENTS.includes(input.accent))
    return refuse('write_invalid', `Accents: ${SHEET_ACCENTS.join(', ')}.`);
  const compiled = compileInput(input);
  if ('ok' in compiled) return compiled;
  const { design, tables } = compiled;
  const extent = designExtent(design);
  if (extent.cols > sheet.layout.cols.length)
    return refuse(
      'sheet_too_large',
      `The design is ${extent.cols} columns wide; the sheet has ${sheet.layout.cols.length}.`,
    );
  const bad = badFormula(wb, sheetId, design);
  if (bad) return bad;
  const look = input.look ?? DESIGN_LOOK_DEFAULT;
  // badFormula read every formula and the columns fit, so the write is made.
  const made = designWrite(
    wb,
    sheetId,
    design,
    { look, freezeHeader: true, size: 'default', dark: opts.dark },
    rand,
  )!;
  // The sheet as the design leaves it, to fit widths and build rules against.
  const scratch = new Workbook({ sheets: wb.sheetList(), locale: wb.locale });
  const writes: SheetWrite[] = [];
  const send = (w: SheetWrite) => {
    scratch.updateSheet(applySheetWrite(scratch.sheet(sheetId)!, w, { now: 0, by: NOBODY }).sheet);
    writes.push(w);
  };
  send(made.write);
  // Dropdown and checkbox columns: a rule over each column's body rows.
  for (const t of tables) {
    const [r0, c0] = t.at0;
    if (t.rows.length === 0) continue;
    const body = (name: string) => {
      const c = c0 + t.head.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase());
      return `${formatA1(r0 + 1, c)}:${formatA1(r0 + t.rows.length, c)}`;
    };
    const rules = [
      ...Object.entries(t.dropdowns ?? {}).map(([name, d]) => ({
        op: 'validate' as const,
        range: body(name),
        rule: {
          type: 'dropdown' as const,
          options: d.options,
          ...(d.colors ? { colors: d.colors } : {}),
        },
      })),
      ...(t.checkboxes ?? []).map((name) => ({
        op: 'validate' as const,
        range: body(name),
        rule: { type: 'checkbox' as const },
      })),
    ];
    for (const rule of rules) {
      const built = buildRuleChange(scratch, sheetId, rule, rand);
      if (!built.ok) return built;
      built.writes.forEach(send);
    }
  }
  // Widths last, fitted to the cells as laid out with their rules (a dropdown's chip needs room).
  if (!input.widths?.length) {
    const cols = Array.from({ length: extent.cols }, (_, c) => c);
    // A note runs over its empty neighbours, as a template's does, so it widens nothing.
    const notes = new Set(
      design.blocks.filter((b) => b.kind === 'note').map((b) => `${b.at[0]},${b.at[1]}`),
    );
    const ids = scratch.sheet(sheetId)!.layout.cols;
    const changes = [...fittedWidths(scratch, sheetId, cols, (r, c) => notes.has(`${r},${c}`))].map(
      ([c, px]) => ({
        k: 'size' as const,
        axis: 'c' as const,
        ids: [ids[c]!],
        px,
      }),
    );
    if (changes.length) send({ kind: 'layout', changes });
  }
  const charts = designCharts(scratch, sheetId, tables, accentChartPalette(design.accent));
  if ('ok' in charts) return charts;
  // What a one-series chart shows of a table's several value columns.
  const notes = tables
    .filter((t) => t.chart)
    .map((t) => {
      const shown = t.chart!.columns?.length ? t.chart!.columns : t.head;
      return seriesNote(t.chart!.type, shown.slice(1));
    })
    .join('');
  const lines = blockLines(design.blocks);
  return {
    ok: true,
    writes,
    line: `laid out "${input.heading}" in ${look}, ${input.accent ?? DESIGN_ACCENT_DEFAULT}: ${lines.join('; ')}${
      charts.length
        ? `; ${charts.length === 1 ? 'a chart' : `${charts.length} charts`}${notes}`
        : ''
    }`,
    charts,
  };
}
