import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from './board';
import { boardCsvImport, boardCsvRows } from './board-csv';
import { boardSortFieldsOf, sortCards } from './board-sort';
import { calculatedText, calculatedValue, childIndexOf } from './calculated-fields';
import { customFieldText } from './card-text';
import {
  DURATION_HINT,
  DURATION_MINUTES_MAX,
  durationMinutes,
  durationSpoken,
  durationText,
  isTimeSpent,
  parseDuration,
  runningOnCard,
} from './duration-fields';
import { formulaText, formulaValue } from './formula-fields';
import type { Item, ItemFieldValue } from './item';
import { ITEM_TYPES, type CustomFieldDef, type ItemTypeDef } from './item-types';
import { resolveFields } from './plan-names';
import { canBeRequired, missingRequiredFields } from './required-fields';
import { aggregateFits, inferredResult } from './rollup-fields';
import { ALI, SAM, item } from './test-items';
import {
  defaultCatalogue,
  ITEM_TYPE_CATALOGUE_VERSION,
  validateItemTypeCatalogue,
} from './type-catalogue';
import { applyCardTypeChanges } from './type-changes';

// Duration fields (docs/specs/026-plan/item-types.md "Duration").

const ESTIMATE: CustomFieldDef = { id: 'f-est', label: 'Planned', kind: 'duration' };
const SPENT: CustomFieldDef = {
  id: 'f-spent',
  label: 'Time Spent',
  kind: 'duration',
  timeSpent: true,
};
const work: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'work',
  label: 'Work',
  fields: ['title', 'status', 'f-est', 'f-spent'],
  custom: [ESTIMATE, SPENT],
};
const statuses = [{ status: 'todo', name: 'To Do' }];
const naming = { statuses, items: [] };
const titles = (list: readonly Item[]) => list.map((i) => i.fields['title']);
const timeValue = (v: unknown) => v as ItemFieldValue;
const tracked = timeValue({
  people: { [SAM.id]: { name: SAM.name, color: SAM.color } },
  entries: [
    { id: 'entry001', by: SAM.id, minutes: 90, at: 10 },
    { id: 'entry002', by: SAM.id, minutes: 30, at: 20 },
  ],
  running: [],
});

describe('reading a duration', () => {
  it('reads hours and minutes as typed, rounded to a whole minute', () => {
    const cases: [string | number, number][] = [
      ['2h 30m', 150],
      ['2h30m', 150],
      ['2 hours 30 minutes', 150],
      ['1.5h', 90],
      ['.5h', 30],
      ['90m', 90],
      ['90 mins', 90],
      ['2:30', 150],
      ['0:05', 5],
      ['45', 45],
      [' 3H ', 180],
      ['1h, 15m', 75],
      ['1.25 hr', 75],
      [12.4, 12],
      [0, 0],
    ];
    for (const [typed, minutes] of cases) expect(parseDuration(typed), String(typed)).toBe(minutes);
  });

  it('refuses what is no duration, or past the most a field holds', () => {
    for (const bad of [
      '',
      '  ',
      'soon',
      '2h banana',
      'h',
      '2:75',
      '-1h',
      '2d',
      '1hour2',
      -5,
      Number.NaN,
    ])
      expect(parseDuration(bad), String(bad)).toBeUndefined();
    expect(parseDuration(undefined)).toBeUndefined();
    expect(parseDuration(null)).toBeUndefined();
    expect(parseDuration(DURATION_MINUTES_MAX)).toBe(DURATION_MINUTES_MAX);
    expect(parseDuration(DURATION_MINUTES_MAX + 1)).toBeUndefined();
    expect(parseDuration('100000h')).toBeUndefined();
  });

  // Timed in CPU time, so a busy machine does not fail it: a long string of parts stays linear.
  it('stays linear on a long run of parts, spaces or digits', () => {
    const worst = `${'1h '.repeat(20_000)}x`;
    const spaces = `1${' '.repeat(50_000)}h!`;
    const digits = `${'0'.repeat(50_000)}x`;
    const ms = cpuMsOf(() => {
      expect(parseDuration(worst)).toBeUndefined();
      expect(parseDuration(spaces)).toBeUndefined();
      expect(parseDuration(digits)).toBeUndefined();
    });
    expect(ms).toBeLessThan(cpuBudgetMs(80));
  });

  it('writes it as "2h 30m", and speaks it', () => {
    expect(durationText(150)).toBe('2h 30m');
    expect(durationText(45)).toBe('45m');
    expect(durationText(180)).toBe('3h');
    expect(durationText(0)).toBe('0m');
    expect(durationText(-3)).toBe('0m');
    expect(durationText(1500 * 60)).toBe(`${(1500).toLocaleString()}h`);
    expect(durationSpoken(150)).toBe('2 hours 30 minutes');
    expect(durationSpoken(60)).toBe('1 hour');
    expect(durationSpoken(1)).toBe('1 minute');
    expect(durationSpoken(0)).toBe('0 minutes');
    expect(DURATION_HINT).toBe('Write a duration like 2h 30m, 90m or 1.5h');
  });
});

