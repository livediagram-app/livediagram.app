import { describe, expect, it } from 'vitest';
import {
  SHEET_PREVIEW_MARK,
  responseRowWrite,
  submittedText,
  type SheetRowInput,
} from './sheet-row';
import { sheetHeaders } from './sheet-columns';
import type { FormDefinition } from './model';

// A response as a row of a Sheet (docs/specs/030-forms/forms.md "Responses to a Sheet").

const form: Pick<FormDefinition, 'sections'> = {
  sections: [
    {
      id: 's',
      title: '',
      questions: [
        { id: 'q-name', type: 'short', prompt: 'Name' },
        { id: 'q-age', type: 'number', prompt: 'Age' },
        { id: 'q-ok', type: 'checkbox', prompt: 'Agree' },
        { id: 'q-diet', type: 'multi', prompt: 'Diet', options: ['Vegan', 'Halal'] },
        { id: 'q-name2', type: 'short', prompt: 'name' },
      ],
    },
  ],
};
const AT = Date.UTC(2026, 9, 15, 14, 3);
let n = 0;
const rand = () => (n = (n * 9301 + 49297) % 233280) / 233280;

const base = (over: Partial<SheetRowInput> = {}): SheetRowInput => ({
  form,
  answers: new Map<string, string | number | boolean | string[]>([
    ['q-name', 'Ada'],
    ['q-age', 36],
    ['q-ok', true],
    ['q-diet', ['Vegan', 'Halal']],
  ]),
  number: 4,
  preview: false,
  at: AT,
  layout: { rows: ['r1', 'r2', 'r3'], cols: ['ca', 'cb', 'cc', 'cd', 'ce', 'cf', 'cg'] },
  header: new Map(),
  usedRows: new Set(),
  rand,
  ...over,
});

describe('sheetHeaders', () => {
  it('leads with # and Submitted, then each question, a repeated wording numbered', () => {
    expect(sheetHeaders(form).map((h) => h.header)).toEqual([
      '#',
      'Submitted',
      'Name',
      'Age',
      'Agree',
      'Diet',
      'name (2)',
    ]);
  });
});

