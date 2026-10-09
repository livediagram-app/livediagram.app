// Test helpers: a workbook built from A1-keyed typed inputs, as a person would type them.
import { parseA1 } from '../address';
import type { CardSource } from '../cards';
import { Workbook } from '../engine/workbook';
import { cellKey, type Sheet, type SheetLayout } from '../sheet';
import { readTypedInput } from '../typed-input';

export function gridLayout(tag: string, rows = 30, cols = 12): SheetLayout {
  return {
    rows: Array.from({ length: rows }, (_, i) => `${tag}r${i}`),
    cols: Array.from({ length: cols }, (_, i) => `${tag}c${i}`),
  };
}

export type BookSpec = Record<string, Record<string, string>>;

export function makeSheets(spec: BookSpec, opts: { rows?: number; cols?: number } = {}): Sheet[] {
  const sheets: Sheet[] = Object.keys(spec).map((title, i) => ({
    id: `sheet${i}xx`,
    tabId: 'tab',
    title,
    layout: gridLayout(`s${i}`, opts.rows, opts.cols),
    cells: new Map(),
    rev: 0,
    createdAt: i,
    updatedAt: i,
    updatedBy: { id: '', name: '', color: '#000000' },
  }));
  // Compile once every sheet exists, so cross-sheet references resolve.
  const wb = new Workbook({ sheets, locale: 'en-GB' });
  sheets.forEach((sheet, i) => {
    const cells = spec[Object.keys(spec)[i]!]!;
    for (const [a1, text] of Object.entries(cells)) {
      const pos = parseA1(a1)!;
      const read = readTypedInput(text, 'en-GB', wb.ctxFor(sheet.id));
      if (read.kind === 'invalid') throw new Error(`${a1}: ${text} → ${read.reason}`);
      if (read.kind === 'clear') continue;
      sheet.cells.set(cellKey(sheet.layout.rows[pos.r]!, sheet.layout.cols[pos.c]!), {
        input: read.input,
        ...(read.hint
          ? {
              format: {
                nf: read.hint.nf,
                ...(read.hint.cur ? { cur: read.hint.cur as never } : {}),
              },
            }
          : {}),
      });
    }
  });
  return sheets;
}

export function book(
  spec: BookSpec | Record<string, string>,
  opts: {
    now?: number;
    rand?: () => number;
    cards?: CardSource | null;
    rows?: number;
    cols?: number;
  } = {},
) {
  const full: BookSpec = Object.values(spec).every((v) => typeof v === 'string')
    ? { 'Sheet 1': spec as Record<string, string> }
    : (spec as BookSpec);
  const sheets = makeSheets(full, opts);
  const wb = new Workbook({
    sheets,
    locale: 'en-GB',
    now: () => opts.now ?? 46303.5,
    rand: opts.rand ?? (() => 0.5),
    cards: opts.cards ?? null,
  });
  const at = (a1: string, title = Object.keys(full)[0]!) => {
    const sheet = sheets.find((s) => s.title === title)!;
    const pos = parseA1(a1)!;
    return { sheet, pos, value: wb.value(sheet.id, pos.r, pos.c) };
  };
  return {
    wb,
    sheets,
    v: (a1: string, title?: string) => at(a1, title).value,
    // Retype a cell, as the editor would, and tell the workbook.
    set(a1: string, text: string, title = Object.keys(full)[0]!) {
      const { sheet, pos } = at(a1, title);
      const key = cellKey(sheet.layout.rows[pos.r]!, sheet.layout.cols[pos.c]!);
      const read = readTypedInput(text, 'en-GB', wb.ctxFor(sheet.id));
      const cells = new Map(sheet.cells);
      if (read.kind === 'value') cells.set(key, { input: read.input });
      else cells.delete(key);
      const next = { ...sheet, cells };
      sheets[sheets.indexOf(sheet)] = next;
      wb.updateSheet(next, [key]);
    },
  };
}

// A formula's value at J20 (room to spill to L30) on an otherwise empty sheet (plus `cells`).
export function calc(
  formula: string,
  cells: Record<string, string> = {},
  opts: Parameters<typeof book>[1] = {},
) {
  return book({ ...cells, J20: formula }, opts).v('J20');
}
