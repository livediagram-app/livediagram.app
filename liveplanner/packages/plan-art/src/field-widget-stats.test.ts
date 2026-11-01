import { describe, expect, it, vi } from 'vitest';
import type {
  BoardField,
  CustomFieldDef,
  Item,
  ItemTypeDef,
  PlanBoardSetup,
} from '@liveplanner/items';
import {
  SPREAD_BINS,
  TIMELINE_WEEKS,
  fieldFills,
  fieldNumberText,
  fieldSummary,
  fieldSummaryOf,
  typeNamesText,
  type FieldReading,
} from './field-widget-stats';
import { fieldWidgetLabel, fieldWidgetTitle } from './board-widget-info';
import { card } from './test-fixtures';

// docs/specs/026-plan/board-widgets.md "Field widgets" "What each view reads".

const def = (id: string, kind: CustomFieldDef['kind'], extra: Partial<CustomFieldDef> = {}) => ({
  id,
  label: id.slice(2),
  kind,
  ...extra,
});
const type = (id: string, custom: CustomFieldDef[]): ItemTypeDef => ({
  id,
  label: id[0]!.toUpperCase() + id.slice(1),
  newTitle: 'New',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', ...custom.map((c) => c.id)],
  custom,
});
const field = (d: CustomFieldDef, ...types: ItemTypeDef[]): BoardField => ({
  def: d,
  types: types.length ? types : [type('feature', [d])],
});

const setup: Pick<PlanBoardSetup, 'columns' | 'doneColumnId'> = {
  columns: [
    { id: 'todo', status: 'todo', name: 'To Do' },
    { id: 'done', status: 'done', name: 'Done', done: true },
  ],
};
// Local noon on 10 October 2026, so "today" is the 10th wherever the test runs.
const NOW = new Date(2026, 9, 10, 12);
const reading: FieldReading = { setup, now: NOW };
const day = (d: number) => `2026-10-${String(d).padStart(2, '0')}`;
const feature = (fields: Item['fields']) => card({ status: 'todo', ...fields }, 'feature');

