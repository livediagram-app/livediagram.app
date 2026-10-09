// Setup Sheet (docs/specs/029-sheets/sheet.md "Setup Sheet"): the starts a new sheet can be filled from, the looks
// it can take, and the one write that sets it up (the start, the look, the freeze, the sizes, and setup done).
// Pure: the editor builds the card rows and hands them in.
import { appendAxis } from './commands-axis';
import { cellKey, type Border, type Sheet } from './sheet';
import { CARD_CONTROLS_COL_PX, CARD_TABLE_ROWS_MAX, SHEET_ROWS_MAX } from './limits';
import { makeAxisIds, type Rand } from './ids';
import { serialFromMs } from './dates';
import { readTypedInput } from './typed-input';
import type { CellChange, SheetWrite } from './store';
import type { LayoutChange } from './store-layout';
import type { FormatPatch } from './format';
import type { Workbook } from './engine/workbook';

// A cell of a start: text read as typed in en-GB (a number, a date, `=` a formula), literal text, or a number (a date
// serial when `date`).
export type StarterCell = string | { s: string } | { n: number; date?: true } | null;

export type SheetStarter = {
  // The first row is the header.
  rows: StarterCell[][];
  // Column widths in px, from A.
  widths?: number[];
  // The last row is a total (drawn bold).
  total?: true;
  // A column's number format (the amount column's two decimals).
  formats?: { col: number; patch: FormatPatch }[];
  // Plan cards as rows: the rows are a card table (sheet.md "Card tables"); `ids[i]` is row i + 2's card, each
  // column the field the header names, and `type` the card type new rows take.
  cards?: { fields: string[]; ids: string[]; type: string };
};

export const SHEET_STARTS = ['blank', 'budget', 'tracker', 'timesheet', 'contacts'] as const;
export type SheetStartId = (typeof SHEET_STARTS)[number];

export const SHEET_LOOKS = ['plain', 'header', 'banded', 'boxed', 'minimal'] as const;
export type SheetLook = (typeof SHEET_LOOKS)[number];

export const SHEET_CELL_SIZES = {
  compact: { width: 100, height: 24 },
  default: { width: 120, height: 28 },
  roomy: { width: 160, height: 36 },
} as const;
export type SheetCellSize = keyof typeof SHEET_CELL_SIZES;

// The card fields written as dates (a date serial with a date format), by the names Setup Sheet's columns use; the
// editor reads every other name for them with @livediagram/items' isCardDateField.
const CARD_DATE_FIELDS: ReadonlySet<string> = new Set(['Due', 'Start']);

// The most card rows a setup writes (sheet.md "Setup Sheet").
export const SETUP_CARDS_MAX = 500;

// The built-in starts, dated from `now` (the Tracker's due dates).
export function sheetStarter(id: SheetStartId, now: number): SheetStarter | null {
  const day = Math.floor(serialFromMs(now));
  const due = (weeks: number): StarterCell => ({ n: day + weeks * 7, date: true });
  switch (id) {
    case 'blank':
      return null;
    case 'budget':
      return {
        rows: [
          ['Item', 'Category', 'Amount'],
          ['Rent', 'Home', '1200'],
          ['Groceries', 'Food', '320'],
          ['Transport', 'Travel', '140'],
          ['Utilities', 'Home', '180'],
          ['Total', null, '=SUM(C2:C5)'],
        ],
        widths: [180, 140, 120],
        total: true,
        formats: [{ col: 2, patch: { nf: 'number', dp: 2 } }],
      };
    case 'tracker':
      return {
        rows: [
          ['Task', 'Owner', 'Status', 'Due'],
          ['Draft the plan', 'Alex', 'In Progress', due(1)],
          ['Review with the team', 'Sam', 'To Do', due(2)],
          ['Share the results', 'Alex', 'To Do', due(3)],
        ],
        widths: [220, 120, 120, 120],
      };
    case 'timesheet':
      return {
        rows: [
          ['Day', 'Project', 'Hours'],
          ['Monday', 'Website', '7.5'],
          ['Tuesday', 'Website', '8'],
          ['Wednesday', 'Research', '6'],
          ['Thursday', 'Website', '7.5'],
          ['Friday', 'Research', '5'],
          ['Total', null, '=SUM(C2:C6)'],
        ],
        widths: [140, 160, 100],
        total: true,
      };
    case 'contacts':
      return {
        rows: [
          ['Name', 'Email', 'Phone', 'Company'],
          ['Jordan Lee', { s: 'jordan@example.com' }, { s: '+44 20 7946 0000' }, 'Northwind'],
          ['Priya Shah', { s: 'priya@example.com' }, { s: '+44 161 496 0000' }, 'Contoso'],
        ],
        widths: [160, 220, 160, 160],
      };
  }
}

