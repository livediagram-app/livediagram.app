import { describe, expect, it } from 'vitest';
import type { FormDefinition, SheetFixedColumn } from '@liveplanner/forms';
import { ITEM_TYPES, type ItemTypeDef } from '@liveplanner/items';
import { bugForm, formDraft, formPlan } from '../testing/forms';
import { applyFormChanges, type FormChange } from './form-changes';
import type { FormDraft } from './form-draft';
import { readFixedOf } from './form-fixed';
import { readFormOf } from './form-read';
import { worldOf } from './form-world';

// Values filled in automatically, for agents (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Set values and
// extra columns"): set_field on a board form, add_column, set_column and delete_column on a sheet form, and how
// read_form shows them.

const BUG: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: [
    'title',
    'status',
    'description',
    'priority',
    'labels',
    'due',
    'f-severity',
    'f-areas',
    'f-note',
    'f-n',
    'f-who',
  ],
  custom: [
    { id: 'f-severity', label: 'Severity', kind: 'choice', options: ['Low', 'High'] },
    { id: 'f-areas', label: 'Areas', kind: 'multichoice', options: ['Web', 'Api'] },
    { id: 'f-note', label: 'Note', kind: 'text' },
    { id: 'f-n', label: 'Count', kind: 'number' },
    { id: 'f-who', label: 'Owner', kind: 'person' },
  ],
};

const world = () => worldOf('doc', { ...formPlan(), types: [BUG, ...ITEM_TYPES] });
// The bug form without its Severity question, so Severity can be set.
const unasked = (): FormDefinition => {
  const f = bugForm();
  return {
    ...f,
    sections: [{ ...f.sections[0]!, questions: f.sections[0]!.questions.slice(0, 1) }],
  };
};
const draft = (form: FormDefinition = unasked()) => formDraft(form, world());
const sheetForm = (fixed?: SheetFixedColumn[]): FormDefinition => ({
  ...unasked(),
  sheet: { tabId: 'budget', sheetId: 'sheet_budget', ...(fixed ? { fixed } : {}) },
});
const run = (changes: FormChange[], d: FormDraft = draft()) => ({
  d,
  refused: applyFormChanges(d, changes),
});

