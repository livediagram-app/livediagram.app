import { describe, expect, it } from 'vitest';
import type { FormDefinition } from '@liveplanner/forms';
import type { Cell } from '@liveplanner/sheets';
import { formColumnsKey, formColumnsSync, headerRowOf, headersByKey } from './form-sheet-columns';

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

describe('headerRowOf', () => {
  it("reads the first row's text, by column", () => {
    expect(
      headerRowOf(
        sheet([
          ['r1:ca', { input: { s: '#' } }],
          ['r1:cb', { input: { n: 4 } }],
          ['r1:cc', { format: { b: true } }],
          ['r2:ca', { input: { s: 'below' } }],
        ]),
      ),
    ).toEqual(new Map([['ca', '#']]));
    expect(headerRowOf(sheet([], []))).toEqual(new Map());
  });
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
