import { describe, expect, it } from 'vitest';
import {
  headerRowIndex,
  responseRowWrite,
  topRowTexts,
  type FormDefinition,
} from '@liveplanner/forms';
import {
  applySheetWrite,
  cellKey,
  sheetFromJson,
  sheetFromTemplate,
  type Cell,
  type Sheet,
  type SheetWrite,
} from '@liveplanner/sheets';
import { formColumnsKey, formColumnsSync, headersByKey } from './form-sheet-columns';

// A sheet form's columns as the builder keeps them (docs/specs/030-forms/forms.md "Columns before any response").

const form = (over: Partial<FormDefinition> = {}): FormDefinition => ({
  v: 1,
  heading: 'Sign Up',
  sections: [
    { id: 's-1', title: '', questions: [{ id: 'q-name', type: 'short', prompt: 'Name' }] },
  ],
  sheet: { tabId: 'stab', sheetId: 'shtAAAAAA001' },
  ...over,
});
const sheet = (cells: [string, Cell][] = [], rows = ['r1', 'r2']) => ({
  layout: { rows, cols: ['ca', 'cb', 'cc'] },
  cells: new Map(cells),
});

describe('formColumnsSync', () => {
  it('gives an empty sheet its headers and remembers their columns', () => {
    const f = form();
    const { write, columns } = formColumnsSync({ ...f, sheet: f.sheet! }, sheet());
    expect(write?.kind).toBe('layout');
    expect(columns).toEqual({ '#': 'ca', at: 'cb', 'q-name': 'cc' });
  });

  it('writes nothing when the remembered columns are all there, renamed or not', () => {
    const f = form({
      sheet: {
        tabId: 'stab',
        sheetId: 'shtAAAAAA001',
        columns: { '#': 'ca', at: 'cb', 'q-name': 'cc' },
      },
    });
    const s = sheet([
      ['r1:ca', { input: { s: '#' } }],
      ['r1:cb', { input: { s: 'Submitted' } }],
      ['r1:cc', { input: { s: 'Who' } }],
    ]);
    expect(formColumnsSync({ ...f, sheet: f.sheet! }, s, headersByKey(f)).write).toBeNull();
  });

  // Work Tracker 866: a question added on a template sheet and named slowly matches the template's column.
  it('gives a blank question no column, and its first wording the template header of that name', () => {
    // A template's head under its title (row 1), as Contacts: Name in the first column.
    const s = {
      layout: { rows: ['r1', 'r2', 'r3'], cols: ['ca', 'cb', 'cc', 'cd'] },
      cells: new Map<string, Cell>([
        ['r1:ca', { input: { s: 'Contacts' } }],
        ['r2:ca', { input: { s: 'Name' } }],
        ['r2:cb', { input: { s: 'Email' } }],
      ]),
    };
    const blank = form();
    blank.sections[0]!.questions[0]!.prompt = '';
    const first = formColumnsSync({ ...blank, sheet: blank.sheet! }, s, headersByKey(blank));
    // # and Submitted only: the blank question claims no column and is not remembered.
    expect(first.columns).toEqual({ '#': 'cc', at: 'cd' });
    expect(headersByKey(blank).has('q-name')).toBe(false);
    expect(formColumnsKey(blank)).not.toContain('Untitled Question');
    // Named later, with the columns the builder remembered, it matches the template's Name column.
    const named = form({
      sheet: { tabId: 'stab', sheetId: 'shtAAAAAA001', columns: first.columns },
    });
    const withHeads = {
      ...s,
      cells: new Map<string, Cell>([
        ...s.cells,
        ['r2:cc', { input: { s: '#' } }],
        ['r2:cd', { input: { s: 'Submitted' } }],
      ]),
    };
    const next = formColumnsSync({ ...named, sheet: named.sheet! }, withHeads, headersByKey(blank));
    expect(next.columns['q-name']).toBe('ca');
    expect(next.write).toBeNull();
  });
});

