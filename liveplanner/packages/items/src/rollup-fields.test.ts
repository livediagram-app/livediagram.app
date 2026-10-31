import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { PlanBoardSetup } from './board';
import { laneFieldsOf, laneDropPatch, projectBoard } from './board';
import { boardCsvRows } from './board-csv';
import { boardSortFieldsOf, sortCards } from './board-sort';
import {
  CALCULATED_STEPS_MAX,
  calculatedOutcome,
  calculatedReaderOf,
  calculatedText,
  calculatedValue,
  calculatedValuesOf,
  childIndexFor,
  childIndexOf,
  childrenOf,
} from './calculated-fields';
import { calculatedResultOf, hasResult, isLookupField, isRollupField } from './calculated-result';
import { cardSourceOf } from './card-source';
import { currencyText, dayLabel } from './card-text';
import type { Item } from './item';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import { canShowAsPercent, percentShown } from './percent-fields';
import {
  GONE_PROBLEM,
  aggregateFits,
  aggregateNeeds,
  aggregateOf,
  inferredResult,
  isAggregate,
  lookupSourceOptions,
  lookupThroughOptions,
  readableFieldsOf,
  rollupChildTypes,
  rollupProblem,
  rollupSettings,
  rollupSourceOptions,
  rollupThroughOptions,
} from './rollup-fields';
import { SAM, item } from './test-items';
import { ITEM_TYPE_CATALOGUE_VERSION, validateItemTypeCatalogue } from './type-catalogue';
import { applyCardTypeChanges } from './type-changes';

// Rollup and Lookup fields (docs/specs/026-plan/item-types.md "Rollup and Lookup fields").

const roll = (id: string, label: string, more: Partial<CustomFieldDef>): CustomFieldDef => ({
  id,
  label,
  kind: 'calculated',
  calculation: 'rollup',
  ...more,
});
const look = (id: string, label: string, more: Partial<CustomFieldDef>): CustomFieldDef => ({
  id,
  label,
  kind: 'calculated',
  calculation: 'lookup',
  ...more,
});

const projectCustom: CustomFieldDef[] = [
  roll('f-points', 'Total Points', { through: 'parent', aggregate: 'sum', source: 'f-pts' }),
  roll('f-spend', 'Total Spend', {
    aggregate: 'sum',
    source: 'f-cost',
    result: 'currency',
    currency: 'USD',
  }),
  roll('f-last', 'Last Due', { aggregate: 'latest', source: 'due', result: 'date' }),
  roll('f-first', 'First Due', { aggregate: 'earliest', source: 'due', result: 'date' }),
  roll('f-avg', 'Average Progress', {
    aggregate: 'average',
    source: 'f-prog',
    result: 'percent',
    showAs: 'percent',
  }),
  roll('f-min', 'Smallest', { aggregate: 'min', source: 'estimate' }),
  roll('f-max', 'Largest', { aggregate: 'max', source: 'estimate' }),
  roll('f-count', 'Tasks', { aggregate: 'count' }),
  roll('f-done', 'Tasks Done', { aggregate: 'countDone' }),
  { id: 'f-budget', label: 'Budget', kind: 'number' },
  { id: 'f-email', label: 'Client Email', kind: 'email' },
  {
    id: 'f-left',
    label: 'Left',
    kind: 'calculated',
    calculation: 'formula',
    formula: '{f-budget} - {f-spend}',
  },
  // Sums a Formula on each task.
  roll('f-weighted', 'Weighted', { aggregate: 'sum', source: 'f-double' }),
];
const project: ItemTypeDef = {
  id: 'project',
  label: 'Project',
  newTitle: 'New project',
  glyph: 'project',
  color: '#18181b',
  fields: ['title', 'status', ...projectCustom.map((c) => c.id)],
  custom: projectCustom,
};
const taskCustom: CustomFieldDef[] = [
  { id: 'parent', label: 'Parent', kind: 'card', linkType: 'project' },
  { id: 'f-pts', label: 'Points', kind: 'number' },
  { id: 'f-cost', label: 'Cost', kind: 'currency', currency: 'USD' },
  { id: 'f-prog', label: 'Progress', kind: 'percent' },
  look('f-pdue', 'Project Due', { through: 'parent', source: 'f-last', result: 'date' }),
  look('f-mail', 'Client Mail', { through: 'parent', source: 'f-email', result: 'text' }),
  look('f-ptitle', 'Project', { through: 'parent', source: 'title', result: 'text' }),
  look('f-pspend', 'Project Spend', {
    through: 'parent',
    source: 'f-spend',
    result: 'currency',
    currency: 'USD',
  }),
  {
    id: 'f-double',
    label: 'Double',
    kind: 'calculated',
    calculation: 'formula',
    formula: '{f-pts} * 2',
  },
];
const task: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#71717a',
  fields: ['title', 'status', 'due', 'estimate', ...taskCustom.map((c) => c.id)],
  custom: taskCustom,
};
// A Note links to Projects through its own field, so it is a child of All Linked Cards but not through Parent.
const note: ItemTypeDef = {
  id: 'note',
  label: 'Note',
  newTitle: 'New note',
  glyph: 'note',
  color: '#2563eb',
  fields: ['title', 'f-about', 'f-pts'],
  custom: [
    { id: 'f-about', label: 'About', kind: 'card', linkType: 'project' },
    { id: 'f-pts', label: 'Points', kind: 'number' },
  ],
};
const types = [project, task, note];

