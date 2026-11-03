import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  changedValue,
  changesValues,
  fieldKindChange,
  fieldValues,
  holdsValue,
  kindChangeRefusal,
  optionsFromValues,
  fieldCardsOf,
  retypedValuePatches,
  type KindShape,
} from './field-kind-change';
import { ALI, SAM, item } from './test-items';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';

const ON = { field: 'f-x', typeIds: new Set(['task']) };
const ctx = { people: [SAM, ALI], tz: 'Europe/London' };
const text: KindShape = { kind: 'text' };

describe('kindChangeRefusal', () => {
  it('lets a type become itself and the everyday kinds one another', () => {
    expect(kindChangeRefusal(text, text)).toBeNull();
    expect(kindChangeRefusal(text, { kind: 'number' })).toBeNull();
    expect(kindChangeRefusal({ kind: 'person' }, { kind: 'person', multiple: true })).toBeNull();
    expect(kindChangeRefusal({ kind: 'card' }, { kind: 'card', blocks: true })).toBeNull();
    expect(
      kindChangeRefusal(
        { kind: 'calculated', calculation: 'childCount' },
        { kind: 'calculated', calculation: 'formula' },
      ),
    ).toBeNull();
  });

  it('refuses worked-out, kept-apart and card targets, saying why', () => {
    expect(kindChangeRefusal(text, { kind: 'calculated', calculation: 'formula' })).toMatch(
      /Worked out/,
    );
    expect(kindChangeRefusal({ kind: 'calculated' }, text)).toMatch(/Worked out/);
    expect(kindChangeRefusal(text, { kind: 'comments' })).toMatch(/Comments/);
    expect(kindChangeRefusal({ kind: 'votes' }, text)).toMatch(/Votes/);
    expect(kindChangeRefusal(text, { kind: 'image' })).toMatch(/Image/);
    expect(kindChangeRefusal({ kind: 'checklist' }, text)).toMatch(/Checklist/);
    expect(kindChangeRefusal({ kind: 'duration' }, { kind: 'duration', timeSpent: true })).toMatch(
      /Time Tracking/,
    );
    expect(kindChangeRefusal(text, { kind: 'card' })).toMatch(/card/);
  });
});