describe('a field’s value', () => {
  it('reads minutes, a Time Spent field its entries’ total', () => {
    expect(isTimeSpent(SPENT)).toBe(true);
    expect(isTimeSpent(ESTIMATE)).toBe(false);
    expect(isTimeSpent({ kind: 'number', timeSpent: true })).toBe(false);
    expect(isTimeSpent(undefined)).toBe(false);
    expect(durationMinutes(ESTIMATE, 90)).toBe(90);
    expect(durationMinutes(ESTIMATE, '90')).toBeUndefined();
    expect(durationMinutes(ESTIMATE, -1)).toBeUndefined();
    expect(durationMinutes(ESTIMATE, undefined)).toBeUndefined();
    expect(durationMinutes({ kind: 'number' }, 90)).toBeUndefined();
    expect(durationMinutes(SPENT, tracked)).toBe(120);
    expect(durationMinutes(SPENT, 90)).toBeUndefined();
    expect(durationMinutes(SPENT, timeValue({ people: {}, entries: [], running: [] }))).toBe(
      undefined,
    );
    expect(customFieldText(ESTIMATE, 150)).toBe('2h 30m');
    expect(customFieldText(SPENT, tracked)).toBe('2h');
    expect(customFieldText(ESTIMATE, 'soon')).toBeNull();
  });

  it('names everyone with a timer running on a card, earliest first, each once', () => {
    const second: CustomFieldDef = { ...SPENT, id: 'f-other', label: 'Other' };
    const both = {
      ...work,
      fields: [...work.fields, 'f-other'],
      custom: [ESTIMATE, SPENT, second],
    };
    const card = item({
      'f-spent': timeValue({
        people: {
          [SAM.id]: { name: SAM.name, color: SAM.color },
          [ALI.id]: { name: ALI.name, color: ALI.color },
        },
        entries: [],
        running: [
          { id: 'timer001', by: SAM.id, start: 300 },
          { id: 'timer002', by: ALI.id, start: 200 },
        ],
      }),
      'f-other': timeValue({
        people: { [SAM.id]: { name: SAM.name, color: SAM.color } },
        entries: [],
        running: [{ id: 'timer003', by: SAM.id, start: 100 }],
      }),
    });
    expect(runningOnCard(card, both)).toEqual({ people: [SAM, ALI], start: 100 });
    // A field the type no longer offers draws nothing.
    expect(runningOnCard(card, { ...both, fields: ['title'] })).toBeNull();
    expect(runningOnCard(item({}), work)).toBeNull();
  });
});

describe('agents and the card table', () => {
  it('take a duration as typed, and refuse what is none', () => {
    expect(resolveFields({ Planned: '2h 30m' }, work, naming)).toMatchObject({
      ok: true,
      fields: { 'f-est': 150 },
    });
    expect(resolveFields({ Planned: 45 }, work, naming)).toMatchObject({
      ok: true,
      fields: { 'f-est': 45 },
    });
    expect(resolveFields({ Planned: 'soon' }, work, naming)).toMatchObject({
      ok: false,
      code: 'value_invalid',
      message: 'Planned is a duration: write a duration like 2h 30m, 90m or 1.5h.',
    });
  });

  it('never write tracked time', () => {
    expect(resolveFields({ 'Time Spent': '2h' }, work, naming)).toMatchObject({
      ok: false,
      code: 'value_invalid',
      message: 'Time Spent is tracked: people add time in the card panel.',
    });
  });
});

