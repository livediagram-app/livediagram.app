// A response as a row of a Sheet (docs/specs/030-forms/forms.md "Responses to a Sheet"): no mapping, a column per
// question. The sheet's first row holds the headers ("#", "Submitted", then each question's wording); a question finds
// its column by its header (ignoring case), a question with none takes the next free column, and the response takes
// the first row after the last row holding anything. Pure: the api plans the write here and stores it through the
// sheet store's own checks.
import {
  makeAxisIds,
  type CellChange,
  type CellInput,
  type LayoutChange,
  type SheetWrite,
} from '@livediagram/sheets';
import type { AnswerValue } from './answers';
import { answerText } from './card';
import { promptOf, questionsOf, type FormDefinition, type FormQuestion } from './model';

const SHEET_NUMBER_HEADER = '#';
const SHEET_SUBMITTED_HEADER = 'Submitted';
// What a preview's "#" cell reads.
export const SHEET_PREVIEW_MARK = 'Preview';

export type SheetRowInput = {
  form: Pick<FormDefinition, 'sections'>;
  answers: ReadonlyMap<string, AnswerValue>;
  // The response number; null for a preview of a form with no link to count it.
  number: number | null;
  preview: boolean;
  at: number;
  layout: { rows: readonly string[]; cols: readonly string[] };
  // The first row's text by column id (only cells holding text).
  header: ReadonlyMap<string, string>;
  // The rows holding any cell.
  usedRows: ReadonlySet<string>;
  rand?: () => number;
};

// The headers a form's rows want, in order, each distinct (a repeated wording gets " (2)", " (3)").
export function sheetHeaders(form: Pick<FormDefinition, 'sections'>): {
  key: string;
  header: string;
  question?: FormQuestion;
}[] {
  const out: { key: string; header: string; question?: FormQuestion }[] = [
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

const pad = (n: number) => String(n).padStart(2, '0');
// "2026-10-15 14:03 UTC": the api knows no one's time zone.
export function submittedText(at: number): string {
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function cellFor(q: FormQuestion, value: AnswerValue): CellInput {
  if (typeof value === 'number') return { n: value };
  if (typeof value === 'boolean') return { b: value };
  return { s: answerText(q, value) };
}

// The one write that adds a response's row: any rows or columns the sheet lacks, the headers it has not got, and the
// row's cells.
export function responseRowWrite(input: SheetRowInput): SheetWrite {
  const { layout, header, usedRows } = input;
  const rand = input.rand ?? Math.random;
  const taken = new Set([...layout.rows, ...layout.cols]);
  const changes: LayoutChange[] = [];
  const cells: CellChange[] = [];
  const rows = [...layout.rows];
  const cols = [...layout.cols];
  const grow = (axis: 'rows' | 'cols', n: number) => {
    if (n <= 0) return;
    const list = axis === 'rows' ? rows : cols;
    const ids = makeAxisIds(n, rand, taken);
    ids.forEach((id) => taken.add(id));
    changes.push({
      k: axis === 'rows' ? 'insertRows' : 'insertCols',
      after: list[list.length - 1] ?? null,
      ids,
    });
    list.push(...ids);
  };

  // The header row, and each header's column.
  grow('rows', 1 - rows.length);
  const headerRow = rows[0]!;
  const byText = new Map<string, string>();
  let lastHeader = -1;
  cols.forEach((c, i) => {
    const t = header.get(c)?.trim();
    if (!t) return;
    lastHeader = i;
    if (!byText.has(t.toLowerCase())) byText.set(t.toLowerCase(), c);
  });
  const wanted = sheetHeaders(input.form);
  const missing = wanted.filter((w) => !byText.has(w.header.toLowerCase()));
  // Every column the new headers need, in one insert, after the last header.
  grow('cols', lastHeader + 1 + missing.length - cols.length);
  const colOf = new Map<string, string>();
  let next = lastHeader + 1;
  for (const w of wanted) {
    const found = byText.get(w.header.toLowerCase());
    if (found) {
      colOf.set(w.key, found);
      continue;
    }
    const c = cols[next]!;
    next += 1;
    colOf.set(w.key, c);
    // A header the form writes is bold, so the first row reads as the table's head.
    cells.push({ r: headerRow, c, i: { s: w.header }, f: { b: true } });
  }

  // A sheet with no headers yet keeps its new header row in view as it fills.
  if (lastHeader < 0) changes.push({ k: 'freeze', rows: 1 });

  // The first row after the last one holding anything (never the header row).
  let last = 0;
  rows.forEach((r, i) => {
    if (usedRows.has(r)) last = Math.max(last, i);
  });
  grow('rows', last + 2 - rows.length);
  const row = rows[last + 1]!;
  const put = (key: string, i: CellInput) => cells.push({ r: row, c: colOf.get(key)!, i });
  // A counted response's number; a preview with none reads Preview, and any preview says so beside its time.
  put('#', input.number === null ? { s: SHEET_PREVIEW_MARK } : { n: input.number });
  put('at', { s: `${submittedText(input.at)}${input.preview ? ` · ${SHEET_PREVIEW_MARK}` : ''}` });
  for (const w of wanted) {
    if (!w.question) continue;
    const value = input.answers.get(w.question.id);
    if (value !== undefined) put(w.key, cellFor(w.question, value));
  }
  return changes.length ? { kind: 'layout', changes, cells } : { kind: 'cells', cells };
}
