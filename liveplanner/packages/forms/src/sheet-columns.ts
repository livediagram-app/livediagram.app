// A sheet form's columns (docs/specs/030-forms/forms.md "Responses to a Sheet", "Linked by column, not by heading"):
// which column each header (#, Submitted, each question) lives in, and the write that gives the sheet the headers it
// lacks. A remembered column (`form.sheet.columns`) wins while it is still in the sheet, whatever its heading now
// reads; else a column whose header matches, ignoring case; else a new column after the last header. Pure: the
// builder plans its header sync here, and the api plans each response's row on the same plan.
import {
  makeAxisIds,
  type CellChange,
  type LayoutChange,
  type SheetWrite,
} from '@liveplanner/sheets';
import { promptOf, questionsOf, type FormDefinition, type FormQuestion } from './model';

const SHEET_NUMBER_HEADER = '#';
const SHEET_SUBMITTED_HEADER = 'Submitted';

export type SheetHeader = { key: string; header: string; question?: FormQuestion };

// The headers a form's rows want, in order, each distinct (a repeated wording gets " (2)", " (3)").
export function sheetHeaders(form: Pick<FormDefinition, 'sections'>): SheetHeader[] {
  const out: SheetHeader[] = [
    { key: '#', header: SHEET_NUMBER_HEADER },
    { key: 'at', header: SHEET_SUBMITTED_HEADER },
  ];
  const seen = new Set(out.map((h) => h.header.toLowerCase()));
  for (const q of questionsOf(form)) {
    const base = promptOf(q);
    let header = base;
    for (let n = 2; seen.has(header.toLowerCase()); n++) header = `${base} (${n})`;
    seen.add(header.toLowerCase());
    out.push({ key: q.id, header, question: q });
  }
  return out;
}

export type SheetColumnsInput = {
  form: Pick<FormDefinition, 'sections'>;
  layout: { rows: readonly string[]; cols: readonly string[] };
  // The first row's text by column id (only cells holding text).
  header: ReadonlyMap<string, string>;
  // The columns the form remembers (form.sheet.columns).
  columns?: Readonly<Record<string, string>> | undefined;
  // The header each key had when the builder last looked: a remembered column still reading it follows the wording.
  renamed?: ReadonlyMap<string, string> | undefined;
  rand?: () => number;
};

export type SheetColumnPlan = {
  // Rows and columns to insert, and the freeze a sheet given its first headers gets.
  changes: LayoutChange[];
  // The header cells to write.
  cells: CellChange[];
  // Each key's column.
  colOf: Map<string, string>;
  // What the form should remember: every key's column.
  columns: Record<string, string>;
  // The sheet's rows, the header row first, with any inserted (for the response row after them).
  rows: string[];
  // Every id the plan has taken (for more inserts).
  taken: Set<string>;
};

const norm = (t: string) => t.trim().toLowerCase();

export function sheetColumnPlan(input: SheetColumnsInput): SheetColumnPlan {
  const { layout, header } = input;
  const rand = input.rand ?? Math.random;
  const taken = new Set([...layout.rows, ...layout.cols]);
  const changes: LayoutChange[] = [];
  const cells: CellChange[] = [];
  const rows = [...layout.rows];
  const cols = [...layout.cols];
  const inLayout = new Set(cols);

  // The header row, there to write into.
  if (rows.length === 0) {
    const ids = makeAxisIds(1, rand, taken);
    ids.forEach((id) => taken.add(id));
    changes.push({ k: 'insertRows', after: null, ids });
    rows.push(...ids);
  }
  const headerRow = rows[0]!;

  const wanted = sheetHeaders(input.form);
  const colOf = new Map<string, string>();
  const claimed = new Set<string>();
  // 1. Remembered columns still in the sheet, each claimed once.
  for (const w of wanted) {
    const c = input.columns?.[w.key];
    if (!c || !inLayout.has(c) || claimed.has(c)) continue;
    colOf.set(w.key, c);
    claimed.add(c);
    // Still reading the wording it had, it follows the new one; renamed in the sheet, it is kept.
    const was = input.renamed?.get(w.key);
    const now = header.get(c);
    if (was !== undefined && now !== undefined && norm(now) === norm(was) && now !== w.header)
      cells.push({ r: headerRow, c, i: { s: w.header } });
  }
  // 2. A header that reads the same, in a column no other key has.
  const byText = new Map<string, string>();
  let lastHeader = -1;
  cols.forEach((c, i) => {
    const t = header.get(c);
    if (!t?.trim()) return;
    lastHeader = i;
    if (!claimed.has(c) && !byText.has(norm(t))) byText.set(norm(t), c);
  });
  const hadHeaders = lastHeader >= 0;
  for (const w of wanted) {
    if (colOf.has(w.key)) continue;
    // sheetHeaders makes each header distinct, so no two keys meet one column here.
    const c = byText.get(norm(w.header));
    if (!c) continue;
    colOf.set(w.key, c);
    claimed.add(c);
  }
  // 3. The rest: new columns after the last header (and after any remembered column), in one insert when the sheet
  // has too few.
  const missing = wanted.filter((w) => !colOf.has(w.key));
  cols.forEach((c, i) => {
    if (claimed.has(c)) lastHeader = Math.max(lastHeader, i);
  });
  const short = lastHeader + 1 + missing.length - cols.length;
  if (short > 0) {
    const ids = makeAxisIds(short, rand, taken);
    ids.forEach((id) => taken.add(id));
    changes.push({ k: 'insertCols', after: cols[cols.length - 1] ?? null, ids });
    cols.push(...ids);
  }
  let next = lastHeader + 1;
  for (const w of missing) {
    const c = cols[next]!;
    next += 1;
    colOf.set(w.key, c);
    // A header the form writes is bold, so the first row reads as the table's head.
    cells.push({ r: headerRow, c, i: { s: w.header }, f: { b: true } });
  }
  // A sheet with no headers yet keeps its new header row in view as it fills.
  if (!hadHeaders && missing.length) changes.push({ k: 'freeze', rows: 1 });

  const columns: Record<string, string> = {};
  for (const w of wanted) columns[w.key] = colOf.get(w.key)!;
  return { changes, cells, colOf, columns, rows, taken };
}

// The builder's header sync: the write that gives the sheet every header it lacks (null when none is missing), and
// the columns the form should remember.
export function sheetHeadersWrite(input: SheetColumnsInput): {
  write: SheetWrite | null;
  columns: Record<string, string>;
} {
  const plan = sheetColumnPlan(input);
  const write: SheetWrite | null = plan.changes.length
    ? { kind: 'layout', changes: plan.changes, cells: plan.cells }
    : plan.cells.length
      ? { kind: 'cells', cells: plan.cells }
      : null;
  return { write, columns: plan.columns };
}

// Whether two remembered column sets say the same.
export function sameSheetColumns(
  a: Readonly<Record<string, string>> | undefined,
  b: Readonly<Record<string, string>> | undefined,
): boolean {
  const ka = Object.keys(a ?? {});
  if (ka.length !== Object.keys(b ?? {}).length) return false;
  return ka.every((k) => a![k] === b?.[k]);
}
