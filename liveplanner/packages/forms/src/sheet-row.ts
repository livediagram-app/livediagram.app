// A response as a row of a Sheet (docs/specs/030-forms/forms.md "Responses to a Sheet"): no mapping, a column per
// question. The sheet's first row holds the headers ("#", "Submitted", then each question's wording); each finds its
// column as sheet-columns.ts plans (remembered, else by header, else new), and the response takes the first row after
// the last row holding a value, or, when that row is a template table's total, a row inside the table above it. Pure: the api plans the write here and stores it through the sheet store's own checks.
import {
  makeAxisIds,
  type CellChange,
  type CellInput,
  type StoredRef,
  type SheetWrite,
} from '@liveplanner/sheets';
import type { AnswerValue } from './answers';
import { answerText } from './card';
import { submittedDay } from './fixed';
import { questionsOf, type FormQuestion, type SheetFixedColumn } from './model';
import { sheetColumnPlan, type RowTexts, type SheetForm } from './sheet-columns';

// What a preview's "#" cell reads.
export const SHEET_PREVIEW_MARK = 'Preview';

export type SheetRowInput = {
  form: SheetForm;
  answers: ReadonlyMap<string, AnswerValue>;
  // The response number; null for a preview of a form with no link to count it.
  number: number | null;
  preview: boolean;
  at: number;
  layout: { rows: readonly string[]; cols: readonly string[] };
  // The top rows' text (only cells holding text), where the header row is found (sheet-columns.ts).
  rowTexts?: RowTexts | undefined;
  // Or the first row's text by column id, when the header row is known to be the first.
  header?: ReadonlyMap<string, string> | undefined;
  // The rows holding a value.
  usedRows: ReadonlySet<string>;
  // The columns the form remembers (form.sheet.columns).
  columns?: Readonly<Record<string, string>> | undefined;
  // A template's table whose last row holding a value is its total (isTotalRow): the response goes inside it.
  table?: SheetTable | undefined;
  rand?: () => number;
};

// A table under the header row that ends in a total: the total row, its inputs by column, and the first empty row
// between the header and it (null when none was found); with none, the inputs of the row above the total, whose
// per-row formulas a new row takes.
export type SheetTable = {
  total: string;
  totalInputs: ReadonlyMap<string, CellInput>;
  empty: string | null;
  aboveInputs?: ReadonlyMap<string, CellInput> | undefined;
};

// How many rows under the header the api looks through for a table's first empty row.
export const TABLE_GAP_ROWS = 256;

// A same-sheet reference over two or more rows (`A5:A10`), the kind a total sums or counts.
const rowSpan = (ref: StoredRef) =>
  ref.s === undefined && ref.st === undefined && !!ref.r1 && !!ref.r2 && ref.r1 !== ref.r2;

// Whether a row's inputs make a total: every one a formula, and at least one over a range of rows.
export function isTotalRow(inputs: Iterable<CellInput>): boolean {
  let spans = false;
  for (const i of inputs) {
    if (!('f' in i)) return false;
    if (i.f.r.some(rowSpan)) spans = true;
  }
  return spans;
}

// The row above's formulas, copied into the row put in under it as a spreadsheet's fill down would: each reference
// to a row moved one row down (its own row's to the new row), an absolute row ($5) kept. A formula with a relative
// reference to another sheet's row, or to a row below the row above, is left out (nothing to move it to safely);
// so are the columns the response writes.
function filledDown(
  inputs: ReadonlyMap<string, CellInput>,
  rows: readonly string[],
  above: string,
  added: string,
  skip: ReadonlySet<string>,
): CellChange[] {
  const at = rows.indexOf(above);
  const down = (id: string | undefined, fixed: boolean): string | undefined | null => {
    if (id === undefined || fixed) return id;
    const i = rows.indexOf(id);
    if (i < 0 || i > at) return null;
    return i === at ? added : rows[i + 1]!;
  };
  const out: CellChange[] = [];
  for (const [c, i] of inputs) {
    if (!('f' in i) || skip.has(c)) continue;
    let ok = true;
    const r = i.f.r.map((ref) => {
      const a = ref.a ?? 0;
      if (ref.s !== undefined || ref.st !== undefined) {
        // Another sheet's rows move only when relative: then the formula is left out.
        if ((ref.r1 !== undefined && !(a & 1)) || (ref.r2 !== undefined && !(a & 4))) ok = false;
        return ref;
      }
      const r1 = down(ref.r1, (a & 1) !== 0);
      const r2 = down(ref.r2, (a & 4) !== 0);
      if (r1 === null || r2 === null) ok = false;
      return {
        ...ref,
        ...(r1 ? { r1 } : {}),
        ...(r2 ? { r2 } : {}),
      };
    });
    if (ok) out.push({ r: added, c, i: { f: { t: i.f.t, r } } });
  }
  return out;
}