describe('responseRowWrite', () => {
  it('writes the headers (bold, their row frozen) and the first response under them, each answer as its kind', () => {
    const w = responseRowWrite(base());
    expect(w.kind).toBe('layout');
    const cells = w.kind === 'title' ? [] : (w.cells ?? []);
    expect(w.kind === 'layout' && w.changes).toEqual([{ k: 'freeze', rows: 1 }]);
    expect(cells.filter((c) => c.r === 'r1').every((c) => c.f?.b === true)).toBe(true);
    expect(cells.filter((c) => c.r === 'r1').map((c) => c.i)).toEqual(
      ['#', 'Submitted', 'Name', 'Age', 'Agree', 'Diet', 'name (2)'].map((s) => ({ s })),
    );
    expect(cells.filter((c) => c.r === 'r2').map((c) => [c.c, c.i])).toEqual([
      ['ca', { n: 4 }],
      ['cb', { s: '2026-10-15 14:03 UTC' }],
      ['cc', { s: 'Ada' }],
      ['cd', { n: 36 }],
      ['ce', { b: true }],
      ['cf', { s: 'Vegan, Halal' }],
    ]);
  });

  it('finds headers it has by wording, adds the ones it lacks after the last, under the last used row', () => {
    const w = responseRowWrite(
      base({
        header: new Map([
          ['ca', '#'],
          ['cb', 'submitted'],
          ['cc', 'NAME'],
          ['ce', 'Notes'],
        ]),
        usedRows: new Set(['r1', 'r2']),
        number: null,
        preview: true,
      }),
    );
    expect(w.kind).toBe('layout');
    const cells = w.kind === 'layout' ? (w.cells ?? []) : [];
    const added = cells.filter((c) => c.r === 'r1');
    // Age and Agree fill the two columns after Notes; Diet and "name (2)" take new ones.
    expect(added.map((c) => c.i)).toEqual(['Age', 'Agree', 'Diet', 'name (2)'].map((s) => ({ s })));
    expect(added.slice(0, 2).map((c) => c.c)).toEqual(['cf', 'cg']);
    const row = cells.filter((c) => c.r === 'r3');
    expect(row[0]).toEqual({ r: 'r3', c: 'ca', i: { s: SHEET_PREVIEW_MARK } });
    expect(row.find((c) => c.c === 'cc')?.i).toEqual({ s: 'Ada' });
  });

  it('grows the sheet: a header row, more columns and a row past the end', () => {
    const w = responseRowWrite(base({ layout: { rows: [], cols: ['ca'] } }));
    expect(w.kind).toBe('layout');
    if (w.kind !== 'layout') return;
    expect(w.changes.map((c) => c.k)).toEqual(['insertRows', 'insertCols', 'freeze', 'insertRows']);
    const [headerRow, cols, , row] = w.changes as { ids: string[]; after: string | null }[];
    expect(headerRow!.after).toBeNull();
    expect(cols!.ids).toHaveLength(6);
    expect(row!.after).toBe(headerRow!.ids[0]);
    const ids = [...headerRow!.ids, ...cols!.ids, ...row!.ids];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('numbers a counted preview, marking its time', () => {
    const w = responseRowWrite({ ...base({ preview: true, number: 9 }), rand: undefined });
    const cells = w.kind === 'title' ? [] : (w.cells ?? []);
    expect(
      cells
        .filter((c) => c.r === 'r2')
        .slice(0, 2)
        .map((c) => c.i),
    ).toEqual([{ n: 9 }, { s: '2026-10-15 14:03 UTC · Preview' }]);
  });

  it('keeps the first of two columns with the same header, past a blank one', () => {
    const w = responseRowWrite(
      base({
        header: new Map([
          ['ca', '#'],
          ['cb', ' '],
          ['cc', '#'],
        ]),
      }),
    );
    const cells = w.kind === 'title' ? [] : (w.cells ?? []);
    expect(cells.find((c) => c.i && 'n' in c.i)?.c).toBe('ca');
  });

  it('writes only the row once every header is there and the sheet has room', () => {
    const header = new Map(
      ['#', 'Submitted', 'Name', 'Age', 'Agree', 'Diet', 'name (2)'].map(
        (h, i) => [['ca', 'cb', 'cc', 'cd', 'ce', 'cf', 'cg'][i]!, h] as const,
      ),
    );
    const w = responseRowWrite(base({ header, usedRows: new Set(['r1']) }));
    expect(w.kind).toBe('cells');
    expect(w.kind === 'cells' && w.cells.every((c) => c.r === 'r2')).toBe(true);
  });

  it('reads the time in UTC', () => {
    expect(submittedText(Date.UTC(2026, 0, 2, 3, 4))).toBe('2026-01-02 03:04 UTC');
  });
});

describe('responseRowWrite with remembered columns', () => {
  it('writes each answer under its remembered column, whatever its header now reads', () => {
    const write = responseRowWrite(
      base({
        header: new Map([
          ['ca', 'Number'],
          ['cb', 'When'],
          ['cc', 'Full name'],
          ['cd', 'Years'],
          ['ce', 'Agree'],
          ['cf', 'Diet'],
          ['cg', 'name (2)'],
        ]),
        usedRows: new Set(['r1', 'r2']),
        columns: { '#': 'ca', at: 'cb', 'q-name': 'cc', 'q-age': 'cd' },
      }),
    );
    expect(write.kind).toBe('cells');
    const cells = write.kind === 'cells' ? write.cells : [];
    // No header is written: each key found its column, remembered or by header.
    expect(cells.filter((c) => c.r === 'r1')).toEqual([]);
    expect(cells).toContainEqual({ r: 'r3', c: 'ca', i: { n: 4 } });
    expect(cells).toContainEqual({ r: 'r3', c: 'cc', i: { s: 'Ada' } });
    expect(cells).toContainEqual({ r: 'r3', c: 'cd', i: { n: 36 } });
    expect(cells).toContainEqual({ r: 'r3', c: 'ce', i: { b: true } });
  });

  it('forgets a remembered column the sheet no longer has, and finds the header instead', () => {
    const write = responseRowWrite(
      base({
        header: new Map([['cc', 'Name']]),
        columns: { 'q-name': 'gone1' },
      }),
    );
    const cells = write.kind === 'layout' ? (write.cells ?? []) : [];
    expect(cells).toContainEqual({ r: 'r2', c: 'cc', i: { s: 'Ada' } });
  });
});