const p = item(
  { title: 'Launch', status: 'doing', 'f-budget': 1000, 'f-email': 'a@b.co' },
  {
    type: 'project',
  },
);
const empty = item({ title: 'Empty' }, { type: 'project' });
const t1 = item({
  title: 'A',
  status: 'done',
  parent: p.id,
  'f-pts': 3,
  'f-cost': 100.555,
  'f-prog': 50,
  due: '2026-11-03',
  estimate: 2,
});
const t2 = item({
  title: 'B',
  status: 'todo',
  parent: p.id,
  'f-pts': 5,
  'f-cost': 200,
  'f-prog': 25,
  due: '2026-10-20',
  estimate: 8,
});
// Archived: still counted.
const t3 = item({ title: 'C', status: 'done', parent: p.id, 'f-pts': 1, archived: true });
// Trashed: left out.
const t4 = item({ title: 'D', status: 'trash', parent: p.id, 'f-pts': 100 });
// No values: skipped.
const t5 = item({ title: 'E', status: 'todo', parent: p.id });
const n1 = item({ title: 'N', 'f-about': p.id, 'f-pts': 40 }, { type: 'note' });
const orphan = item({ title: 'O', parent: 'gone' });
const all: Item[] = [p, empty, t1, t2, t3, t4, t5, n1, orphan];
const byId = new Map(all.map((i) => [i.id, i]));
const isDone = (s: string | undefined) => s === 'done';
const index = childIndexOf(all, types);
const def = (type: ItemTypeDef, id: string) => type.custom!.find((c) => c.id === id)!;
const value = (card: Item, id: string, done: typeof isDone | undefined = isDone) => {
  const type = card.type === 'project' ? project : card.type === 'note' ? note : task;
  return calculatedValue(def(type, id), card, index, done, { type, items: byId, types });
};

describe('children through a Card field', () => {
  it('are every child, or those linking through the field given', () => {
    expect(childrenOf(p, index).map((c) => c.fields['title'])).toEqual(['A', 'B', 'C', 'E', 'N']);
    expect(childrenOf(p, index, 'parent').map((c) => c.fields['title'])).toEqual([
      'A',
      'B',
      'C',
      'E',
    ]);
    expect(childrenOf(p, index, 'f-about')).toEqual([n1]);
  });
});

describe('Rollup', () => {
  it('sums, averages and finds the least and most, archived counted, trashed and blank left out', () => {
    expect(value(p, 'f-points')).toBe(9);
    // Every child: the Note's Points too; Cost rounded to the penny.
    expect(value(p, 'f-spend')).toBe(300.56);
    expect(value(p, 'f-avg')).toBe(38);
    expect(value(p, 'f-min')).toBe(2);
    expect(value(p, 'f-max')).toBe(8);
  });

  it('finds the earliest and latest day', () => {
    expect(value(p, 'f-first')).toBe('2026-10-20');
    expect(value(p, 'f-last')).toBe('2026-11-03');
  });

  it('counts children, and the done ones by the boards rule', () => {
    expect(value(p, 'f-count')).toBe(5);
    expect(value(p, 'f-done')).toBe(2);
    // Without the done rule, Count Done reads none.
    expect(
      calculatedValue(def(project, 'f-done'), p, index, undefined, {
        type: project,
        items: byId,
        types,
      }),
    ).toBeNull();
  });

  it('reads no value with nothing to aggregate, and 0 with nothing to count', () => {
    expect(value(empty, 'f-points')).toBeNull();
    expect(value(empty, 'f-last')).toBeNull();
    expect(value(empty, 'f-count')).toBe(0);
    expect(value(empty, 'f-done')).toBe(0);
  });

  it('reads a Formula on each child, and a Formula reads the Rollup', () => {
    expect(value(p, 'f-weighted')).toBe(18);
    expect(value(p, 'f-left')).toBe(699.44);
  });

  it('reads none without the catalogue', () => {
    expect(calculatedValue(def(project, 'f-points'), p, index, isDone)).toBeNull();
    expect(
      calculatedValue(def(project, 'f-points'), p, index, isDone, { type: project, items: byId }),
    ).toBeNull();
  });

  it('writes as its result reads', () => {
    expect(calculatedText(def(project, 'f-spend'), 300.56)).toBe(currencyText(300.56, 'USD'));
    expect(calculatedText(def(project, 'f-last'), '2026-11-03')).toBe(
      dayLabel('2026-11-03', 'medium'),
    );
    expect(calculatedText(def(project, 'f-avg'), 38)).toBe('38%');
    expect(percentShown(def(project, 'f-avg'), 38)).toBe(38);
    expect(calculatedText(def(project, 'f-count'), 5)).toBe('5');
  });
});