describe('the catalogue', () => {
  it('makes a Duration field, and one that tracks time', () => {
    const r = applyCardTypeChanges(
      defaultCatalogue(),
      [
        {
          op: 'add',
          name: 'Work',
          custom: [
            { name: 'Planned', kind: 'duration', required: true },
            { name: 'Time Spent', kind: 'duration', timeSpent: true },
          ],
        },
      ],
      statuses,
    );
    if (!r.ok) throw new Error(r.message);
    expect(r.catalogue!.types.find((t) => t.label === 'Work')!.custom).toEqual([
      { id: 'f-planned', label: 'Planned', kind: 'duration', required: true },
      { id: 'f-time-spent', label: 'Time Spent', kind: 'duration', timeSpent: true },
    ]);
  });

  it('refuses tracking time on another kind, and a required Time Spent', () => {
    const refused = (custom: Record<string, unknown>) =>
      applyCardTypeChanges(
        defaultCatalogue(),
        [{ op: 'add', name: 'X', custom: [{ name: 'V', ...custom } as never] }],
        statuses,
      );
    expect(refused({ kind: 'number', timeSpent: true })).toMatchObject({
      ok: false,
      message: `"V" is a number field: only a duration field tracks time.`,
    });
    expect(refused({ kind: 'duration', timeSpent: true, required: true })).toMatchObject({
      ok: false,
      message: `"V" tracks time: its entries are recorded, so it can't be required.`,
    });
  });

  it('keeps timeSpent only as true, only on a Duration, and never required', () => {
    const read = (field: Record<string, unknown>) => {
      const r = validateItemTypeCatalogue({
        version: ITEM_TYPE_CATALOGUE_VERSION,
        types: [{ ...work, custom: [ESTIMATE, { ...SPENT, ...field }] }],
      });
      if (!r.ok) throw new Error(r.reason);
      return r.catalogue.types[0]!.custom![1]!;
    };
    expect(read({}).timeSpent).toBe(true);
    expect(read({ timeSpent: 'yes' }).timeSpent).toBeUndefined();
    expect(read({ kind: 'number' }).timeSpent).toBeUndefined();
    expect(read({ required: true }).required).toBeUndefined();
  });

  it('lets a Duration be required, 0 counting, but never Time Spent', () => {
    expect(canBeRequired('duration')).toBe(true);
    const req = {
      ...work,
      custom: [
        { ...ESTIMATE, required: true },
        { ...SPENT, required: true },
      ],
    };
    expect(missingRequiredFields(req, { 'f-est': 0 })).toEqual([]);
    expect(missingRequiredFields(req, {}).map((f) => f.id)).toEqual(['f-est']);
  });
});

describe('boards', () => {
  it('sort it as a number, Time Spent by its total', () => {
    const cards = [
      item({ title: 'long', 'f-est': 300 }, { type: 'work' }),
      item({ title: 'none' }, { type: 'work' }),
      item({ title: 'short', 'f-est': 15 }, { type: 'work' }),
    ];
    expect(boardSortFieldsOf([work]).find((f) => f.id === 'f-est')?.kind).toBe('duration');
    expect(titles(sortCards(cards, [{ field: 'f-est', dir: 'asc' }], [work]))).toEqual([
      'short',
      'long',
      'none',
    ]);
    const spent = [
      item({ title: 'two', 'f-spent': tracked }, { type: 'work' }),
      item(
        {
          title: 'one',
          'f-spent': timeValue({
            people: {},
            entries: [{ id: 'entry009', by: SAM.id, minutes: 60, at: 1 }],
            running: [],
          }),
        },
        { type: 'work' },
      ),
    ];
    expect(titles(sortCards(spent, [{ field: 'f-spent', dir: 'asc' }], [work]))).toEqual([
      'one',
      'two',
    ]);
  });
});

