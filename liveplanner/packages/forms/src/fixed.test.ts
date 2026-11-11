import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '@liveplanner/items';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  brokenFixed,
  fixedCardFields,
  fixedFieldsOf,
  fixedKeptFor,
  fixedValueOf,
  isBuiltInFixedId,
  submittedDay,
  withFixed,
  withSheetFixed,
} from './fixed';
import { readForm } from './read';
import type { FixedValue, FormDefinition } from './model';

// Fields set automatically (docs/specs/030-forms/forms.md "Filled in automatically").

const bug: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'task',
  color: '#2563eb',
  fields: [
    'title',
    'status',
    'priority',
    'labels',
    'due',
    'f-kind',
    'f-areas',
    'f-tags',
    'f-note',
    'f-long',
    'f-n',
    'f-cost',
    'f-day',
    'f-mail',
    'f-who',
  ],
  fieldLabels: { due: 'Fix By' },
  custom: [
    { id: 'f-kind', label: 'Type', kind: 'choice', options: ['Bug', 'Idea'] },
    { id: 'f-areas', label: 'Areas', kind: 'multichoice', options: ['Web', 'Api'] },
    { id: 'f-tags', label: 'Tags', kind: 'labels' },
    { id: 'f-note', label: 'Note', kind: 'text' },
    { id: 'f-long', label: 'Long', kind: 'longtext' },
    { id: 'f-n', label: 'Count', kind: 'number' },
    { id: 'f-cost', label: 'Cost', kind: 'currency' },
    { id: 'f-day', label: 'Day', kind: 'date' },
    { id: 'f-mail', label: 'Mail', kind: 'email' },
    { id: 'f-who', label: 'Who', kind: 'person' },
    // Not on the type's fields: never offered.
    { id: 'f-off', label: 'Off', kind: 'text' },
  ],
};

// 2026-11-11 23:30 UTC: already the 12th in Auckland, still the 11th in New York.
const AT = Date.UTC(2026, 10, 11, 23, 30);

describe('fixedFieldsOf', () => {
  it('offers the built-ins and custom kinds a form may set, in field order', () => {
    expect(fixedFieldsOf(bug).map((f) => [f.id, f.kind, f.label])).toEqual([
      ['priority', 'priority', 'Priority'],
      ['labels', 'labels', 'Labels'],
      ['due', 'date', 'Fix By'],
      ['f-kind', 'choice', 'Type'],
      ['f-areas', 'multichoice', 'Areas'],
      ['f-tags', 'labels', 'Tags'],
      ['f-note', 'text', 'Note'],
      ['f-long', 'text', 'Long'],
      ['f-n', 'number', 'Count'],
      ['f-cost', 'number', 'Cost'],
      ['f-day', 'date', 'Day'],
    ]);
    expect(fixedFieldsOf(bug).find((f) => f.id === 'f-kind')?.options).toEqual(['Bug', 'Idea']);
    expect(fixedFieldsOf(undefined)).toEqual([]);
  });

  it('gives a choice field with no options none', () => {
    const t = {
      ...bug,
      fields: ['f-x'],
      custom: [{ id: 'f-x', label: 'X', kind: 'choice' as const }],
    };
    expect(fixedFieldsOf(t)).toEqual([{ id: 'f-x', label: 'X', kind: 'choice', options: [] }]);
  });

  it('knows the built-ins by id', () => {
    expect(isBuiltInFixedId('due')).toBe(true);
    expect(isBuiltInFixedId('assignee')).toBe(false);
    expect(isBuiltInFixedId('constructor')).toBe(false);
  });
});

describe('submittedDay', () => {
  it('reads the day in the zone given, else UTC', () => {
    expect(submittedDay(AT)).toBe('2026-11-11');
    expect(submittedDay(AT, 'UTC')).toBe('2026-11-11');
    expect(submittedDay(AT, 'Pacific/Auckland')).toBe('2026-11-12');
    expect(submittedDay(AT, 'America/New_York')).toBe('2026-11-11');
  });

  it('adds days across a month and a year', () => {
    expect(submittedDay(AT, 'UTC', 7)).toBe('2026-11-18');
    expect(submittedDay(AT, 'UTC', 50)).toBe('2026-12-31');
    expect(submittedDay(AT, 'UTC', 51)).toBe('2027-01-01');
  });

  it('reads an unknown zone as UTC', () => {
    expect(submittedDay(AT, 'Not/AZone', 1)).toBe('2026-11-12');
  });
});