describe('Lookup', () => {
  it("shows the linked card's field as its result", () => {
    expect(value(t1, 'f-mail')).toBe('a@b.co');
    expect(value(t1, 'f-ptitle')).toBe('Launch');
    // A Rollup on the linked card, read through the walk.
    expect(value(t1, 'f-pdue')).toBe('2026-11-03');
    expect(value(t1, 'f-pspend')).toBe(300.56);
  });

  it('reads no value without a link, or with a missing or trashed card', () => {
    expect(value(orphan, 'f-mail')).toBeNull();
    expect(value(item({ title: 'X' }), 'f-mail')).toBeNull();
    const binned = item({ title: 'P2', status: 'trash' }, { type: 'project' });
    const linked = item({ title: 'Y', parent: binned.id });
    const items = new Map([...byId, [binned.id, binned], [linked.id, linked]]);
    expect(
      calculatedValue(def(task, 'f-ptitle'), linked, index, isDone, { type: task, items, types }),
    ).toBeNull();
  });

  it('reads an archived linked card, and the first live card of a field holding several', () => {
    const archived = item({ title: 'Old', archived: true }, { type: 'project' });
    const many: ItemTypeDef = {
      ...task,
      id: 'many',
      custom: task.custom!.map((c) => (c.id === 'parent' ? { ...c, multiple: true } : c)),
    };
    const card = item({ title: 'Z', parent: ['gone', archived.id, p.id] }, { type: 'many' });
    const items = new Map([...byId, [archived.id, archived], [card.id, card]]);
    expect(
      calculatedValue(def(many, 'f-ptitle'), card, index, isDone, {
        type: many,
        items,
        types: [...types, many],
      }),
    ).toBe('Old');
  });

  it('reads a list as text, and no value for a list read as a number', () => {
    const labelled: ItemTypeDef = { ...project, fields: [...project.fields, 'labels'] };
    const lp = item({ title: 'L', labels: ['a', 'b'] }, { type: 'project' });
    const lt = item({ title: 'T', parent: lp.id });
    const items = new Map([
      [lp.id, lp],
      [lt.id, lt],
    ]);
    const ts = [labelled, task];
    const labels = look('f-x', 'X', { through: 'parent', source: 'labels', result: 'text' });
    const asNumber = look('f-y', 'Y', { through: 'parent', source: 'labels' });
    const reading = { type: task, items, types: ts };
    expect(calculatedValue(labels, lt, index, isDone, reading)).toBe('a, b');
    expect(calculatedValue(asNumber, lt, index, isDone, reading)).toBeNull();
  });
});