// The tints a look uses, for a light or a dark canvas: fixed once set, as any cell colour.
const TINTS = {
  light: {
    head: '#e0f2fe',
    headInk: '#0c4a6e',
    band: '#f8fafc',
    bandInk: '#0f172a',
    line: '#cbd5e1',
  },
  dark: {
    head: '#1f3a56',
    headInk: '#e0f2fe',
    band: '#1a2433',
    bandInk: '#e2e8f0',
    line: '#475569',
  },
} as const;

export type SheetSetup = {
  start: SheetStarter | null;
  look: SheetLook;
  freezeHeader: boolean;
  size: SheetCellSize;
  dark: boolean;
};

// The one write that sets a sheet up: rows grown to fit, the start's cells read as typed, the look's formats, the
// freeze, the widths and sizes, and setup done. Null when the sheet is gone or a start's formula cannot be read.
export function setupWrite(
  wb: Workbook,
  sheetId: string,
  setup: SheetSetup,
  rand: Rand = Math.random,
): SheetWrite | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const size = SHEET_CELL_SIZES[setup.size];
  const rows = (setup.start?.rows ?? []).slice(0, SHEET_ROWS_MAX);
  const changes: LayoutChange[] = [];
  let rowIds = sheet.layout.rows;
  const short = Math.min(rows.length - rowIds.length, SHEET_ROWS_MAX - rowIds.length);
  if (short > 0) {
    const grown = appendAxis(sheet, 'r', short, rand);
    if (grown?.kind === 'layout') {
      changes.push(...grown.changes);
      rowIds = [...rowIds, ...(grown.changes[0] as { ids: string[] }).ids];
    }
  }
  const colIds = sheet.layout.cols;
  const base = wb.ctxFor(sheetId);
  const ctx = changes.length
    ? { ...base, own: { ...base.own, layout: { ...base.own.layout, rows: rowIds } } }
    : base;
  const tint = setup.dark ? TINTS.dark : TINTS.light;
  const width = Math.min(colIds.length, Math.max(0, ...rows.map((r) => r.length)));
  const thin: Border = { w: 1, s: 'solid', c: tint.line };
  const cells: CellChange[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rowIds[i];
    if (!r) break;
    const head = i === 0;
    const total = setup.start?.total && i === rows.length - 1;
    for (let j = 0; j < width; j++) {
      const c = colIds[j]!;
      const v = rows[i]![j] ?? null;
      const ch: CellChange = { r, c };
      if (v !== null) {
        if (typeof v === 'string') {
          const read = readTypedInput(
            v,
            'en-GB',
            ctx,
            sheet.cells.get(cellKey(r, c))?.format?.nf === 'text',
          );
          if (read.kind === 'invalid') return null;
          ch.i = read.kind === 'clear' ? null : read.input;
          if (read.kind === 'value' && read.hint) ch.f = { nf: read.hint.nf };
        } else if ('s' in v) ch.i = { s: v.s };
        else {
          ch.i = { n: v.n };
          if (v.date) ch.f = { nf: 'date' };
        }
      }
      const f: FormatPatch = { ...(ch.f ?? {}) };
      if (!head)
        for (const x of setup.start?.formats ?? []) if (x.col === j) Object.assign(f, x.patch);
      if ((head || total) && setup.look !== 'plain') f.b = true;
      if (head && ['header', 'banded', 'boxed'].includes(setup.look))
        Object.assign(f, { bg: tint.head, fc: tint.headInk });
      if (setup.look === 'banded' && !head && i % 2 === 0)
        Object.assign(f, { bg: tint.band, fc: tint.bandInk });
      if (setup.look === 'boxed') Object.assign(f, { bt: thin, br: thin, bb: thin, bl: thin });
      if (Object.keys(f).length) ch.f = f;
      if (ch.i !== undefined || ch.f) cells.push(ch);
    }
  }
  changes.push({
    k: 'options',
    setupPending: false,
    colWidth: size.width === 120 ? null : size.width,
    rowHeight: size.height === 28 ? null : size.height,
    ...(setup.look === 'minimal' ? { showGrid: false } : {}),
  });
  if (setup.freezeHeader && rows.length > 1) changes.push({ k: 'freeze', rows: 1 });
  const cards = setup.start?.cards;
  if (cards && rowIds[0]) {
    const id = makeAxisIds(1, rand, new Set((sheet.layout.cardTables ?? []).map((t) => t.id)))[0]!;
    const linked: Record<string, string> = {};
    cards.ids.forEach((item, i) => {
      const r = rowIds[i + 1];
      if (r && i < CARD_TABLE_ROWS_MAX) linked[r] = item;
    });
    changes.push({
      k: 'cardTable',
      id,
      table: {
        id,
        head: rowIds[0],
        cols: cards.fields.slice(0, colIds.length).map((field, j) => ({ c: colIds[j]!, field })),
        rows: linked,
        type: cards.type,
        // The column after the fields holds a draft row's Save and Cancel.
        ...(colIds[cards.fields.length] ? { controls: colIds[cards.fields.length] } : {}),
      },
    });
    const controls = colIds[cards.fields.length];
    if (controls) changes.push({ k: 'size', axis: 'c', ids: [controls], px: CARD_CONTROLS_COL_PX });
    // A card table's sheet is the table: the columns past its Controls column would only hold values no card reads,
    // so they go (rows stay, a new row under the table being a new card).
    const extra = colIds.slice(cards.fields.length + 1);
    if (extra.length) changes.push({ k: 'deleteCols', ids: extra });
  }
  // A start's widths, grown with the cell size (a Roomy sheet's columns are wider too).
  const scale = size.width / SHEET_CELL_SIZES.default.width;
  (setup.start?.widths ?? []).forEach((px, j) => {
    const c = colIds[j];
    if (c) changes.push({ k: 'size', axis: 'c', ids: [c], px: Math.round(px * scale) });
  });
  return { kind: 'layout', changes, cells };
}

