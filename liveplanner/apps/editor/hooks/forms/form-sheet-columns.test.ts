import { describe, expect, it } from 'vitest';
import type { FormDefinition } from '@liveplanner/forms';
import type { Cell } from '@liveplanner/sheets';
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