describe('problems', () => {
  it('a Card field or field that is gone is an error', () => {
    const gone = roll('f-g', 'G', { through: 'f-nope', aggregate: 'count' });
    expect(
      calculatedOutcome(gone, p, index, isDone, { type: project, items: byId, types }),
    ).toEqual({ ok: false, error: GONE_PROBLEM });
    const noSource = roll('f-g2', 'G2', { aggregate: 'sum', source: 'f-nope' });
    expect(rollupProblem(noSource, project, types)).toBe(GONE_PROBLEM);
    const lookGone = look('f-g3', 'G3', { through: 'parent', source: 'f-nope' });
    expect(rollupProblem(lookGone, task, types)).toBe(GONE_PROBLEM);
    expect(rollupProblem({ kind: 'number' }, task, types)).toBeNull();
    // As a value: none.
    expect(
      calculatedValue(gone, p, index, isDone, { type: project, items: byId, types }),
    ).toBeNull();
  });

  it('a value that reads itself through other cards is an error, and terminates', () => {
    // A project sums its tasks' Lookup of the project's own Rollup.
    const loopProject: ItemTypeDef = {
      ...project,
      custom: [roll('f-loop', 'Loop', { through: 'parent', aggregate: 'sum', source: 'f-back' })],
      fields: ['title', 'f-loop'],
    };
    const loopTask: ItemTypeDef = {
      ...task,
      custom: [
        { id: 'parent', label: 'Parent', kind: 'card', linkType: 'project' },
        look('f-back', 'Back', { through: 'parent', source: 'f-loop' }),
      ],
      fields: ['title', 'parent', 'f-back'],
    };
    const ts = [loopProject, loopTask];
    const lp = item({ title: 'P' }, { type: 'project' });
    const lt = item({ title: 'T', parent: lp.id });
    const items = new Map([
      [lp.id, lp],
      [lt.id, lt],
    ]);
    const idx = childIndexOf(items.values(), ts);
    expect(
      calculatedOutcome(loopProject.custom![0]!, lp, idx, isDone, {
        type: loopProject,
        items,
        types: ts,
      }),
    ).toEqual({ ok: false, error: 'Circular: Loop reads itself' });
  });

  it('a chain deeper than it may read is too much to work out', () => {
    // A chain of cards, each linking to the one before, each looking up the one before's Lookup.
    const chain: ItemTypeDef = {
      id: 'step',
      label: 'Step',
      newTitle: 'New step',
      glyph: 'task',
      color: '#71717a',
      fields: ['title', 'f-prev', 'f-up'],
      custom: [
        { id: 'f-prev', label: 'Prev', kind: 'card', linkType: 'step' },
        look('f-up', 'Up', { through: 'f-prev', source: 'f-up' }),
      ],
    };
    const cards: Item[] = [];
    for (let i = 0; i < 12; i += 1)
      cards.push(item({ title: `S${i}`, 'f-prev': cards[i - 1]?.id ?? null }, { type: 'step' }));
    const items = new Map(cards.map((c) => [c.id, c]));
    const out = calculatedOutcome(
      chain.custom![1]!,
      cards[11]!,
      childIndexOf(cards, [chain]),
      isDone,
      {
        type: chain,
        items,
        types: [chain],
      },
    );
    expect(out).toEqual({ ok: false, error: 'Too much to work out' });
  });

  it('a Rollup over more children than its steps allow is too much to work out', () => {
    const big = new Map<string, Item>([[p.id, p]]);
    for (let i = 0; i <= CALCULATED_STEPS_MAX; i += 1) {
      const c = item({ parent: p.id }, { id: `big${i}` });
      big.set(c.id, c);
    }
    const out = calculatedOutcome(def(project, 'f-count'), p, childIndexFor(big, types), isDone, {
      type: project,
      items: big,
      types,
    });
    expect(out).toEqual({ ok: false, error: 'Too much to work out' });
  });

  it("a child's own error is skipped", () => {
    const broken: ItemTypeDef = {
      ...task,
      custom: task.custom!.map((c) => (c.id === 'f-double' ? { ...c, formula: '{f-pts} / 0' } : c)),
    };
    const ts = [project, broken, note];
    expect(
      calculatedValue(def(project, 'f-weighted'), p, childIndexOf(all, ts), isDone, {
        type: project,
        items: byId,
        types: ts,
      }),
    ).toBeNull();
  });
});