// Work Tracker 899: on the Contacts template, Name and Email typed a letter at a time with a sync after every letter
// (more than FORM_COLUMNS_SYNC_MS between keys) land in the template's Name and Email columns (A and D), not in the
// columns their first letters claimed.
describe('a question named letter by letter on the Contacts template', () => {
  let seed = 0;
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const by = { id: 'f', name: 'Form', color: '#000000' };
  const contacts = (): Sheet => {
    const made = sheetFromTemplate({
      id: 'sheetT0001',
      tabId: 'stab',
      template: 'contacts',
      now: Date.UTC(2026, 9, 11),
      dark: false,
      rand,
    })!;
    return sheetFromJson({ ...made.sheet, rev: 0, createdAt: 0, updatedAt: 0, updatedBy: by });
  };
  const apply = (s: Sheet, write: SheetWrite) => applySheetWrite(s, write, { now: 0, by }).sheet;
  const text = (s: Sheet, r: number, c: number) => {
    const i = s.cells.get(cellKey(s.layout.rows[r]!, s.layout.cols[c]!))?.input;
    return i && 's' in i ? i.s : undefined;
  };

  it('lands the answers in the template’s columns', () => {
    let sheet = contacts();
    const cols = sheet.layout.cols.length;
    let f = form({
      sections: [
        {
          id: 's-1',
          title: '',
          questions: [
            { id: 'q-name', type: 'short', prompt: '' },
            { id: 'q-email', type: 'short', prompt: '' },
          ],
        },
      ],
      sheet: { tabId: 'stab', sheetId: 'sheetT0001' },
    });
    let renamed: Map<string, string> | undefined;
    // The builder's sync, as useFormSheetColumns runs it once typing pauses.
    const sync = () => {
      const plan = formColumnsSync({ ...f, sheet: f.sheet! }, sheet, renamed);
      if (plan.write) sheet = apply(sheet, plan.write);
      renamed = headersByKey(f);
      f = { ...f, sheet: { ...f.sheet!, columns: plan.columns } };
    };
    const type = (q: number, word: string) => {
      for (let n = 1; n <= word.length; n++) {
        f.sections[0]!.questions[q]!.prompt = word.slice(0, n);
        sync();
      }
    };
    sync();
    type(0, 'Name');
    type(1, 'Email');
    expect(f.sheet!.columns).toMatchObject({
      'q-name': sheet.layout.cols[0],
      'q-email': sheet.layout.cols[3],
    });
    // # and Submitted the only headers added (in the template's spare columns), and no half-typed header left on
    // the header row (row 4).
    expect(sheet.layout.cols).toHaveLength(cols);
    const head = sheet.layout.cols.map((_, c) => text(sheet, 3, c)).filter(Boolean);
    expect(head.slice(-2)).toEqual(['#', 'Submitted']);
    expect(head.filter((h) => /^(N|Na|Nam|E|Em|Ema|Emai)$/.test(h!))).toEqual([]);
    // A response lands in A and D.
    const rowTexts = topRowTexts(sheet);
    const write = responseRowWrite({
      form: f,
      answers: new Map([
        ['q-name', 'Ada Lovelace'],
        ['q-email', 'ada@example.com'],
      ]),
      number: 1,
      preview: false,
      at: 0,
      layout: sheet.layout,
      rowTexts,
      columns: f.sheet!.columns,
      usedRows: new Set([sheet.layout.rows[headerRowIndex(f, sheet.layout.rows, rowTexts)]!]),
      rand,
    });
    const after = apply(sheet, write);
    const row = after.layout.rows.findIndex((_, r) => text(after, r, 0) === 'Ada Lovelace');
    expect(row).toBeGreaterThan(3);
    expect(text(after, row, 3)).toBe('ada@example.com');
  });

  it('keeps a column that already holds an answer, its header following the wording', () => {
    let sheet = contacts();
    let f = form({ sheet: { tabId: 'stab', sheetId: 'sheetT0001' } });
    f.sections[0]!.questions[0]!.prompt = 'N';
    let plan = formColumnsSync({ ...f, sheet: f.sheet! }, sheet);
    sheet = apply(sheet, plan.write!);
    const col = plan.columns['q-name']!;
    expect(col).not.toBe(sheet.layout.cols[0]);
    // An answer in that column, below the header row.
    const cells = new Map(sheet.cells);
    cells.set(cellKey(sheet.layout.rows[5]!, col), { input: { s: 'Grace' } });
    sheet = { ...sheet, cells };
    const renamed = headersByKey(f);
    f = { ...f, sheet: { ...f.sheet!, columns: plan.columns } };
    f.sections[0]!.questions[0]!.prompt = 'Name';
    plan = formColumnsSync({ ...f, sheet: f.sheet! }, sheet, renamed);
    expect(plan.columns['q-name']).toBe(col);
  });
});

describe('formColumnsKey', () => {
  it('names the sheet, every header and the columns, and nothing for a form with no sheet', () => {
    expect(formColumnsKey(null)).toBeNull();
    expect(formColumnsKey(form({ sheet: undefined }))).toBeNull();
    const a = formColumnsKey(form());
    expect(a).toContain('Name');
    expect(formColumnsKey(form())).toBe(a);
    const renamed = form();
    renamed.sections[0]!.questions[0]!.prompt = 'Full name';
    expect(formColumnsKey(renamed)).not.toBe(a);
  });
});