describe('changedValue', () => {
  it('keeps what fits as it is stored', () => {
    expect(changedValue({ kind: 'person' }, { kind: 'person', multiple: true }, SAM)).toEqual({
      kind: 'kept',
    });
    expect(
      changedValue(
        { kind: 'card', multiple: true },
        { kind: 'card', blocks: true, multiple: true },
        ['a', 'b'],
      ),
    ).toEqual({ kind: 'kept' });
  });

  it('keeps the first of several, saying the rest went', () => {
    expect(
      changedValue({ kind: 'person', multiple: true }, { kind: 'person' }, [SAM, ALI]),
    ).toEqual({ kind: 'rewritten', value: SAM, trimmed: true });
    expect(
      changedValue({ kind: 'multichoice' }, { kind: 'choice', options: ['A', 'B'] }, ['B', 'A']),
    ).toEqual({ kind: 'rewritten', value: 'B', trimmed: true });
  });

  it('writes any value as text', () => {
    expect(changedValue({ kind: 'choice' }, text, 'High')).toMatchObject({ value: 'High' });
    expect(changedValue({ kind: 'number' }, text, 12500)).toMatchObject({ value: '12500' });
    expect(changedValue({ kind: 'rating' }, text, 4)).toMatchObject({ value: '4' });
    expect(changedValue({ kind: 'checkbox' }, text, true)).toMatchObject({ value: 'Yes' });
    expect(changedValue({ kind: 'person', multiple: true }, text, [SAM, ALI])).toMatchObject({
      value: 'Sam Lee, Ali',
    });
    expect(changedValue({ kind: 'longtext' }, text, 'one\ntwo')).toMatchObject({
      value: 'one two',
    });
    expect(changedValue({ kind: 'date' }, text, '2026-11-03')).toMatchObject({
      value: '2026-11-03',
    });
  });

  it('reads text into a number, clearing what is no number', () => {
    expect(changedValue(text, { kind: 'number' }, '42')).toEqual({
      kind: 'rewritten',
      value: 42,
      trimmed: false,
    });
    expect(changedValue(text, { kind: 'number' }, 'soon')).toEqual({ kind: 'cleared' });
    expect(changedValue(text, { kind: 'percent' }, '140')).toEqual({ kind: 'cleared' });
  });

  it('reads text into a choice, a person or labels', () => {
    expect(changedValue(text, { kind: 'choice', options: ['High', 'Low'] }, 'high')).toMatchObject({
      value: 'High',
      trimmed: false,
    });
    expect(changedValue(text, { kind: 'person' }, 'ali', ctx)).toMatchObject({ value: ALI });
    expect(changedValue(text, { kind: 'person' }, 'Nobody', ctx)).toEqual({ kind: 'cleared' });
    expect(changedValue(text, { kind: 'labels' }, 'ui, bug')).toMatchObject({
      value: ['ui', 'bug'],
    });
  });

  it('moves between the date kinds, a day at 9:00 and a moment keeping its day', () => {
    const at = changedValue({ kind: 'date' }, { kind: 'datetime' }, '2026-11-03', ctx);
    expect(at).toMatchObject({ value: '2026-11-03T09:00:00Z[Europe/London]', trimmed: false });
    expect(
      changedValue(
        { kind: 'datetime' },
        { kind: 'date' },
        '2026-11-03T22:30:00Z[Europe/London]',
        ctx,
      ),
    ).toMatchObject({ value: '2026-11-03', trimmed: true });
    expect(changedValue({ kind: 'date' }, { kind: 'daterange' }, '2026-11-03', ctx)).toMatchObject({
      value: ['2026-11-03', '2026-11-03'],
      trimmed: false,
    });
    expect(
      changedValue({ kind: 'daterange' }, { kind: 'date' }, ['2026-11-03', '2026-11-05'], ctx),
    ).toMatchObject({ value: '2026-11-03', trimmed: true });
    expect(
      changedValue(
        { kind: 'daterange' },
        { kind: 'daterange', withTime: true },
        ['2026-11-03', '2026-11-05'],
        ctx,
      ),
    ).toMatchObject({
      value: ['2026-11-03T09:00:00Z[Europe/London]', '2026-11-05T09:00:00Z[Europe/London]'],
    });
  });
});

describe('optionsFromValues', () => {
  it('lists the distinct values, a list item by item, after any options it had', () => {
    expect(optionsFromValues(text, ['High', 'low', 'high', 'Low'])).toEqual(['High', 'low']);
    expect(optionsFromValues({ kind: 'labels' }, [['ui', 'bug'], ['bug']])).toEqual(['ui', 'bug']);
    expect(optionsFromValues({ kind: 'choice', options: ['A'] }, ['B'])).toEqual(['A', 'B']);
  });

  it('stops at the most options a field takes', () => {
    const many = Array.from({ length: 40 }, (_, i) => `v${i}`);
    expect(optionsFromValues(text, many)).toHaveLength(20);
  });
});