describe('settings', () => {
  it('Through lists the Card fields linking here, or the type own', () => {
    expect(rollupThroughOptions('project', types)).toEqual([
      { id: 'parent', label: 'Parent' },
      { id: 'f-about', label: 'About' },
    ]);
    expect(rollupChildTypes('project', 'parent', types).map((t) => t.id)).toEqual(['task']);
    expect(rollupChildTypes('project', undefined, types).map((t) => t.id)).toEqual([
      'task',
      'note',
    ]);
    expect(lookupThroughOptions(task)).toEqual([{ id: 'parent', label: 'Parent' }]);
  });

  it('Field lists what each calculation can read', () => {
    const names = (fs: { name: string }[]) => fs.map((f) => f.name);
    expect(
      names(rollupSourceOptions({ through: 'parent', aggregate: 'sum' }, 'project', types)),
    ).toEqual(['Estimate', 'Points', 'Cost', 'Project Spend', 'Double', 'Number']);
    // Average takes shares too.
    expect(
      names(rollupSourceOptions({ through: 'parent', aggregate: 'average' }, 'project', types)),
    ).toContain('Progress');
    expect(
      names(rollupSourceOptions({ through: 'parent', aggregate: 'latest' }, 'project', types)),
    ).toEqual(['Due Date', 'Project Due']);
    expect(lookupSourceOptions('parent', task, types).map((f) => f.name)).toContain('Client Email');
    expect(lookupSourceOptions('nope', task, types)).toEqual([]);
    expect(lookupSourceOptions('parent', { fields: [], custom: [] }, types)).toEqual([]);
  });

  it('aggregates fit their kinds', () => {
    expect(aggregateFits('sum', { reads: 'percent' })).toBe(false);
    expect(aggregateFits('max', { reads: 'percent' })).toBe(true);
    expect(aggregateFits('sum', { reads: 'text' })).toBe(false);
    expect(aggregateFits('count', { reads: 'number' })).toBe(false);
    expect(aggregateFits('earliest', { reads: 'date' })).toBe(true);
    expect(aggregateNeeds('sum')).toMatch(/Number, Currency, Rating or Estimate/);
    expect(aggregateNeeds('min')).toMatch(/Percent/);
    expect(aggregateNeeds('latest')).toMatch(/Date/);
    expect(isAggregate('countDone')).toBe(true);
    expect(isAggregate('median')).toBe(false);
    expect(aggregateOf({})).toBe('sum');
  });

  it('every readable field reads as its kind', () => {
    const reads = Object.fromEntries(readableFieldsOf(task).map((f) => [f.name, f.reads]));
    expect(reads).toMatchObject({
      Title: 'text',
      'Due Date': 'date',
      Estimate: 'number',
      Points: 'number',
      Cost: 'currency',
      Progress: 'percent',
      Parent: 'text',
      'Project Due': 'date',
      Number: 'number',
      Type: 'text',
    });
    const odd: ItemTypeDef = {
      ...task,
      fields: ['title', 'f-c', 'f-r', 'f-k'],
      custom: [
        { id: 'f-c', label: 'C', kind: 'checkbox' },
        { id: 'f-r', label: 'R', kind: 'rating' },
        { id: 'f-k', label: 'K', kind: 'calculated', calculation: 'childCount' },
      ],
    };
    expect(readableFieldsOf(odd).map((f) => f.reads)).toEqual([
      'text',
      'checkbox',
      'number',
      'number',
      'number',
      'text',
    ]);
  });

  it('the result is taken from what it reads', () => {
    const r = (more: Partial<CustomFieldDef>) =>
      inferredResult(roll('f-n', 'N', more), project, types);
    expect(r({ aggregate: 'sum', source: 'f-cost' })).toEqual({
      result: 'currency',
      currency: 'USD',
    });
    expect(r({ aggregate: 'average', source: 'f-prog' })).toEqual({ result: 'percent' });
    expect(r({ aggregate: 'sum', source: 'f-pts' })).toEqual({});
    expect(r({ aggregate: 'count' })).toEqual({});
    expect(r({ aggregate: 'earliest', source: 'due' })).toEqual({ result: 'date' });
    expect(r({ aggregate: 'sum', source: 'title' })).toEqual({});
    const l = (source: string) =>
      inferredResult(look('f-n', 'N', { through: 'parent', source }), task, types);
    expect(l('f-email')).toEqual({ result: 'text' });
    expect(l('f-last')).toEqual({ result: 'date' });
    expect(l('f-budget')).toEqual({});
    expect(inferredResult({ kind: 'number' }, task, types)).toEqual({});
    expect(
      rollupSettings(roll('f-n', 'N', { aggregate: 'count', source: 'f-pts' }), project, types),
    ).toEqual({
      through: undefined,
      aggregate: 'count',
      source: undefined,
      result: undefined,
      currency: undefined,
    });
    expect(
      rollupSettings(look('f-n', 'N', { through: 'parent', source: 'f-email' }), task, types),
    ).toMatchObject({ aggregate: undefined, source: 'f-email', result: 'text' });
  });

  it('kinds and results', () => {
    expect(hasResult(def(project, 'f-points'))).toBe(true);
    expect(hasResult({ kind: 'calculated', calculation: 'childCount' })).toBe(false);
    expect(isRollupField(def(project, 'f-points'))).toBe(true);
    expect(isLookupField(def(task, 'f-mail'))).toBe(true);
    expect(calculatedResultOf({ kind: 'number' })).toBeUndefined();
    expect(calculatedResultOf({ kind: 'calculated', calculation: 'childrenDone' })).toBe('percent');
    expect(calculatedResultOf({ kind: 'calculated' })).toBeUndefined();
    expect(calculatedResultOf(def(project, 'f-points'))).toBe('number');
    expect(canShowAsPercent(def(project, 'f-avg'))).toBe(true);
    expect(canShowAsPercent(def(project, 'f-points'))).toBe(false);
  });
});

