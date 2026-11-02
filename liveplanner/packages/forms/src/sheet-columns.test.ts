import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  sameSheetColumns,
  sheetColumnPlan,
  sheetHeadersWrite,
  type SheetColumnsInput,
} from './sheet-columns';
import type { FormDefinition } from './model';

// A sheet form's columns (docs/specs/030-forms/forms.md "Columns before any response", "Linked by column, not by
// heading").

const form = (prompts: string[]): Pick<FormDefinition, 'sections'> => ({
  sections: [
    {
      id: 's',
      title: '',
      questions: prompts.map((prompt, i) => ({ id: `q-${i}`, type: 'short' as const, prompt })),
    },
  ],
});
let n = 0;
const rand = () => (n = (n * 9301 + 49297) % 233280) / 233280;
const input = (over: Partial<SheetColumnsInput> = {}): SheetColumnsInput => ({
  form: form(['Name', 'Email']),
  layout: { rows: ['r1', 'r2'], cols: ['ca', 'cb', 'cc', 'cd', 'ce'] },
  header: new Map(),
  rand,
  ...over,
});

describe('sheetHeadersWrite', () => {
  it('gives an empty sheet every header, bold, its header row frozen, and remembers each column', () => {
    const { write, columns } = sheetHeadersWrite(input());
    expect(write).toEqual({
      kind: 'layout',
      changes: [{ k: 'freeze', rows: 1 }],
      cells: [
        { r: 'r1', c: 'ca', i: { s: '#' }, f: { b: true } },
        { r: 'r1', c: 'cb', i: { s: 'Submitted' }, f: { b: true } },
        { r: 'r1', c: 'cc', i: { s: 'Name' }, f: { b: true } },
        { r: 'r1', c: 'cd', i: { s: 'Email' }, f: { b: true } },
      ],
    });
    expect(columns).toEqual({ '#': 'ca', at: 'cb', 'q-0': 'cc', 'q-1': 'cd' });
  });

  it('writes nothing once every header is in place', () => {
    const { write, columns } = sheetHeadersWrite(
      input({
        header: new Map([
          ['ca', '#'],
          ['cb', 'Submitted'],
          ['cc', 'name'],
          ['cd', 'Email'],
        ]),
      }),
    );
    expect(write).toBeNull();
    expect(columns).toEqual({ '#': 'ca', at: 'cb', 'q-0': 'cc', 'q-1': 'cd' });
  });

  it('adds a new question after the last header, columns inserted when the sheet has too few', () => {
    const { write, columns } = sheetHeadersWrite(
      input({
        form: form(['Name', 'Email', 'Phone']),
        layout: { rows: ['r1'], cols: ['ca', 'cb', 'cc', 'cd'] },
        header: new Map([
          ['ca', '#'],
          ['cb', 'Submitted'],
          ['cc', 'Name'],
          ['cd', 'Email'],
        ]),
      }),
    );
    expect(write?.kind).toBe('layout');
    const changes = write?.kind === 'layout' ? write.changes : [];
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ k: 'insertCols', after: 'cd' });
    const added = (changes[0] as { ids: string[] }).ids[0]!;
    expect(columns['q-2']).toBe(added);
    expect(write?.kind === 'layout' && write.cells).toEqual([
      { r: 'r1', c: added, i: { s: 'Phone' }, f: { b: true } },
    ]);
  });

  it('keeps a remembered column linked after its heading is renamed in the sheet', () => {
    const { write, columns } = sheetHeadersWrite(
      input({
        header: new Map([
          ['ca', '#'],
          ['cb', 'Submitted'],
          ['cc', 'Full name'],
          ['cd', 'Email'],
        ]),
        columns: { '#': 'ca', at: 'cb', 'q-0': 'cc', 'q-1': 'cd' },
        renamed: new Map([['q-0', 'Name']]),
      }),
    );
    expect(write).toBeNull();
    expect(columns['q-0']).toBe('cc');
  });

  it('carries a new wording to its column while the header still reads the old one', () => {
    const { write } = sheetHeadersWrite(
      input({
        form: form(['Your name', 'Email']),
        header: new Map([
          ['ca', '#'],
          ['cb', 'Submitted'],
          ['cc', 'Name'],
          ['cd', 'Email'],
        ]),
        columns: { '#': 'ca', at: 'cb', 'q-0': 'cc', 'q-1': 'cd' },
        renamed: new Map([['q-0', 'name']]),
      }),
    );
    expect(write).toEqual({ kind: 'cells', cells: [{ r: 'r1', c: 'cc', i: { s: 'Your name' } }] });
  });

  it('finds a remembered column wherever it moved, and a header column no other key holds', () => {
    const plan = sheetColumnPlan(
      input({
        layout: { rows: ['r1'], cols: ['cx', 'ca', 'cb', 'cc'] },
        header: new Map([
          ['cx', 'Email'],
          ['ca', '#'],
          ['cb', 'Submitted'],
          ['cc', 'Email'],
        ]),
        // The name's column moved to the front and reads Email now: it stays the name's.
        columns: { 'q-0': 'cx' },
      }),
    );
    expect(plan.colOf.get('q-0')).toBe('cx');
    expect(plan.colOf.get('q-1')).toBe('cc');
    expect(plan.cells).toEqual([]);
  });

  it('makes the header row of a sheet with no rows, and a column after a remembered one past the headers', () => {
    const plan = sheetColumnPlan(
      input({
        form: form(['Name']),
        layout: { rows: [], cols: ['ca', 'cb', 'cc', 'cd'] },
        columns: { '#': 'ca', at: 'cb', 'q-0': 'cd' },
      }),
    );
    expect(plan.changes[0]).toMatchObject({ k: 'insertRows', after: null });
    expect(plan.rows).toHaveLength(1);
    expect(plan.colOf.get('q-0')).toBe('cd');
    // No header text was there, but every key had its column: nothing new to freeze.
    expect(plan.changes.some((c) => c.k === 'freeze')).toBe(false);
  });

  it('never gives two keys one remembered column', () => {
    const plan = sheetColumnPlan(input({ columns: { 'q-0': 'cc', 'q-1': 'cc' } }));
    expect(plan.colOf.get('q-0')).toBe('cc');
    expect(plan.colOf.get('q-1')).not.toBe('cc');
  });

  it('defaults its randomness', () => {
    const plan = sheetColumnPlan({
      form: form(['Name']),
      layout: { rows: [], cols: [] },
      header: new Map(),
    });
    expect(plan.rows).toHaveLength(1);
    expect(Object.keys(plan.columns)).toEqual(['#', 'at', 'q-0']);
  });
});

