import { describe, expect, it } from 'vitest';
import {
  FIELD_WIDGETS_MAX,
  boardFieldTypes,
  boardFields,
  fieldShapeOf,
  fieldWidgetCount,
  fieldWidgetKey,
  fieldWidgetState,
  isFieldWidgetKey,
  parseFieldWidget,
  viewsOfField,
} from './field-widgets';
import { readBoardWidgets, toggleWidget, placeWidget } from './board-widgets';
import { normaliseBoardSetup } from './board';
import type { CustomFieldDef, ItemTypeDef } from './item-types';

// docs/specs/026-plan/board-widgets.md "Field widgets".

const f = (id: string, kind: CustomFieldDef['kind'], extra: Partial<CustomFieldDef> = {}) =>
  ({ id, label: id.slice(2), kind, ...extra });

const type = (id: string, custom: CustomFieldDef[], hidden: string[] = []): ItemTypeDef => ({
  id,
  label: id[0]!.toUpperCase() + id.slice(1),
  newTitle: 'New',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', ...custom.map((c) => c.id).filter((c) => !hidden.includes(c))],
  custom,
});

describe('field shapes and views', () => {
  it('reads each field kind as its shape, and offers its views', () => {
    expect(fieldShapeOf(f('f-a', 'number'))).toEqual({ kind: 'number', unit: 'number' });
    expect(viewsOfField(f('f-a', 'currency'))).toEqual(['sum', 'average', 'range', 'spread']);
    expect(viewsOfField(f('f-a', 'duration'))).toEqual(['sum', 'average', 'range', 'spread']);
    expect(viewsOfField(f('f-a', 'votes'))).toEqual(['sum', 'average', 'range', 'spread']);
    expect(viewsOfField(f('f-a', 'percent'))).toEqual(['average', 'range', 'spread']);
    expect(fieldShapeOf(f('f-a', 'rating'))).toEqual({ kind: 'number', unit: 'rating', scale: 5 });
    expect(fieldShapeOf(f('f-a', 'rating', { scale: 10 }))).toMatchObject({ scale: 10 });
    expect(viewsOfField(f('f-a', 'rating'))).toEqual(['stars', 'spread']);
    for (const k of ['choice', 'multichoice', 'labels', 'person'] as const)
      expect(viewsOfField(f('f-a', k))).toEqual(['breakdown', 'donut']);
    expect(viewsOfField(f('f-a', 'checkbox'))).toEqual(['ticked']);
    expect(fieldShapeOf(f('f-a', 'checklist'))).toEqual({ kind: 'ticked', from: 'checklist' });
    for (const k of ['date', 'datetime', 'daterange'] as const)
      expect(viewsOfField(f('f-a', k))).toEqual(['upcoming', 'timeline']);
    for (const k of [
      'text',
      'longtext',
      'link',
      'email',
      'phone',
      'colour',
      'image',
      'card',
      'comments',
    ] as const)
      expect(viewsOfField(f('f-a', k))).toEqual([]);
  });

  it('reads a Calculated field by its result kind', () => {
    const calc = (extra: Partial<CustomFieldDef>) => f('f-c', 'calculated', extra);
    expect(fieldShapeOf(calc({ calculation: 'childCount' }))).toEqual({
      kind: 'number',
      unit: 'number',
    });
    expect(fieldShapeOf(calc({ calculation: 'childrenDone' }))).toEqual({
      kind: 'number',
      unit: 'percent',
    });
    expect(fieldShapeOf(calc({ calculation: 'formula', result: 'currency' }))).toEqual({
      kind: 'number',
      unit: 'currency',
    });
    expect(fieldShapeOf(calc({ calculation: 'formula', result: 'duration' }))).toMatchObject({
      unit: 'duration',
    });
    expect(fieldShapeOf(calc({ calculation: 'formula', result: 'percent' }))).toMatchObject({
      unit: 'percent',
    });
    expect(fieldShapeOf(calc({ calculation: 'formula', result: 'text' }))).toEqual({
      kind: 'category',
      from: 'text',
    });
    expect(fieldShapeOf(calc({ calculation: 'rollup', result: 'checkbox' }))).toEqual({
      kind: 'ticked',
      from: 'checkbox',
    });
    expect(fieldShapeOf(calc({ calculation: 'lookup', result: 'date' }))).toEqual({
      kind: 'date',
      from: 'date',
    });
    expect(fieldShapeOf(calc({ calculation: 'formula' }))).toMatchObject({ unit: 'number' });
    expect(fieldShapeOf(calc({}))).toBeUndefined();
  });
});