describe('fixedValueOf', () => {
  const f = (id: string) => fixedFieldsOf(bug).find((x) => x.id === id)!;
  it('keeps each kind its value', () => {
    expect(fixedValueOf({ value: 'high' }, f('priority'), AT)).toBe('high');
    expect(fixedValueOf({ value: 'idea' }, f('f-kind'), AT)).toBe('Idea');
    expect(fixedValueOf({ value: ['api', 'Web'] }, f('f-areas'), AT)).toEqual(['Api', 'Web']);
    expect(fixedValueOf({ value: ['triage'] }, f('labels'), AT)).toEqual(['triage']);
    expect(fixedValueOf({ value: 'From the form' }, f('f-note'), AT)).toBe('From the form');
    expect(fixedValueOf({ value: 3 }, f('f-n'), AT)).toBe(3);
    expect(fixedValueOf({ submitted: { days: 2 } }, f('due'), AT)).toBe('2026-11-13');
    expect(fixedValueOf({ submitted: { days: 0, tz: 'Pacific/Auckland' } }, f('f-day'), AT)).toBe(
      '2026-11-12',
    );
  });

  it('refuses what the field no longer takes', () => {
    expect(fixedValueOf({ value: 'soon' }, f('priority'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: 'Gone' }, f('f-kind'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: 4 }, f('f-kind'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: ['Web', 'Gone'] }, f('f-areas'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: [] }, f('f-areas'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: 'Web' }, f('f-areas'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: [] }, f('labels'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: 'x' }, f('labels'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: ['x'.repeat(33)] }, f('labels'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: [' '] }, f('labels'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: Array(13).fill('a') }, f('labels'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: ' ' }, f('f-note'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: 'x'.repeat(501) }, f('f-note'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: 5 }, f('f-note'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: 'five' }, f('f-n'), AT)).toBeUndefined();
    expect(fixedValueOf({ value: '2026-01-01' }, f('due'), AT)).toBeUndefined();
    expect(fixedValueOf({ submitted: { days: 0 } }, f('f-note'), AT)).toBeUndefined();
  });

  it('reads a choice with no options as broken', () => {
    const field = { id: 'f-x', label: 'X', kind: 'choice' as const };
    expect(fixedValueOf({ value: 'a' }, field, AT)).toBeUndefined();
    expect(fixedValueOf({ value: ['a'] }, { ...field, kind: 'multichoice' }, AT)).toBeUndefined();
  });
});

describe('fixedCardFields and brokenFixed', () => {
  const fixed: Record<string, FixedValue> = {
    'f-kind': { value: 'Bug' },
    due: { submitted: { days: 7 } },
    'f-mail': { value: 'a@b.c' },
    'f-gone': { value: 'x' },
    'f-areas': { value: ['Nope'] },
  };
  it('puts each resolving value on the card and names the rest', () => {
    expect(fixedCardFields(fixed, bug, AT)).toEqual({ 'f-kind': 'Bug', due: '2026-11-18' });
    expect(brokenFixed(fixed, bug)).toEqual(['f-mail', 'f-gone', 'f-areas']);
    expect(fixedCardFields(undefined, bug, AT)).toEqual({});
    expect(brokenFixed(undefined, bug)).toEqual([]);
  });

  it('keeps for a new type only what still resolves', () => {
    expect(fixedKeptFor(fixed, bug)).toEqual({
      'f-kind': { value: 'Bug' },
      due: { submitted: { days: 7 } },
    });
    expect(fixedKeptFor({ 'f-gone': { value: 'x' } }, bug)).toBeUndefined();
    expect(fixedKeptFor(undefined, bug)).toBeUndefined();
  });

  it('stays fast for the most fields a form may set', () => {
    const many = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`f-${i}`, { value: 'x' }]),
    );
    expect(cpuMsOf(() => brokenFixed(many, bug))).toBeLessThan(cpuBudgetMs(50));
  });
});

const form = (extra: Partial<FormDefinition> = {}): FormDefinition => ({
  v: 1,
  heading: 'Bugs',
  sections: [{ id: 's-1', title: '', questions: [] }],
  ...extra,
});