// Plan cards as a start: a header of the chosen field names, then a row per card (a date field as a date).
export function cardsStarter(
  fields: readonly string[],
  cards: readonly { key: number; id?: string }[],
  fieldOf: (card: { key: number }, field: string) => string | number | boolean | null | undefined,
  // The card type new rows take: linking the rows makes a card table (needs every card's id).
  type?: string,
): SheetStarter {
  const rows: StarterCell[][] = [fields.map((f) => ({ s: f }))];
  for (const card of cards.slice(0, SETUP_CARDS_MAX))
    rows.push(
      fields.map((f) => {
        const v = fieldOf(card, f);
        if (v === null || v === undefined || v === '') return null;
        if (typeof v === 'number') return CARD_DATE_FIELDS.has(f) ? { n: v, date: true } : { n: v };
        return { s: String(v) };
      }),
    );
  const shown = cards.slice(0, SETUP_CARDS_MAX);
  const ids = shown.map((c) => c.id);
  return {
    rows,
    widths: fields.map((f) => (f === 'Title' ? 260 : f === 'Number' ? 90 : 130)),
    ...(type && ids.every((id): id is string => !!id)
      ? { cards: { fields: [...fields], ids: ids as string[], type } }
      : {}),
  };
}

// Clear Sheet (sheet.md "Sheet Settings"): the sheet back to how a placed one starts, as one change: every cell and
// format gone, sizes, hidden lines, freeze, merges, filter, card tables and its look back to the defaults, and
// awaiting setup again (the Setup Sheet card shows). Its rows and columns stay where they are.
export function resetSheetWrite(sheet: Sheet): SheetWrite {
  const { layout } = sheet;
  const changes: LayoutChange[] = [];
  const rowSized = Object.keys(layout.rowSize ?? {});
  const colSized = Object.keys(layout.colSize ?? {});
  if (rowSized.length) changes.push({ k: 'size', axis: 'r', ids: rowSized, px: null });
  if (colSized.length) changes.push({ k: 'size', axis: 'c', ids: colSized, px: null });
  if (layout.hiddenRows?.length)
    changes.push({ k: 'hide', axis: 'r', ids: [...layout.hiddenRows], hidden: false });
  if (layout.hiddenCols?.length)
    changes.push({ k: 'hide', axis: 'c', ids: [...layout.hiddenCols], hidden: false });
  if (layout.frozenRows || layout.frozenCols) changes.push({ k: 'freeze', rows: 0, cols: 0 });
  if (layout.merges?.length) changes.push({ k: 'merges', merges: [] });
  if (layout.filter) changes.push({ k: 'filter', filter: null });
  for (const t of layout.cardTables ?? []) changes.push({ k: 'cardTable', id: t.id, table: null });
  for (const x of layout.names ?? []) changes.push({ k: 'name', name: x.name, range: null });
  changes.push({
    k: 'options',
    showGrid: true,
    showHeaders: true,
    colWidth: null,
    rowHeight: null,
    setupPending: true,
  });
  const cells: CellChange[] = [...sheet.cells.keys()].map((key) => {
    const i = key.indexOf(':');
    return { r: key.slice(0, i), c: key.slice(i + 1), i: null, f: null };
  });
  return { kind: 'layout', changes, cells };
}