describe('number summaries', () => {
  it('sums, ranges and spreads a field over the cards offered it, leaving out those without a value', () => {
    const budget = def('f-budget', 'currency', { currency: 'GBP' });
    const items = [
      feature({ 'f-budget': 100 }),
      feature({ 'f-budget': 300 }),
      feature({ 'f-budget': 200 }),
      feature({ 'f-budget': 'lots' }),
      feature({}),
      // A Bug is not offered the field: not counted even holding a value.
      card({ 'f-budget': 999 }, 'bug'),
    ];
    const s = fieldSummary(field(budget), items, reading);
    expect(s).toMatchObject({
      shape: 'number',
      unit: 'currency',
      currency: 'GBP',
      cards: 5,
      filled: 3,
      sum: 600,
      min: 100,
      max: 300,
    });
    if (s?.shape !== 'number') throw new Error('number');
    expect(s.bins).toHaveLength(SPREAD_BINS);
    expect(s.bins[0]).toBe(1);
    expect(s.bins[SPREAD_BINS - 1]).toBe(1);
    expect(s.bins.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('puts every value in the first bar when they are all the same, and reads none as zero', () => {
    const n = def('f-n', 'number');
    const same = fieldSummary(field(n), [feature({ 'f-n': 4 }), feature({ 'f-n': 4 })], reading);
    expect(same).toMatchObject({ min: 4, max: 4, bins: [2, 0, 0, 0, 0, 0, 0, 0] });
    expect(fieldSummary(field(n), [feature({}), feature({ 'f-n': '' })], reading)).toMatchObject({
      cards: 2,
      filled: 0,
      sum: 0,
      min: 0,
      max: 0,
    });
  });

  it('reads Duration minutes, Percent shares, Votes totals and Rating stars', () => {
    const dur = def('f-d', 'duration');
    expect(
      fieldSummary(field(dur), [feature({ 'f-d': 90 }), feature({ 'f-d': -5 })], reading),
    ).toMatchObject({ unit: 'duration', filled: 1, sum: 90 });
    const pct = def('f-p', 'percent');
    expect(
      fieldSummary(field(pct), [feature({ 'f-p': 40 }), feature({ 'f-p': 140 })], reading),
    ).toMatchObject({ unit: 'percent', filled: 2, sum: 140 });
    const votes = def('f-v', 'votes');
    expect(
      fieldSummary(
        field(votes),
        [feature({ 'f-v': { a: 2, b: 1 } }), feature({ 'f-v': {} })],
        reading,
      ),
    ).toMatchObject({ unit: 'votes', filled: 1, sum: 3 });
    const stars = def('f-r', 'rating', { scale: 5 });
    expect(
      fieldSummary(
        field(stars),
        [
          feature({ 'f-r': 4 }),
          feature({ 'f-r': 9 }),
          feature({ 'f-r': 0 }),
          feature({ 'f-r': 2.5 }),
        ],
        reading,
      ),
    ).toMatchObject({ unit: 'rating', scale: 5, filled: 2, sum: 9, max: 5 });
  });

  it('reads a Calculated field through the reader, and none without one', () => {
    const calc = def('f-c', 'calculated', { calculation: 'childCount' });
    const items = [feature({}), feature({})];
    const read = vi.fn(() => 3);
    expect(fieldSummary(field(calc), items, { ...reading, read })).toMatchObject({
      filled: 2,
      sum: 6,
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(fieldSummary(field(calc), items, reading)).toMatchObject({ filled: 0 });
  });

  it('reads nothing for a field no widget reads', () => {
    expect(
      fieldSummary(field(def('f-t', 'text')), [feature({ 'f-t': 'x' })], reading),
    ).toBeUndefined();
  });
});

describe('category summaries', () => {
  it('counts each value, commonest first and option order among equals', () => {
    const sev = def('f-s', 'choice', { options: ['Critical', 'High', 'Low'] });
    const items = [
      feature({ 'f-s': 'Low' }),
      feature({ 'f-s': 'High' }),
      feature({ 'f-s': 'Low' }),
      feature({ 'f-s': 'Critical' }),
      feature({ 'f-s': 'Gone' }),
      feature({}),
    ];
    const s = fieldSummary(field(sev), items, reading);
    expect(s).toMatchObject({ shape: 'category', from: 'choice', cards: 6, filled: 5 });
    if (s?.shape !== 'category') throw new Error('category');
    expect(s.values.map((v) => [v.key, v.count])).toEqual([
      ['Low', 2],
      ['Critical', 1],
      ['High', 1],
      ['Gone', 1],
    ]);
  });

  it('counts a Multiple Choice card under each of its values once, and breaks ties by name off the options', () => {
    const plat = def('f-m', 'multichoice', { options: ['Web'] });
    const s = fieldSummary(
      field(plat),
      [
        feature({ 'f-m': ['iOS', 'Web', 'iOS'] }),
        feature({ 'f-m': ['Android'] }),
        feature({ 'f-m': [] }),
      ],
      reading,
    );
    if (s?.shape !== 'category') throw new Error('category');
    expect(s.filled).toBe(2);
    expect(s.values.map((v) => v.key)).toEqual(['Web', 'Android', 'iOS']);
  });

  it('counts people by id with their names and colours', () => {
    const owner = def('f-o', 'person', { several: true } as Partial<CustomFieldDef>);
    const ana = { id: 'ana', name: 'Ana', color: '#111111' };
    const ben = { id: 'ben', name: 'Ben', color: '#222222' };
    const s = fieldSummary(
      field(owner),
      [feature({ 'f-o': [ana, ben] }), feature({ 'f-o': ana }), feature({ 'f-o': 'nobody' })],
      reading,
    );
    if (s?.shape !== 'category') throw new Error('category');
    expect(s.filled).toBe(2);
    expect(s.values[0]).toEqual({ key: 'ana', label: 'Ana', color: '#111111', count: 2 });
  });
});

describe('ticked summaries', () => {
  it('counts ticked Checkbox cards of all the cards offered it', () => {
    const ok = def('f-ok', 'checkbox');
    expect(
      fieldSummary(
        field(ok),
        [feature({ 'f-ok': true }), feature({ 'f-ok': false }), feature({})],
        reading,
      ),
    ).toEqual({ shape: 'ticked', cards: 3, filled: 1, ticked: 1, total: 3 });
  });

  it('counts a Checklist by its rows', () => {
    const list = def('f-l', 'checklist');
    expect(
      fieldSummary(
        field(list),
        [
          feature({ 'f-l': [{ text: 'a', done: true }, { text: 'b' }] }),
          feature({ 'f-l': [{ text: 'c', done: true }] }),
          feature({ 'f-l': [] }),
        ],
        reading,
      ),
    ).toEqual({ shape: 'ticked', cards: 3, filled: 2, ticked: 2, total: 3 });
  });
});

describe('date summaries', () => {
  it('counts overdue, due soon and the weeks ahead among cards not done', () => {
    const launch = def('f-l', 'date');
    const items = [
      feature({ 'f-l': day(8) }),
      feature({ 'f-l': day(10) }),
      feature({ 'f-l': day(16) }),
      feature({ 'f-l': day(20) }),
      feature({ 'f-l': '2026-12-25' }),
      feature({ 'f-l': 'soon' }),
      feature({}),
      card({ status: 'done', 'f-l': day(1) }, 'feature'),
      card({ 'f-l': day(2) }, 'feature'),
    ];
    const s = fieldSummary(field(launch), items, reading);
    expect(s).toMatchObject({ shape: 'date', cards: 9, filled: 7, overdue: 2, soon: 2, ahead: 3 });
    if (s?.shape !== 'date') throw new Error('date');
    expect(s.weeks).toHaveLength(TIMELINE_WEEKS + 1);
    expect(s.weeks).toEqual([2, 2, 1, 0, 0]);
  });

  it('reads a Date Range by its end', () => {
    const span = def('f-r', 'daterange');
    expect(
      fieldSummary(field(span), [feature({ 'f-r': [day(1), day(12)] })], reading),
    ).toMatchObject({ overdue: 0, soon: 1 });
  });
});

describe('fieldSummaryOf', () => {
  it('keeps a summary per list of cards until the field, its types, the reader or the day change', () => {
    const n = def('f-n', 'number');
    const f = field(n);
    const items = [feature({ 'f-n': 2 })];
    const first = fieldSummaryOf(f, items, reading);
    expect(fieldSummaryOf(f, items, reading)).toBe(first);
    expect(fieldSummaryOf({ ...f }, items, reading)).toBe(first);
    expect(fieldSummaryOf(field({ ...n }), items, reading)).not.toBe(first);
    const again = fieldSummaryOf(f, items, reading);
    expect(fieldSummaryOf(f, items, { ...reading, now: new Date(2026, 9, 11, 12) })).not.toBe(
      again,
    );
    expect(fieldSummaryOf(f, [...items], reading)).not.toBe(again);
  });
});

describe('fieldFills', () => {
  it('counts every field in one pass, an unticked Checkbox as empty, and keeps the result per list', () => {
    const n = def('f-n', 'number');
    const ok = def('f-ok', 'checkbox');
    const feat = type('feature', [n, ok]);
    const bug = type('bug', [n]);
    const fields = [field(n, feat, bug), field(ok, feat)];
    const items = [
      feature({ 'f-n': 1, 'f-ok': true }),
      feature({ 'f-ok': false }),
      card({ 'f-n': 3 }, 'bug'),
      card({ 'f-n': 3 }, 'task'),
    ];
    const out = fieldFills(fields, items);
    expect(out.get('f-n')).toEqual({ cards: 3, filled: 2 });
    expect(out.get('f-ok')).toEqual({ cards: 2, filled: 1 });
    expect(fieldFills(fields, items)).toBe(out);
    expect(fieldFills([...fields], items)).not.toBe(out);
  });
});

describe('fieldNumberText', () => {
  it('writes a number as its field does', () => {
    expect(fieldNumberText({ unit: 'currency', currency: 'GBP' }, 12400)).toContain('12,400');
    expect(fieldNumberText({ unit: 'duration' }, 870)).toBe('14h 30m');
    expect(fieldNumberText({ unit: 'percent' }, 61.6)).toBe('62%');
    expect(fieldNumberText({ unit: 'rating' }, 4.24)).toBe('4.2');
    expect(fieldNumberText({ unit: 'number' }, 1250)).toBe((1250).toLocaleString());
    expect(fieldNumberText({ unit: 'number' }, 1.25)).toBe((1.3).toLocaleString());
  });
});

describe('typeNamesText', () => {
  it('names one, two or many types', () => {
    expect(typeNamesText([])).toBe('');
    expect(typeNamesText(['Feature'])).toBe('Feature');
    expect(typeNamesText(['Feature', 'Bug'])).toBe('Feature and Bug');
    expect(typeNamesText(['Feature', 'Bug', 'Task'])).toBe('Feature, Bug and Task');
  });

  it('names a field widget with its view, then its card types', () => {
    const budget = field(def('f-Budget', 'currency'));
    expect(fieldWidgetLabel(budget, 'sum')).toBe('Budget Sum');
    expect(fieldWidgetTitle(budget, 'average')).toBe('Budget Average, on Feature cards');
  });
});