describe('withFixed and withSheetFixed', () => {
  const dest = { tabId: 't', typeId: 'bug', status: 'new' };
  it('sets, replaces and clears a field', () => {
    const one = withFixed(form({ destination: dest }), 'f-kind', { value: 'Bug' });
    expect(one.destination?.fixed).toEqual({ 'f-kind': { value: 'Bug' } });
    const two = withFixed(one, 'f-kind', { value: 'Idea' });
    expect(two.destination?.fixed).toEqual({ 'f-kind': { value: 'Idea' } });
    const none = withFixed(two, 'f-kind', null);
    expect(none.destination).toEqual(dest);
  });

  it('leaves a form with no destination alone', () => {
    const f = form();
    expect(withFixed(f, 'f-kind', { value: 'Bug' })).toBe(f);
    expect(withSheetFixed(f, [])).toBe(f);
  });

  it('sets and clears the extra columns', () => {
    const sheet = { tabId: 't', sheetId: 'AAAAAAAAAAA1' };
    const col = { id: 'x-aaaaaa', header: 'Source', value: 'Web' };
    expect(withSheetFixed(form({ sheet }), [col]).sheet).toEqual({ ...sheet, fixed: [col] });
    expect(withSheetFixed(form({ sheet: { ...sheet, fixed: [col] } }), []).sheet).toEqual(sheet);
  });
});

describe('readForm keeps set values', () => {
  const read = (raw: Record<string, unknown>) => readForm({ heading: 'F', sections: [], ...raw });
  it('reads a destination’s set fields', () => {
    const f = read({
      destination: {
        tabId: 't',
        typeId: 'bug',
        status: 'new',
        fixed: {
          priority: { value: 'high' },
          'f-n': { value: 3 },
          'f-areas': { value: ['Web', 'web', ' '] },
          due: { submitted: { days: 7, tz: 'Europe/London' } },
          'f-day': { submitted: {} },
          'f-bad-tz': { submitted: { days: 1, tz: 'no spaces allowed' } },
          'f-neg': { submitted: { days: -1 } },
          'f-far': { submitted: { days: 366 } },
          'f-frac': { submitted: { days: 1.5 } },
          'f-sub': { submitted: 'soon' },
          'f-empty': { value: '' },
          'f-list': { value: [] },
          'f-obj': 'x',
          assignee: { value: 'me' },
        },
      },
    });
    expect(f?.destination?.fixed).toEqual({
      priority: { value: 'high' },
      'f-n': { value: 3 },
      'f-areas': { value: ['Web'] },
      due: { submitted: { days: 7, tz: 'Europe/London' } },
      'f-day': { submitted: { days: 0 } },
      'f-bad-tz': { submitted: { days: 1 } },
    });
  });

  it('drops a set that is not an object, and caps the fields', () => {
    expect(
      read({ destination: { tabId: 't', typeId: 'bug', status: 'n', fixed: [] } })?.destination,
    ).toEqual({
      tabId: 't',
      typeId: 'bug',
      status: 'n',
    });
    expect(
      read({
        destination: {
          tabId: 't',
          typeId: 'bug',
          status: 'n',
          fixed: { assignee: { value: 'x' } },
        },
      })?.destination?.fixed,
    ).toBeUndefined();
    const many = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`f-${i}`, { value: i }]));
    const f = read({ destination: { tabId: 't', typeId: 'bug', status: 'n', fixed: many } });
    expect(Object.keys(f!.destination!.fixed!)).toHaveLength(20);
  });

  it('reads a sheet’s extra columns', () => {
    const f = read({
      sheet: {
        tabId: 't',
        sheetId: 'AAAAAAAAAAA1',
        fixed: [
          { id: 'x-aaaaaa', header: ' Source ', value: 'Web' },
          { id: 'x-bbbbbb', header: 'Count', value: 2 },
          { id: 'x-cccccc', header: 'Due', submitted: { days: 3 } },
          { id: 'x-aaaaaa', header: 'Again', value: 'dup' },
          { id: 'x-dddddd', header: '', value: 'no header' },
          { id: 'x-eeeeee', header: 'List', value: ['a'] },
          { id: 'BAD', header: 'Bad', value: 'x' },
          'nope',
        ],
      },
    });
    expect(f?.sheet?.fixed).toEqual([
      { id: 'x-aaaaaa', header: 'Source', value: 'Web' },
      { id: 'x-bbbbbb', header: 'Count', value: 2 },
      { id: 'x-cccccc', header: 'Due', submitted: { days: 3 } },
    ]);
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `x-${i}`,
      header: `H${i}`,
      value: i,
    }));
    expect(
      read({ sheet: { tabId: 't', sheetId: 'AAAAAAAAAAA1', fixed: many } })?.sheet?.fixed,
    ).toHaveLength(10);
    expect(read({ sheet: { tabId: 't', sheetId: 'AAAAAAAAAAA1', fixed: [] } })?.sheet).toEqual({
      tabId: 't',
      sheetId: 'AAAAAAAAAAA1',
    });
    expect(
      read({ sheet: { tabId: 't', sheetId: 'AAAAAAAAAAA1', fixed: 'x' } })?.sheet?.fixed,
    ).toBeUndefined();
  });
});