describe('CSV', () => {
  const setup: PlanBoardSetup = {
    title: 'Work',
    columns: [{ id: 'c1', status: 'todo', name: 'To Do' }],
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    addTypes: ['work'],
  };

  it('writes it as it reads, Time Spent its total', () => {
    const rows = boardCsvRows(
      setup,
      new Map([
        [
          'a',
          item(
            { title: 'A', status: 'todo', 'f-est': 150, 'f-spent': tracked },
            { type: 'work', id: 'a' },
          ),
        ],
      ]),
      [work],
    );
    expect(rows[1]![rows[0]!.indexOf('Planned')]).toBe('2h 30m');
    expect(rows[1]![rows[0]!.indexOf('Time Spent')]).toBe('2h');
  });

  it('reads a duration as typed, skips what is none, and never imports tracked time', () => {
    const { creates } = boardCsvImport(
      [
        ['Title', 'Planned', 'Time Spent'],
        ['A', '2h 30m', '3h'],
        ['B', '90', ''],
        ['C', 'soon', ''],
      ],
      { setup, types: [work], people: [], room: 100 },
    );
    expect(creates.map((c) => c.fields['f-est'])).toEqual([150, 90, undefined]);
    expect(creates.map((c) => c.fields['f-spent'])).toEqual([undefined, undefined, undefined]);
  });
});

describe('formulas and rollups', () => {
  const hours: CustomFieldDef = {
    id: 'f-hours',
    label: 'Hours',
    kind: 'calculated',
    calculation: 'formula',
    formula: '{f-est} / 60',
  };
  const left: CustomFieldDef = {
    id: 'f-left',
    label: 'Left',
    kind: 'calculated',
    calculation: 'formula',
    formula: '{f-est} - {f-spent}',
    result: 'duration',
  };
  const task: ItemTypeDef = {
    ...work,
    id: 'task',
    fields: [...work.fields, 'parent', 'f-hours', 'f-left'],
    custom: [
      ESTIMATE,
      SPENT,
      { id: 'parent', label: 'Parent', kind: 'card', linkType: 'project' },
      hours,
      left,
    ],
  };
  const total: CustomFieldDef = {
    id: 'f-total',
    label: 'Total Spent',
    kind: 'calculated',
    calculation: 'rollup',
    through: 'parent',
    aggregate: 'sum',
    source: 'f-spent',
    result: 'duration',
  };
  const avg: CustomFieldDef = { ...total, id: 'f-avg', aggregate: 'average', source: 'f-est' };
  const project: ItemTypeDef = {
    ...ITEM_TYPES[1],
    id: 'project',
    label: 'Project',
    fields: ['title', 'f-total', 'f-avg'],
    custom: [total, avg],
  };
  const types = [project, task];
  const p = item({ title: 'P' }, { type: 'project' });
  const a = item({ title: 'A', parent: p.id, 'f-est': 150, 'f-spent': tracked }, { type: 'task' });
  const b = item({ title: 'B', parent: p.id, 'f-est': 25 }, { type: 'task' });
  const all = [p, a, b];
  const byId = new Map(all.map((i) => [i.id, i]));

  it('read a Duration as minutes, and give a Duration back', () => {
    expect(formulaValue(hours, a, task, { items: byId })).toBe(2.5);
    expect(formulaValue(left, a, task, { items: byId })).toBe(30);
    expect(formulaText(left, 30)).toBe('30m');
    expect(formulaText(left, 'x')).toBeNull();
    // A negative Duration result reads as 0.
    expect(formulaValue(left, { ...a, fields: { ...a.fields, 'f-est': 10 } }, task)).toBe(0);
  });

  it('add Durations up, the result staying a Duration', () => {
    expect(aggregateFits('sum', { reads: 'duration' })).toBe(true);
    expect(aggregateFits('average', { reads: 'duration' })).toBe(true);
    expect(aggregateFits('earliest', { reads: 'duration' })).toBe(false);
    expect(
      inferredResult(
        {
          kind: total.kind,
          calculation: total.calculation,
          through: total.through,
          aggregate: total.aggregate,
          source: total.source,
        },
        project,
        types,
      ),
    ).toEqual({
      result: 'duration',
    });
    const index = childIndexOf(all, types);
    const ctx = { type: project, items: byId, types };
    expect(calculatedValue(total, p, index, undefined, ctx)).toBe(120);
    // The average of 150 and 25, to a whole minute.
    expect(calculatedValue(avg, p, index, undefined, ctx)).toBe(88);
    expect(calculatedText(total, 120)).toBe('2h');
  });
});