describe('sameSheetColumns', () => {
  it('compares every key', () => {
    expect(sameSheetColumns(undefined, {})).toBe(true);
    expect(sameSheetColumns({ a: 'x' }, { a: 'x' })).toBe(true);
    expect(sameSheetColumns({ a: 'x' }, { a: 'y' })).toBe(false);
    expect(sameSheetColumns({ a: 'x' }, undefined)).toBe(false);
  });
});

describe('sheetColumnPlan cost', () => {
  it('plans a full form over a 5,000-column sheet within 50 ms of CPU', () => {
    const prompts = Array.from({ length: 100 }, (_, i) => `Question ${i}`);
    const cols = Array.from({ length: 5000 }, (_, i) => `c${String(i).padStart(4, '0')}`);
    const header = new Map(cols.slice(0, 4000).map((c, i) => [c, `Other ${i}`]));
    const columns = Object.fromEntries(prompts.map((_, i) => [`q-${i}`, cols[4000 + i]!]));
    const plan = () =>
      sheetColumnPlan({
        form: form(prompts),
        layout: { rows: ['r1'], cols },
        header,
        columns,
        rand,
      });
    // Untimed warm-up passes, then the fastest of a few timed ones (as packages/project's perf tests do).
    for (let pass = 0; pass < 3; pass++) plan();
    let best = Infinity;
    for (let pass = 0; pass < 5; pass++) best = Math.min(best, cpuMsOf(plan));
    // About 2 ms a plan here; a scan per remembered column (quadratic) takes several times the budget.
    expect(best).toBeLessThan(cpuBudgetMs(50));
  });
});