// The total's formulas whose range ended on `above`, rewritten to end on `added` (the row put in under it).
function grownTotal(table: SheetTable, above: string, added: string): CellChange[] {
  const out: CellChange[] = [];
  for (const [c, i] of table.totalInputs) {
    if (!('f' in i)) continue;
    let grew = false;
    const r = i.f.r.map((ref) => {
      if (!rowSpan(ref) || ref.r2 !== above) return ref;
      grew = true;
      return { ...ref, r2: added };
    });
    if (grew) out.push({ r: table.total, c, i: { f: { t: i.f.t, r } } });
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
// "2026-10-15 14:03 UTC": the api knows no one's time zone.
export function submittedText(at: number): string {
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

// An extra column's cell: its number or text, or the submitted day (YYYY-MM-DD in its zone).
function fixedCell(c: SheetFixedColumn, at: number): CellInput {
  if ('submitted' in c) return { s: submittedDay(at, c.submitted.tz, c.submitted.days) };
  return typeof c.value === 'number' ? { n: c.value } : { s: c.value };
}

function cellFor(q: FormQuestion, value: AnswerValue): CellInput {
  if (typeof value === 'number') return { n: value };
  if (typeof value === 'boolean') return { b: value };
  return { s: answerText(q, value) };
}

// The one write that adds a response's row: any rows or columns the sheet lacks, the headers it has not got, and the
// row's cells.
export function responseRowWrite(input: SheetRowInput): SheetWrite {
  const { usedRows } = input;
  const rand = input.rand ?? Math.random;
  const plan = sheetColumnPlan({
    form: input.form,
    layout: input.layout,
    header: input.header,
    rowTexts: input.rowTexts,
    columns: input.columns,
    rand,
  });
  const { changes, cells, colOf, rows, headerIndex, taken } = plan;

  // The first row after the last one holding a value (never the header row or any above it).
  let last = headerIndex;
  rows.forEach((r, i) => {
    if (usedRows.has(r)) last = Math.max(last, i);
  });
  const total = input.table ? rows.indexOf(input.table.total) : -1;
  let row: string;
  if (input.table && total > headerIndex) {
    // Inside a template's table: its first empty row, else a new row just above its total, which grows to count it.
    const empty = input.table.empty === null ? -1 : rows.indexOf(input.table.empty);
    if (empty > headerIndex && empty < total) row = rows[empty]!;
    else {
      const above = rows[total - 1]!;
      const [added] = makeAxisIds(1, rand, taken);
      changes.push({ k: 'insertRows', after: above, ids: [added!] });
      row = added!;
      cells.push(...grownTotal(input.table, above, row));
      if (input.table.aboveInputs)
        cells.push(
          ...filledDown(input.table.aboveInputs, rows, above, row, new Set(colOf.values())),
        );
    }
  } else {
    const short = last + 2 - rows.length;
    if (short > 0) {
      const ids = makeAxisIds(short, rand, taken);
      changes.push({ k: 'insertRows', after: rows[rows.length - 1]!, ids });
      rows.push(...ids);
    }
    row = rows[last + 1]!;
  }
  const put = (key: string, i: CellInput) => cells.push({ r: row, c: colOf.get(key)!, i });
  // A counted response's number; a preview with none reads Preview, and any preview says so beside its time.
  put('#', input.number === null ? { s: SHEET_PREVIEW_MARK } : { n: input.number });
  put('at', { s: `${submittedText(input.at)}${input.preview ? ` · ${SHEET_PREVIEW_MARK}` : ''}` });
  for (const q of questionsOf(input.form)) {
    const value = input.answers.get(q.id);
    if (value !== undefined) put(q.id, cellFor(q, value));
  }
  for (const c of input.form.sheet?.fixed ?? []) put(c.id, fixedCell(c, input.at));
  return changes.length ? { kind: 'layout', changes, cells } : { kind: 'cells', cells };
}