describe('every surface', () => {
  const setup: PlanBoardSetup = {
    columns: [
      { status: 'doing', name: 'Doing' },
      { status: 'todo', name: 'To Do' },
      { status: 'done', name: 'Done', done: true },
    ],
    swimlaneBy: 'none',
  } as PlanBoardSetup;
  const p2 = item({ title: 'Second', status: 'doing' }, { type: 'project' });
  const t6 = item({ title: 'F', status: 'todo', parent: p2.id, 'f-pts': 50 });
  const items = new Map([...all, p2, t6].map((i) => [i.id, i]));

  it('the plan reader and the values every reader lists', () => {
    const read = calculatedReaderOf(items, types, isDone);
    expect(read(def(project, 'f-points'), p)).toBe(9);
    expect(read(def(project, 'f-points'), item({}, { type: 'gone' }))).toBeNull();
    const values = calculatedValuesOf(p, project, index, isDone, byId, types)!;
    expect(values['f-points']).toBe(9);
    expect(values['f-left']).toBe(699.44);
  });

  it('sorts by a Rollup as its result, and lists it to sort by', () => {
    expect(boardSortFieldsOf([project]).map((f) => f.id)).toEqual(
      expect.arrayContaining(['f-points', 'f-spend', 'f-last', 'f-avg']),
    );
    const sorted = sortCards([p, p2], [{ field: 'f-points', dir: 'desc' }], types, items, isDone);
    expect(sorted.map((c) => c.fields['title'])).toEqual(['Second', 'Launch']);
    const board = projectBoard(
      { ...setup, sortBy: [{ field: 'f-points', dir: 'asc' }] },
      items,
      undefined,
      types,
    );
    expect(board.columns[0]!.lanes[0]!.items.map((c) => c.fields['title'])).toEqual([
      'Launch',
      'Second',
    ]);
  });

  it('lays read-only swimlanes by a Rollup or Lookup, never by a Currency', () => {
    const lanes = laneFieldsOf(types);
    expect(lanes.find((f) => f.id === 'f-points')).toMatchObject({
      kind: 'number',
      readOnly: true,
    });
    expect(lanes.find((f) => f.id === 'f-mail')).toMatchObject({ kind: 'text', calculated: true });
    expect(lanes.find((f) => f.id === 'f-spend')).toBeUndefined();
    const board = projectBoard(
      { ...setup, swimlaneBy: 'field', swimlaneField: 'f-done' },
      items,
      undefined,
      types,
    );
    expect(board.lanes.map((l) => l.label)).toEqual(['0', '2', 'No Tasks Done']);
    const lane = board.lanes[1]!;
    expect(lane.readOnly).toBe(true);
    expect(laneDropPatch(lane, p)).toEqual({});
    const byMail = projectBoard(
      { ...setup, swimlaneBy: 'field', swimlaneField: 'f-mail' },
      items,
      undefined,
      types,
    );
    expect(byMail.lanes.map((l) => l.label)).toContain('a@b.co');
  });

  it('exports its value in CSV, and sheets read it by name', () => {
    const rows = boardCsvRows({ ...setup, addTypes: ['project'] }, items, types, undefined, isDone);
    const header = rows[0]!;
    const launch = rows.find((r) => r[1] === 'Launch')!;
    expect(launch[header.indexOf('Total Points')]).toBe('9');
    expect(launch[header.indexOf('Last Due')]).toBe('2026-11-03');
    expect(launch[header.indexOf('Tasks Done')]).toBe('2');
    const source = cardSourceOf(items.values(), types, { isDone });
    expect(source.fieldOf({ key: p.key }, 'Total Spend')).toBe(300.56);
    expect(source.fieldOf({ key: t1.key }, 'Client Mail')).toBe('a@b.co');
  });

  it('works a 2,000-card plan with several rollups out within budget', () => {
    const projects: Item[] = [];
    const cards: Item[] = [];
    for (let i = 0; i < 100; i += 1) projects.push(item({ title: `P${i}` }, { type: 'project' }));
    for (let i = 0; i < 1900; i += 1)
      cards.push(
        item({
          title: `T${i}`,
          status: i % 3 ? 'todo' : 'done',
          parent: projects[i % 100]!.id,
          'f-pts': i % 13,
          'f-cost': i,
          due: `2026-${String((i % 12) + 1).padStart(2, '0')}-10`,
        }),
      );
    const big = new Map([...projects, ...cards].map((c) => [c.id, c]));
    const fields = project.custom!.filter((c) => c.kind === 'calculated');
    const lookups = task.custom!.filter((c) => c.kind === 'calculated');
    const spent = cpuMsOf(() => {
      // As a board draws: the index once per items map, every card's every Calculated field.
      const idx = childIndexFor(big, types);
      for (const pr of projects)
        for (const f of fields)
          calculatedValue(f, pr, idx, isDone, { type: project, items: big, types });
      for (const c of cards)
        for (const f of lookups)
          calculatedValue(f, c, idx, isDone, { type: task, items: big, types });
    });
    expect(spent).toBeLessThan(cpuBudgetMs(1500));
  });
});