describe('set_field', () => {
  it('sets every kind a field takes, matched as the field spells it', () => {
    const { d, refused } = run([
      { op: 'set_field', field: 'priority', value: 'High' },
      { op: 'set_field', field: 'Labels', value: ' web, , triage ' },
      { op: 'set_field', field: 'severity', value: 'high' },
      { op: 'set_field', field: 'Areas', value: ['web', 'API'] },
      { op: 'set_field', field: 'f-note', value: '  From the form ' },
      { op: 'set_field', field: 'Count', value: 3 },
      { op: 'set_field', field: 'Due', submitted: { days: 7, timeZone: 'Europe/London' } },
    ]);
    expect(refused).toBeNull();
    expect(d.form.destination?.fixed).toEqual({
      priority: { value: 'high' },
      labels: { value: ['web', 'triage'] },
      'f-severity': { value: 'High' },
      'f-areas': { value: ['Web', 'Api'] },
      'f-note': { value: 'From the form' },
      'f-n': { value: 3 },
      due: { submitted: { days: 7, tz: 'Europe/London' } },
    });
    expect(d.lines).toContain('sets Due Date automatically to the submitted date + 7 days');
    expect(d.lines).toContain('sets Areas automatically to Web, Api');
    expect(d.lines).toContain('sets Count automatically to 3');
  });

  it('takes one option as a Multiple Choice pick, labels as a list, and the submitted day alone', () => {
    const { d, refused } = run([
      { op: 'set_field', field: 'Areas', value: 'web' },
      { op: 'set_field', field: 'Labels', value: ['a', ' b '] },
      { op: 'set_field', field: 'Due', value: null, submitted: {} },
    ]);
    expect(refused).toBeNull();
    expect(d.form.destination?.fixed).toEqual({
      'f-areas': { value: ['Web'] },
      labels: { value: ['a', 'b'] },
      due: { submitted: { days: 0 } },
    });
    expect(d.lines).toContain('sets Due Date automatically to the submitted date');
  });

  it('changes a set value and clears one, by name or by the id of a field since removed', () => {
    const form = unasked();
    form.destination = {
      ...form.destination!,
      fixed: { 'f-note': { value: 'a' }, 'f-gone': { value: 'x' } },
    };
    const { d, refused } = run(
      [
        { op: 'set_field', field: 'Note', value: 'b' },
        { op: 'set_field', field: 'f-gone', value: null },
        { op: 'set_field', field: 'Note', value: null },
      ],
      draft(form),
    );
    expect(refused).toBeNull();
    expect(d.form.destination).not.toHaveProperty('fixed');
    expect(d.lines).toEqual([
      'sets Note automatically to b',
      'stops setting f-gone automatically',
      'stops setting Note automatically',
    ]);
  });

  it('refuses to clear a field that is not set, naming the ones that are', () => {
    const form = unasked();
    form.destination = {
      ...form.destination!,
      fixed: { 'f-note': { value: 'a' }, 'f-gone': { value: 'x' } },
    };
    expect(
      run([{ op: 'set_field', field: 'Count', value: null }], draft(form)).refused,
    ).toMatchObject({
      code: 'field_not_set',
      message: expect.stringContaining('Set: "Note", "f-gone".'),
    });
    expect(run([{ op: 'set_field', field: 'Nope', value: null }]).refused?.message).toContain(
      'Set: none.',
    );
  });

  it('refuses a field that takes no set value, naming the ones that do', () => {
    const { refused } = run([{ op: 'set_field', field: 'Owner', value: 'Ada' }]);
    expect(refused).toMatchObject({ code: 'field_not_settable' });
    expect(refused!.message).toContain(
      '"Priority", "Labels", "Due Date", "Severity", "Areas", "Note", "Count"',
    );
  });

  it('refuses a field a question’s answer goes to: one source per field', () => {
    const { refused } = run(
      [{ op: 'set_field', field: 'Severity', value: 'Low' }],
      draft(bugForm()),
    );
    expect(refused).toMatchObject({
      code: 'field_asked',
      message: expect.stringContaining('"Severity" (q-sev) already fills Severity'),
    });
  });

  it('lets a question whose mapping broke leave its field free', () => {
    const form = bugForm();
    const q = form.sections[0]!.questions[1]!;
    // A rating mapped to a choice field does not fit, so its answer falls back to Description.
    form.sections[0]!.questions[1] = { ...q, type: 'rating' };
    expect(
      run([{ op: 'set_field', field: 'Severity', value: 'Low' }], draft(form)).refused,
    ).toBeNull();
  });

  it('refuses a value of the wrong kind, saying what the field takes', () => {
    const cases: [FormChange, string][] = [
      [{ op: 'set_field', field: 'Severity', value: 'Huge' }, 'one of its options: "Low", "High"'],
      [{ op: 'set_field', field: 'Severity', value: 2 }, 'one of its options'],
      [{ op: 'set_field', field: 'Areas', value: ['Web', 'Mobile'] }, 'a list of its options'],
      [{ op: 'set_field', field: 'Labels', value: 5 }, 'labels, as a list'],
      [{ op: 'set_field', field: 'Labels', value: ['ok', 5 as unknown as string] }, 'labels'],
      [{ op: 'set_field', field: 'Note', value: 5 }, 'text, up to 500 characters'],
      [{ op: 'set_field', field: 'Note', value: ' ' }, 'text'],
      [{ op: 'set_field', field: 'Count', value: '3' }, 'a number'],
      [{ op: 'set_field', field: 'Priority', value: 'soon' }, 'a priority: urgent, high'],
      [{ op: 'set_field', field: 'Priority', value: 1 }, 'a priority'],
      [{ op: 'set_field', field: 'Count', submitted: {} }, 'a number'],
      [{ op: 'set_field', field: 'Count' }, 'a number'],
      [
        { op: 'set_field', field: 'Due', value: '2026-01-01' },
        'Due Date is a date: it takes submitted',
      ],
      [{ op: 'set_field', field: 'Due', value: 'x', submitted: {} }, 'not both'],
      [{ op: 'set_field', field: 'Due', submitted: { days: 1.5 } }, 'whole number from 0 to 365'],
      [{ op: 'set_field', field: 'Due', submitted: { days: 400 } }, 'whole number'],
      [{ op: 'set_field', field: 'Due', submitted: { days: -1 } }, 'whole number'],
      [{ op: 'set_field', field: 'Due', submitted: { timeZone: 'not a zone!' } }, 'IANA time zone'],
      [{ op: 'set_field', field: 'Due', submitted: { timeZone: 'Mars/Olympus' } }, 'IANA'],
    ];
    for (const [change, words] of cases) {
      const { refused } = run([change]);
      expect(refused, JSON.stringify(change)).toMatchObject({ code: 'fixed_value_invalid' });
      expect(refused!.message).toContain(words);
    }
  });

  it('refuses a sheet form, a form with nowhere to go, and a full set', () => {
    expect(
      run([{ op: 'set_field', field: 'Note', value: 'a' }], draft(sheetForm())).refused,
    ).toMatchObject({ code: 'fixed_on_sheet' });
    const { destination: _d, ...nowhere } = unasked();
    expect(
      run([{ op: 'set_field', field: 'Note', value: 'a' }], draft(nowhere)).refused,
    ).toMatchObject({ code: 'goes_to_needs_board' });
    const full = unasked();
    const fixed = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`f-old${i}`, { value: 'x' }]),
    );
    full.destination = { ...full.destination!, fixed };
    expect(
      run([{ op: 'set_field', field: 'Note', value: 'a' }], draft(full)).refused,
    ).toMatchObject({ code: 'fixed_full' });
    // Changing one already set is no new field.
    full.destination = { ...full.destination, fixed: { ...fixed, 'f-note': { value: 'a' } } };
    expect(run([{ op: 'set_field', field: 'Note', value: 'b' }], draft(full)).refused).toBeNull();
  });

  it('keeps a question’s answer off a field set automatically', () => {
    const { refused } = run([
      { op: 'set_field', field: 'Note', value: 'a' },
      { op: 'add_question', question: { type: 'short', prompt: 'Your note', goesTo: 'Note' } },
    ]);
    expect(refused).toMatchObject({
      code: 'field_set_automatically',
      message: expect.stringContaining('Bug’s "Note" is set automatically'),
    });
    // A field not set still takes the answer.
    expect(
      run([{ op: 'add_question', question: { type: 'short', prompt: 'N', goesTo: 'Note' } }])
        .refused,
    ).toBeNull();
  });
});

