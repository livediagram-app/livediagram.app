// A response as a row of a Sheet (docs/specs/030-forms/forms.md "Responses to a Sheet"): no mapping, a column per
// question. The sheet's first row holds the headers ("#", "Submitted", then each question's wording); each finds its
// column as sheet-columns.ts plans (remembered, else by header, else new), and the response takes the first row after
// the last row holding a value. Pure: the api plans the write here and stores it through the sheet store's own checks.
import { makeAxisIds, type CellInput, type SheetWrite } from '@liveplanner/sheets';
import type { AnswerValue } from './answers';
import { answerText } from './card';
import { questionsOf, type FormDefinition, type FormQuestion } from './model';
import { sheetColumnPlan } from './sheet-columns';

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
  // The rows holding a value.
  usedRows: ReadonlySet<string>;
  // The columns the form remembers (form.sheet.columns).
  columns?: Readonly<Record<string, string>> | undefined;
  rand?: () => number;
};

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
  const { usedRows } = input;
  const rand = input.rand ?? Math.random;
  const plan = sheetColumnPlan({
    form: input.form,
    layout: input.layout,
    header: input.header,
    columns: input.columns,
    rand,
  });
  const { changes, cells, colOf, rows, taken } = plan;

  // The first row after the last one holding a value (never the header row).
  let last = 0;
  rows.forEach((r, i) => {
    if (usedRows.has(r)) last = Math.max(last, i);
  });
  const short = last + 2 - rows.length;
  if (short > 0) {
    const ids = makeAxisIds(short, rand, taken);
    changes.push({ k: 'insertRows', after: rows[rows.length - 1]!, ids });
    rows.push(...ids);
  }
  const row = rows[last + 1]!;
  const put = (key: string, i: CellInput) => cells.push({ r: row, c: colOf.get(key)!, i });
  // A counted response's number; a preview with none reads Preview, and any preview says so beside its time.
  put('#', input.number === null ? { s: SHEET_PREVIEW_MARK } : { n: input.number });
  put('at', { s: `${submittedText(input.at)}${input.preview ? ` · ${SHEET_PREVIEW_MARK}` : ''}` });
  for (const q of questionsOf(input.form)) {
    const value = input.answers.get(q.id);
    if (value !== undefined) put(q.id, cellFor(q, value));
  }
  return changes.length ? { kind: 'layout', changes, cells } : { kind: 'cells', cells };
}