describe('the catalogue and agents', () => {
  const validated = (custom: unknown[]) =>
    validateItemTypeCatalogue({
      version: ITEM_TYPE_CATALOGUE_VERSION,
      types: [
        { ...project, custom, fields: ['title', ...custom.map((c) => (c as { id: string }).id)] },
      ],
    });

  it('keeps a Rollup and Lookup with their settings and result, refusing malformed ones', () => {
    const ok = validated([
      {
        id: 'f-a',
        label: 'A',
        kind: 'calculated',
        calculation: 'rollup',
        through: 'parent',
        aggregate: 'sum',
        source: 'f-pts',
        result: 'currency',
        currency: 'USD',
      },
      {
        id: 'f-b',
        label: 'B',
        kind: 'calculated',
        calculation: 'lookup',
        through: 'parent',
        source: '#key',
        aggregate: 'sum',
      },
    ]);
    expect(ok.ok && ok.catalogue.types[0]!.custom).toEqual([
      {
        id: 'f-a',
        label: 'A',
        kind: 'calculated',
        calculation: 'rollup',
        through: 'parent',
        aggregate: 'sum',
        source: 'f-pts',
        result: 'currency',
        currency: 'USD',
      },
      {
        id: 'f-b',
        label: 'B',
        kind: 'calculated',
        calculation: 'lookup',
        through: 'parent',
        source: '#key',
      },
    ]);
    expect(
      validated([
        { id: 'f-a', label: 'A', kind: 'calculated', calculation: 'rollup', aggregate: 'median' },
      ]).ok,
    ).toBe(false);
    expect(
      validated([
        { id: 'f-a', label: 'A', kind: 'calculated', calculation: 'rollup', source: 'Not An Id' },
      ]).ok,
    ).toBe(false);
    expect(
      validated([
        { id: 'f-a', label: 'A', kind: 'calculated', calculation: 'lookup', result: 'money' },
      ]).ok,
    ).toBe(false);
    expect(
      validated([
        {
          id: 'f-a',
          label: 'A',
          kind: 'calculated',
          calculation: 'lookup',
          result: 'currency',
          currency: 'usd',
        },
      ]).ok,
    ).toBe(false);
  });

  // Under the twelve custom fields a type holds, so a change can add more.
  const keep = ['f-points', 'f-spend', 'f-avg', 'f-count', 'f-email', 'f-last'];
  const small: ItemTypeDef = {
    ...project,
    fields: ['title', 'status', ...keep],
    custom: projectCustom.filter((c) => keep.includes(c.id)),
  };
  const base = { version: ITEM_TYPE_CATALOGUE_VERSION, types: [small, task, note] };
  const change = (changes: Parameters<typeof applyCardTypeChanges>[1]) =>
    applyCardTypeChanges(base, changes, []);
  const field = (r: ReturnType<typeof change>, type: string, label: string) =>
    r.ok
      ? r.catalogue!.types.find((t) => t.id === type)!.custom!.find((c) => c.label === label)
      : r;

  it('change_card_types adds them by names, taking the result from what they read', () => {
    const r = change([
      {
        op: 'set',
        type: 'Project',
        addCustom: [
          {
            name: 'Spend',
            kind: 'calculated',
            calculation: 'Rollup',
            through: 'Parent',
            aggregate: 'Sum',
            source: 'Cost',
          },
          {
            name: 'Avg',
            kind: 'calculated',
            calculation: 'rollup',
            through: 'all',
            aggregate: 'average',
            source: 'progress',
            showAs: 'percent',
          },
          {
            name: 'Done Count',
            kind: 'calculated',
            calculation: 'rollup',
            aggregate: 'Count Done',
          },
        ],
      },
      {
        op: 'set',
        type: 'Task',
        addCustom: [
          {
            name: 'Mail',
            kind: 'calculated',
            calculation: 'lookup',
            through: 'parent',
            source: 'client email',
          },
        ],
      },
    ]);
    expect(field(r, 'project', 'Spend')).toMatchObject({
      through: 'parent',
      aggregate: 'sum',
      source: 'f-cost',
      result: 'currency',
      currency: 'USD',
    });
    expect(field(r, 'project', 'Avg')).toMatchObject({
      aggregate: 'average',
      source: 'f-prog',
      result: 'percent',
      showAs: 'percent',
    });
    expect(field(r, 'project', 'Avg')).not.toHaveProperty('through');
    expect(field(r, 'project', 'Done Count')).toEqual({
      id: 'f-done-count',
      label: 'Done Count',
      kind: 'calculated',
      calculation: 'rollup',
      aggregate: 'countDone',
    });
    expect(field(r, 'task', 'Mail')).toMatchObject({
      through: 'parent',
      source: 'f-email',
      result: 'text',
    });
  });

  it('change_card_types edits them, re-taking the result, and drops settings with another calculation', () => {
    const r = change([
      {
        op: 'set',
        type: 'Project',
        editCustom: [
          { field: 'Total Points', source: 'Cost' },
          { field: 'Tasks', calculation: 'childCount' },
          { field: 'Average Progress', showAs: 'number' },
        ],
      },
    ]);
    expect(field(r, 'project', 'Total Points')).toMatchObject({
      source: 'f-cost',
      result: 'currency',
      currency: 'USD',
    });
    expect(field(r, 'project', 'Tasks')).toEqual({
      id: 'f-count',
      label: 'Tasks',
      kind: 'calculated',
      calculation: 'childCount',
    });
    expect(field(r, 'project', 'Average Progress')).not.toHaveProperty('showAs');
    const turned = change([
      { op: 'set', type: 'Project', editCustom: [{ field: 'Tasks', calculation: 'lookup' }] },
    ]);
    expect(turned).toMatchObject({
      ok: false,
      message: expect.stringMatching(/needs a card field to read through: Project has none yet/),
    });
    const keep = change([
      { op: 'set', type: 'Project', editCustom: [{ field: 'Total Spend', name: 'Spend' }] },
    ]);
    expect(field(keep, 'project', 'Spend')).toMatchObject({ result: 'currency', currency: 'USD' });
  });

  it('refuses settings that do not fit, saying what would', () => {
    const refused = (input: Record<string, string>, type = 'Project') =>
      change([
        { op: 'set', type, addCustom: [{ name: 'N', kind: 'calculated', ...input }] as never },
      ]);
    expect(refused({ calculation: 'rollup', aggregate: 'sum', source: 'title' })).toMatchObject({
      ok: false,
      message: expect.stringMatching(
        /"N" can't Sum "title": give a Number, Currency, Rating or Estimate field/,
      ),
    });
    expect(refused({ calculation: 'rollup', aggregate: 'sum' })).toMatchObject({
      message: expect.stringMatching(/"N" needs source/),
    });
    expect(refused({ calculation: 'rollup', aggregate: 'median' })).toMatchObject({
      message: expect.stringMatching(/can't median/),
    });
    expect(refused({ calculation: 'rollup', aggregate: 'count', through: 'Owner' })).toMatchObject({
      message: expect.stringMatching(/give all, Parent or About/),
    });
    expect(
      refused({ calculation: 'rollup', aggregate: 'count', through: 'X' }, 'Note'),
    ).toMatchObject({ message: expect.stringMatching(/no card field links to Note/) });
    expect(refused({ calculation: 'lookup' }, 'Task')).toMatchObject({
      message: expect.stringMatching(/needs through: Parent/),
    });
    expect(refused({ calculation: 'lookup', through: 'nope' }, 'Task')).toMatchObject({
      message: expect.stringMatching(/give Parent/),
    });
    expect(
      refused({ calculation: 'lookup', through: 'parent', source: 'nope' }, 'Task'),
    ).toMatchObject({ message: expect.stringMatching(/can't look up "nope"/) });
    expect(refused({ calculation: 'lookup', through: 'parent' }, 'Task')).toMatchObject({
      message: expect.stringMatching(/needs source: a field of the linked card/),
    });
    expect(refused({ calculation: 'childCount', source: 'x' })).toMatchObject({
      message: expect.stringMatching(/is no rollup or lookup/),
    });
    expect(refused({ calculation: 'rollup', aggregate: 'count', showAs: 'percent' })).toMatchObject(
      { message: expect.stringMatching(/can't show as a percent/) },
    );
    expect(refused({ calculation: 'rollup', aggregate: 'count', showAs: 'bar' })).toMatchObject({
      message: expect.stringMatching(/not a way to show/),
    });
    const editBad = change([
      { op: 'set', type: 'Project', editCustom: [{ field: 'Total Points', showAs: 'percent' }] },
    ]);
    expect(editBad).toMatchObject({ ok: false });
    const editBadShow = change([
      {
        op: 'set',
        type: 'Project',
        editCustom: [{ field: 'Total Points', source: 'Points', showAs: 'pie' }],
      },
    ]);
    expect(editBadShow).toMatchObject({ message: expect.stringMatching(/not a way to show/) });
  });

  it('a person in a lookup reads by name', () => {
    const owned: ItemTypeDef = { ...project, fields: [...project.fields, 'assignee'] };
    const op = item({ title: 'P', assignee: SAM }, { type: 'project' });
    const ot = item({ title: 'T', parent: op.id });
    const items = new Map([
      [op.id, op],
      [ot.id, ot],
    ]);
    expect(
      calculatedValue(
        look('f-o', 'O', { through: 'parent', source: 'assignee', result: 'text' }),
        ot,
        index,
        isDone,
        {
          type: task,
          items,
          types: [owned, task],
        },
      ),
    ).toBe('Sam Lee');
  });
});