describe('fieldKindChange', () => {
  it('counts the values held, cut down and cleared, and patches only what changes', () => {
    const items = [
      item({ 'f-x': '12' }),
      item({ 'f-x': 'n/a' }),
      item({ 'f-x': '' }),
      item({ other: 1 }),
      item({ 'f-x': '7' }, { type: 'bug' }),
    ];
    const out = fieldKindChange(text, { kind: 'number' }, items, ON);
    expect(out).toMatchObject({ held: 2, trimmed: 0, cleared: 1 });
    expect(out.patches).toEqual([
      { id: items[0]!.id, patch: { set: { 'f-x': 12 } } },
      { id: items[1]!.id, patch: { clear: ['f-x'] } },
    ]);
  });

  it('takes a Long Text’s formatting with it', () => {
    const it1 = item({ 'f-x': 'Hi', 'f-xRich': [{ text: 'Hi', bold: true }] });
    expect(fieldKindChange({ kind: 'longtext' }, text, [it1], ON).patches).toEqual([
      { id: it1.id, patch: { clear: ['f-xRich'] } },
    ]);
  });

  it('walks a plan of 2,000 cards in well under a frame', () => {
    const items = Array.from({ length: 2000 }, (_, i) =>
      item({ 'f-x': i % 3 ? String(i) : 'none' }),
    );
    const out = fieldKindChange(text, { kind: 'number' }, items, ON);
    expect(out.held).toBe(2000);
    expect(out.cleared).toBe(667);
    // CPU time, the best of three (docs/ci.md "Speed budgets").
    let best = Infinity;
    for (let pass = 0; pass < 3; pass++)
      best = Math.min(
        best,
        cpuMsOf(() => fieldKindChange(text, { kind: 'number' }, items, ON)),
      );
    expect(best).toBeLessThan(cpuBudgetMs(100));
  });
});

describe('helpers', () => {
  it('holdsValue, fieldValues and changesValues', () => {
    expect([undefined, null, '', [], 'a', 0, false].map((v) => holdsValue(v))).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
    expect([
      ...fieldValues([item({ 'f-x': 'a' }), item({}), item({ 'f-x': 'b' }, { type: 'x' })], ON),
    ]).toEqual(['a']);
    expect(changesValues(text, text)).toBe(false);
    expect(changesValues({ kind: 'person' }, { kind: 'person', multiple: true })).toBe(false);
    expect(changesValues({ kind: 'person', multiple: true }, { kind: 'person' })).toBe(true);
    expect(changesValues({ kind: 'daterange' }, { kind: 'daterange', withTime: true })).toBe(true);
    expect(changesValues(text, { kind: 'number' })).toBe(true);
  });
});