describe('extra columns', () => {
  it('adds, changes and deletes a sheet form’s columns, the sheet keeping a deleted one', () => {
    const { d, refused } = run(
      [
        { op: 'add_column', header: ' Source ', value: 'Web' },
        { op: 'add_column', header: 'Due', submitted: { days: 3 } },
        { op: 'add_column', header: 'Filed' },
        { op: 'add_column', header: 'Batch', value: 7 },
        { op: 'set_column', column: 'source', header: 'Channel' },
        { op: 'set_column', column: 'Due', value: 'Soon' },
        { op: 'set_column', column: 'Batch', submitted: {} },
        { op: 'set_column', column: 'Filed', value: 2 },
        { op: 'delete_column', column: 'Channel' },
      ],
      draft(sheetForm()),
    );
    expect(refused).toBeNull();
    const cols = d.form.sheet!.fixed!;
    expect(cols.map(({ id: _id, ...c }) => c)).toEqual([
      { header: 'Due', value: 'Soon' },
      { header: 'Filed', value: 2 },
      { header: 'Batch', submitted: { days: 0 } },
    ]);
    expect(cols.every((c) => /^x-[0-9a-z]{6}$/.test(c.id))).toBe(true);
    expect(d.lines).toContain(
      'removed the extra column "Channel" (the sheet keeps its column and values)',
    );
    expect(d.lines).toContain('changed the extra column "Channel": Web');
    // By id too, keeping its value when only the header changes.
    const id = cols[0]!.id;
    const again = run([{ op: 'set_column', column: id, header: 'When' }], d);
    expect(again.refused).toBeNull();
    expect(d.form.sheet!.fixed![0]).toEqual({ id, header: 'When', value: 'Soon' });
    const kept = run([{ op: 'set_column', column: 'Batch' }], d);
    expect(kept.refused).toBeNull();
    expect(d.form.sheet!.fixed![2]).toMatchObject({ submitted: { days: 0 } });
  });

  it('refuses a board form, a full sheet, an empty or long header, a bad value and an unknown column', () => {
    expect(run([{ op: 'add_column', header: 'A' }]).refused).toMatchObject({
      code: 'columns_on_board',
    });
    const full = sheetForm(
      Array.from({ length: 10 }, (_, i) => ({ id: `x-00000${i}`, header: `C${i}`, value: 'v' })),
    );
    expect(run([{ op: 'add_column', header: 'A' }], draft(full)).refused).toMatchObject({
      code: 'columns_full',
    });
    const cases: [FormChange, string][] = [
      [{ op: 'add_column', header: '  ' }, 'header_empty'],
      [{ op: 'add_column', header: 'x'.repeat(201) }, 'too_long'],
      [{ op: 'add_column', header: 'A', value: ' ' }, 'fixed_value_invalid'],
      [{ op: 'add_column', header: 'A', value: Number.NaN }, 'fixed_value_invalid'],
      [{ op: 'add_column', header: 'A', value: 'x'.repeat(501) }, 'fixed_value_invalid'],
      [{ op: 'add_column', header: 'A', value: 'v', submitted: {} }, 'fixed_value_invalid'],
      [{ op: 'add_column', header: 'A', submitted: { days: 999 } }, 'fixed_value_invalid'],
      [{ op: 'set_column', column: 'Nope' }, 'column_unknown'],
      [{ op: 'delete_column', column: 'Nope' }, 'column_unknown'],
    ];
    for (const [change, code] of cases)
      expect(run([change], draft(sheetForm())).refused, JSON.stringify(change)).toMatchObject({
        code,
      });
    const one = draft(sheetForm());
    run([{ op: 'add_column', header: 'A' }], one);
    expect(run([{ op: 'set_column', column: 'A', header: ' ' }], one).refused).toMatchObject({
      code: 'header_empty',
    });
    expect(run([{ op: 'set_column', column: 'A', value: ' ' }], one).refused).toMatchObject({
      code: 'fixed_value_invalid',
    });
    expect(run([{ op: 'delete_column', column: 'A' }]).refused).toMatchObject({
      code: 'columns_on_board',
    });
    expect(run([{ op: 'set_column', column: 'A' }]).refused?.message).toContain('set_field');
    // An unknown column names the ones there are.
    expect(run([{ op: 'set_column', column: 'B' }], one).refused?.message).toMatch(
      /Extra columns: "A \(x-[0-9a-z]{6}\)"/,
    );
  });
});