describe('field widget keys', () => {
  it('keeps a field widget as field:<view>:<fieldId>, and reads only well-formed ones', () => {
    const key = fieldWidgetKey('f-budget', 'sum');
    expect(key).toBe('field:sum:f-budget');
    expect(parseFieldWidget(key)).toEqual({ fieldId: 'f-budget', view: 'sum' });
    expect(parseFieldWidget('field:sum:parent')).toEqual({ fieldId: 'parent', view: 'sum' });
    expect(parseFieldWidget('field:nope:f-budget')).toBeNull();
    expect(parseFieldWidget('field:sum:Budget')).toBeNull();
    expect(parseFieldWidget('field:sum')).toBeNull();
    expect(parseFieldWidget('count')).toBeNull();
    expect(parseFieldWidget(3)).toBeNull();
    expect(isFieldWidgetKey(key)).toBe(true);
    expect(fieldWidgetCount(['count', key, 'field:donut:f-sev'])).toBe(2);
  });

  it('reads stored field widgets beside the kinds, each once, at most FIELD_WIDGETS_MAX', () => {
    const many = Array.from({ length: FIELD_WIDGETS_MAX + 3 }, (_, i) => `field:sum:f-n${i}`);
    const read = readBoardWidgets([
      'count',
      'field:sum:f-a',
      'field:sum:f-a',
      'field:bad:f-a',
      ...many,
    ])!;
    expect(read.slice(0, 2)).toEqual(['count', 'field:sum:f-a']);
    expect(fieldWidgetCount(read)).toBe(FIELD_WIDGETS_MAX);
    // A board set-up keeps them.
    const setup = normaliseBoardSetup({
      title: 'B',
      columns: [],
      widgets: ['filter', 'field:breakdown:f-sev'],
    });
    expect(setup?.widgets).toEqual(['filter', 'field:breakdown:f-sev']);
  });

  it('adds a widget at the end, takes off one the board has, and adds no field widget past the cap', () => {
    expect(toggleWidget(['count'], 'field:sum:f-a')).toEqual(['count', 'field:sum:f-a']);
    expect(toggleWidget(['count', 'field:sum:f-a'], 'field:sum:f-a')).toEqual(['count']);
    expect(toggleWidget(['count'], 'due')).toEqual(['count', 'due']);
    const full = Array.from({ length: FIELD_WIDGETS_MAX }, (_, i) => `field:sum:f-n${i}` as const);
    expect(toggleWidget(full, 'field:sum:f-z')).toEqual(full);
    expect(toggleWidget(full, 'count')).toEqual([...full, 'count']);
    expect(placeWidget(['count', 'field:sum:f-a'], 'field:sum:f-a', 0)).toEqual([
      'field:sum:f-a',
      'count',
    ]);
  });
});

describe('board fields', () => {
  const budget = f('f-budget', 'currency');
  const sev = f('f-sev', 'choice', { options: ['High', 'Low'] });
  const notes = f('f-notes', 'text');
  const secret = f('f-secret', 'number');
  const feature = type('feature', [budget, sev, notes, secret], ['f-secret']);
  const bug = type('bug', [sev]);
  const task = type('task', [f('f-points', 'number')]);
  const types = [feature, bug, task];

  it('reads the fields of the types the board takes, once each, with every type offering it', () => {
    const fields = boardFields({ addTypes: ['feature', 'bug'] }, types);
    expect(fields.map((x) => x.def.id)).toEqual(['f-budget', 'f-sev']);
    expect(fields[1]!.types.map((t) => t.id)).toEqual(['feature', 'bug']);
  });

  it('reads every type on a board that names none, or takes none of its own', () => {
    expect(boardFieldTypes({}, types)).toHaveLength(3);
    expect(boardFieldTypes({ addTypes: [] }, types)).toHaveLength(3);
    expect(boardFieldTypes({ addTypes: ['gone'] }, types)).toHaveLength(3);
    expect(boardFields({}, types).map((x) => x.def.id)).toContain('f-points');
  });

  it('says how a field widget stands: reading, its field gone, or its kind changed', () => {
    const fields = boardFields({ addTypes: ['feature'] }, types);
    expect(fieldWidgetState('field:sum:f-budget', fields)).toMatchObject({
      state: 'ok',
      view: 'sum',
    });
    expect(fieldWidgetState('field:sum:f-points', fields)).toEqual({ state: 'removed' });
    expect(fieldWidgetState('field:sum:f-sev', fields)).toMatchObject({ state: 'changed' });
  });
});