describe('more pairs', () => {
  it('reads lists into lists, a few cut down', () => {
    const multi: KindShape = { kind: 'multichoice', options: ['A', 'B'] };
    expect(changedValue({ kind: 'labels' }, multi, ['a', 'z'])).toEqual({
      kind: 'rewritten',
      value: ['A'],
      trimmed: true,
    });
    expect(changedValue({ kind: 'labels' }, multi, ['z'])).toEqual({ kind: 'cleared' });
    expect(changedValue({ kind: 'multichoice' }, { kind: 'labels' }, ['A', 'B'])).toMatchObject({
      value: ['A', 'B'],
      trimmed: false,
    });
    expect(
      changedValue(text, { kind: 'person', multiple: true }, 'Sam Lee, Nobody', ctx),
    ).toMatchObject({ value: [SAM], trimmed: true });
    expect(changedValue(text, { kind: 'person' }, 'Sam Lee', {})).toEqual({ kind: 'cleared' });
    expect(changedValue({ kind: 'multichoice' }, { kind: 'choice' }, ['A'])).toEqual({
      kind: 'cleared',
    });
  });

  it('keeps one card of several, and a lone value as it is', () => {
    expect(changedValue({ kind: 'card', multiple: true }, { kind: 'card' }, ['a', 'b'])).toEqual({
      kind: 'rewritten',
      value: 'a',
      trimmed: true,
    });
    expect(changedValue({ kind: 'card', multiple: true }, { kind: 'card' }, ['a'])).toEqual({
      kind: 'kept',
    });
    expect(changedValue(text, text, 'x')).toEqual({ kind: 'kept' });
  });

  it('handles timed ranges, moments and what is no date', () => {
    const range = ['2026-11-03T09:00:00Z[Europe/London]', '2026-11-04T09:00:00Z[Europe/London]'];
    expect(
      changedValue({ kind: 'daterange', withTime: true }, { kind: 'datetime' }, range, ctx),
    ).toMatchObject({ value: range[0], trimmed: true });
    expect(
      changedValue({ kind: 'daterange', withTime: true }, { kind: 'daterange' }, range, ctx),
    ).toMatchObject({ value: ['2026-11-03', '2026-11-04'], trimmed: true });
    expect(
      changedValue({ kind: 'datetime' }, { kind: 'daterange', withTime: true }, range[0]!, ctx),
    ).toMatchObject({ value: [range[0], range[0]], trimmed: false });
    expect(changedValue({ kind: 'date' }, { kind: 'datetime' }, 'soon', ctx)).toEqual({
      kind: 'cleared',
    });
    expect(changedValue({ kind: 'date' }, { kind: 'daterange' }, 'soon', ctx)).toEqual({
      kind: 'cleared',
    });
    expect(changedValue({ kind: 'daterange' }, { kind: 'date' }, ['x'], ctx)).toEqual({
      kind: 'cleared',
    });
    expect(changedValue({ kind: 'datetime' }, text, range[0]!, ctx)).toMatchObject({
      kind: 'rewritten',
    });
  });

  it('clears what has no text, and reads a list into one value by its first', () => {
    expect(changedValue({ kind: 'labels' }, text, [])).toEqual({ kind: 'cleared' });
    expect(changedValue({ kind: 'image' }, { kind: 'number' }, { id: 'x' })).toEqual({
      kind: 'cleared',
    });
    expect(changedValue({ kind: 'labels' }, { kind: 'number' }, ['4', '5'])).toEqual({
      kind: 'cleared',
    });
    expect(changedValue({ kind: 'labels' }, text, ['a', 'b'])).toMatchObject({ value: 'a, b' });
  });
});

describe('a type’s save', () => {
  const BASE: ItemTypeDef = {
    ...ITEM_TYPES[1],
    id: 'task',
    custom: [
      { id: 'f-x', label: 'X', kind: 'text' },
      { id: 'f-y', label: 'Y', kind: 'text' },
    ],
  };
  const HEIR: ItemTypeDef = { ...ITEM_TYPES[1], id: 'bug', inherits: 'task', custom: BASE.custom };
  const OTHER: ItemTypeDef = { ...ITEM_TYPES[1], id: 'idea', inherits: 'task', custom: [] };

  it('reaches the cards of the types inheriting the field', () => {
    expect([...fieldCardsOf('task', 'f-x', [BASE, HEIR, OTHER]).typeIds]).toEqual(['task', 'bug']);
  });

  it('makes one patch a card for every field whose type changed', () => {
    const after: ItemTypeDef = {
      ...BASE,
      custom: [
        { id: 'f-x', label: 'X', kind: 'number' },
        { id: 'f-y', label: 'Y', kind: 'number' },
        { id: 'f-z', label: 'Z', kind: 'text' },
      ],
    };
    const a = item({ 'f-x': '1', 'f-y': 'no' });
    const b = item({ 'f-x': '2' }, { type: 'bug' });
    const c = item({ 'f-x': '3' }, { type: 'idea' });
    expect(retypedValuePatches(BASE, after, [BASE, HEIR, OTHER], [a, b, c])).toEqual([
      { id: a.id, patch: { set: { 'f-x': 1 }, clear: ['f-y'] } },
      { id: b.id, patch: { set: { 'f-x': 2 } } },
    ]);
    expect(retypedValuePatches(BASE, BASE, [BASE], [a])).toEqual([]);
    // A refused change (to Comments) writes nothing.
    const refused = { ...BASE, custom: [{ id: 'f-x', label: 'X', kind: 'comments' as const }] };
    expect(retypedValuePatches(BASE, refused, [BASE], [a])).toEqual([]);
  });
});