describe('reading', () => {
  it('lists a board form’s set fields in the type’s order, a gone one last and broken', () => {
    const form = unasked();
    form.destination = {
      ...form.destination!,
      fixed: {
        'f-gone': { value: 'x' },
        due: { submitted: { days: 2, tz: 'Asia/Tokyo' } },
        'f-severity': { value: 'Removed option' },
        priority: { value: 'low' },
      },
    };
    expect(readFixedOf(form, BUG)).toEqual({
      setAutomatically: [
        { field: 'Priority', fieldId: 'priority', value: 'low' },
        { field: 'Due Date', fieldId: 'due', submitted: { days: 2, timeZone: 'Asia/Tokyo' } },
        { field: 'Severity', fieldId: 'f-severity', value: 'Removed option', broken: true },
        { field: 'f-gone', fieldId: 'f-gone', value: 'x', broken: true },
      ],
    });
    // With the card type gone, every one is broken.
    expect(readFixedOf(form, undefined).setAutomatically?.every((f) => f.broken)).toBe(true);
  });

  it('lists a sheet form’s extra columns as the sheet heads them', () => {
    const form = sheetForm([
      { id: 'x-aaaaaa', header: 'Summary', value: 'Web' },
      { id: 'x-bbbbbb', header: 'Due', submitted: { days: 1 } },
    ]);
    expect(readFixedOf(form, BUG)).toEqual({
      extraColumns: [
        // Summary is a question's header already, so the sheet's column reads "Summary (2)".
        { id: 'x-aaaaaa', header: 'Summary', column: 'Summary (2)', value: 'Web' },
        { id: 'x-bbbbbb', header: 'Due', column: 'Due', submitted: { days: 1 } },
      ],
    });
  });

  it('shows nothing when none is set', () => {
    expect(readFixedOf(unasked(), BUG)).toEqual({});
    expect(readFixedOf(sheetForm(), BUG)).toEqual({});
    const empty = unasked();
    empty.destination = { ...empty.destination!, fixed: {} };
    expect(readFixedOf(empty, BUG)).toEqual({});
  });

  it('read_form names a broken set value’s field id among its problems', () => {
    const form = unasked();
    form.destination = { ...form.destination!, fixed: { 'f-severity': { value: 'Gone' } } };
    const w = world();
    const reading = readFormOf({
      tabId: 'form',
      form,
      boards: w.boards,
      sheets: w.sheets,
      types: w.types,
      link: null,
    });
    expect(reading.setAutomatically).toEqual([
      { field: 'Severity', fieldId: 'f-severity', value: 'Gone', broken: true },
    ]);
    expect(reading.problems).toContain(
      'Severity is set automatically to a value its field no longer has: change or remove it. (f-severity)',
    );
  });
});
