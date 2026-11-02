import { describe, expect, it } from 'vitest';
import { laneDropPatch, laneFieldsOf, projectBoard, type PlanBoardSetup } from './board';
import { calendarMove } from './calendar-move';
import { colourFieldOf, itemColourOf } from './item-colour';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { breakdownModel, calendarModel } from './plan-view-charts';
import { ganttDrag, ganttModel } from './plan-view-gantt';
import { dayNumber } from './plan-view-dates';
import {
  ganttEligibleTypes,
  ganttShownTypes,
  isPlanViewSettings,
  viewEligibleTypes,
  viewNeeds,
} from './plan-views';
import { presetSetup } from './presets';
import { ALI, SAM, item } from './test-items';
import { readItemTypeCatalogue } from './type-catalogue';
import {
  BUILT_IN_DATES,
  VIEW_FIELD_ID_MAX,
  isViewFieldId,
  measureCountLabel,
  measureNumber,
  measureValue,
  viewDateName,
  viewDateOptions,
  viewDatesOf,
  viewMeasureOf,
  viewMeasureOptions,
} from './view-fields';

// docs/specs/026-plan/item-types.md "Fields by role", plan-views.md "Dates" and "Cards by Field".
const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const sprintTask: ItemTypeDef = {
  ...task,
  fields: [...task.fields, 'f-kick', 'f-ship', 'f-pts', 'f-owner', 'f-tint', 'f-tags'],
  custom: [
    { id: 'f-kick', label: 'Kickoff', kind: 'date' },
    { id: 'f-ship', label: 'Ship Date', kind: 'date' },
    { id: 'f-pts', label: 'Story Points', kind: 'number' },
    { id: 'f-owner', label: 'Owner', kind: 'person' },
    { id: 'f-tint', label: 'Tint', kind: 'colour' },
    { id: 'f-tags', label: 'Tags', kind: 'labels' },
  ],
};
const types = [sprintTask, ...ITEM_TYPES.filter((t) => t.id !== 'task')];
const picked = { start: 'f-kick', due: 'f-ship' };
const phases = new Map([
  ['todo', 'todo' as const],
  ['doing', 'doing' as const],
  ['done', 'done' as const],
]);

describe('view fields', () => {
  it('lists the built-in date first, then the custom Date fields', () => {
    expect(viewDateOptions(types, 'start').map((o) => o.label)).toEqual([
      'Start Date',
      'Kickoff',
      'Ship Date',
    ]);
    expect(viewDateOptions([], 'due')).toEqual([]);
  });

  it('reads a pick only while a type offers it as a Date field', () => {
    expect(viewDatesOf({ startField: 'f-kick', dueField: 'f-ship' }, types)).toEqual(picked);
    expect(viewDatesOf({ startField: 'f-pts' }, types)).toEqual(BUILT_IN_DATES);
    expect(viewDatesOf({ dueField: 'f-ship' }, ITEM_TYPES)).toEqual(BUILT_IN_DATES);
    expect(viewDatesOf(undefined, types)).toEqual(BUILT_IN_DATES);
  });

  it('names a date as an announcement says it', () => {
    expect(viewDateName(types, 'start')).toBe('Start');
    expect(viewDateName(types, 'due')).toBe('Due');
    expect(viewDateName(types, 'f-kick')).toBe('Kickoff');
    expect(viewDateName(types, 'gone')).toBe('date');
  });

  it('measures by Estimate or a Number field, a missing or negative value as nothing', () => {
    expect(viewMeasureOptions(types).map((o) => o.id)).toEqual(['estimate', 'f-pts']);
    expect(viewMeasureOptions([])).toEqual([]);
    expect(viewMeasureOf({ measure: 'f-pts' }, types)?.label).toBe('Story Points');
    expect(viewMeasureOf({ measure: 'f-kick' }, types)).toBeUndefined();
    expect(viewMeasureOf({}, types)).toBeUndefined();
    expect(measureValue(item({ 'f-pts': 3 }), 'f-pts')).toBe(3);
    expect(measureValue(item({ 'f-pts': -2 }), 'f-pts')).toBe(0);
    expect(measureValue(item({ 'f-pts': 'x' }), 'f-pts')).toBe(0);
  });

  it('says a measured total', () => {
    expect(measureCountLabel(1, { id: 'estimate', label: 'Estimate' })).toBe('1 point');
    expect(measureCountLabel(34, { id: 'estimate', label: 'Estimate' })).toBe('34 points');
    expect(measureCountLabel(0.1 + 0.2, { id: 'f-pts', label: 'Story Points' })).toBe(
      '0.3 Story Points',
    );
    expect(measureNumber(5)).toBe('5');
  });

  it('checks a stored field id', () => {
    expect(isViewFieldId('f-kick')).toBe(true);
    expect(isViewFieldId('')).toBe(false);
    expect(isViewFieldId('x'.repeat(VIEW_FIELD_ID_MAX + 1))).toBe(false);
    expect(isViewFieldId(3)).toBe(false);
    expect(isPlanViewSettings({ view: 'gantt', startField: 'f-kick', dueField: 'f-ship' })).toBe(
      true,
    );
    expect(isPlanViewSettings({ view: 'workload', measure: 'f-pts' })).toBe(true);
    expect(isPlanViewSettings({ view: 'gantt', startField: 7 })).toBe(false);
  });
});

describe('views by their picked fields', () => {
  it('a Gantt chart lists the types with its picked dates', () => {
    const plain = ITEM_TYPES.find((t) => t.id !== 'task')!;
    const settings = { startField: 'f-kick', dueField: 'f-ship' };
    expect(ganttEligibleTypes([sprintTask, plain], picked).map((t) => t.id)).toEqual(['task']);
    expect(ganttShownTypes(settings, [sprintTask, plain])).toEqual(['task']);
    expect(viewNeeds('gantt', settings, types)).toEqual(['f-kick', 'f-ship']);
    expect(viewNeeds('gantt')).toEqual(['start', 'due']);
    expect(viewNeeds('workload', { measure: 'f-pts' }, types)).toContain('f-pts');
    expect(viewEligibleTypes('workload', types, { measure: 'f-pts' }).map((t) => t.id)).toEqual([
      'task',
    ]);
  });

  it('a Gantt bar runs between the picked dates, and a drag writes them', () => {
    const a = item({ title: 'a', 'f-kick': '2026-10-05', 'f-ship': '2026-10-09' });
    const m = ganttModel([a], phases, new Date(2026, 9, 1), ['task'], picked);
    const row = m.rows.find((r) => r.item.id === a.id)!;
    expect(row.mark).toBe('bar');
    expect(row.from).toBe(dayNumber('2026-10-05'));
    expect(ganttDrag(row, 'bar', 2, picked)?.set).toEqual({
      'f-kick': '2026-10-07',
      'f-ship': '2026-10-11',
    });
    expect(ganttDrag(row, 'to', 1, picked)?.set).toEqual({ 'f-ship': '2026-10-10' });
    expect(ganttDrag(row, 'from', -1, picked)?.set).toEqual({ 'f-kick': '2026-10-04' });
    // Only a due date: a diamond, moved by its own field.
    const b = item({ title: 'b', 'f-ship': '2026-10-09' });
    const mb = ganttModel([b], phases, new Date(2026, 9, 1), ['task'], picked);
    expect(ganttDrag(mb.rows[0]!, 'mark', 1, picked)?.set).toEqual({ 'f-ship': '2026-10-10' });
  });

  it('a calendar places and moves cards by its picked date', () => {
    const a = item({ title: 'a', 'f-kick': '2026-10-05', 'f-ship': '2026-10-08' });
    const m = calendarModel([a], phases, 2026, 9, 'due', picked);
    const day = m.weeks.flat().find((d) => d.cards.length > 0)!;
    expect(day.date).toBe(8);
    expect(calendarModel([a], phases, 2026, 9, 'due').count).toBe(0);
    // Moving the due date past the start carries nothing; before it, carries the start too.
    expect(calendarMove(a, 'due', dayNumber('2026-10-10')!, picked)?.set).toEqual({
      'f-ship': '2026-10-10',
    });
    expect(calendarMove(a, 'due', dayNumber('2026-10-01')!, picked)?.set).toEqual({
      'f-ship': '2026-10-01',
      'f-kick': '2026-09-28',
    });
    expect(calendarMove(a, 'start', dayNumber('2026-10-12')!, picked)?.set).toEqual({
      'f-kick': '2026-10-12',
      'f-ship': '2026-10-15',
    });
  });

  it('Cards by Field sums a measure, and orders a Person field busiest first', () => {
    const cards = [
      item({ title: 'a', status: 'todo', 'f-owner': SAM, 'f-pts': 2 }),
      item({ title: 'b', status: 'done', 'f-owner': ALI, 'f-pts': 5 }),
      item({ title: 'c', status: 'doing', 'f-owner': ALI, 'f-pts': 3 }),
      item({ title: 'd', status: 'todo' }),
    ];
    const counted = breakdownModel(cards, phases, { by: 'field', field: 'f-owner' }, types);
    expect(counted.rows.map((r) => [r.label, r.total])).toEqual([
      ['Ali', 2],
      ['Sam Lee', 1],
      ['No Owner', 1],
    ]);
    expect(counted.rows[0]!.person).toEqual(ALI);
    expect(counted.total).toBe(4);
    const summed = breakdownModel(
      cards,
      phases,
      { by: 'field', field: 'f-owner' },
      types,
      undefined,
      undefined,
      'f-pts',
    );
    expect(summed.rows.map((r) => [r.label, r.total])).toEqual([
      ['Ali', 8],
      ['Sam Lee', 2],
      ['No Owner', 0],
    ]);
    expect(summed.rows[0]!.counts).toEqual({ todo: 0, doing: 3, done: 5 });
    expect(summed.total).toBe(10);
    expect(summed.max).toBe(8);
  });
});

describe('lanes by a Person or a Labels field', () => {
  const board = (field: string): PlanBoardSetup => ({
    ...presetSetup('kanban'),
    swimlaneBy: 'field',
    swimlaneField: field,
  });
  const map = (items: ReturnType<typeof item>[]) => new Map(items.map((i) => [i.id, i]));

  it('offers them as lane fields', () => {
    const ids = laneFieldsOf(types).map((f) => f.id);
    expect(ids).toContain('f-owner');
    expect(ids).toContain('f-tags');
  });

  it('rows each person by name, then No Owner; a drop sets the person', () => {
    const items = [
      item({ title: 'a', status: 'todo', 'f-owner': SAM }),
      item({ title: 'b', status: 'todo', 'f-owner': ALI }),
      item({ title: 'c', status: 'todo' }),
    ];
    const p = projectBoard(board('f-owner'), map(items), undefined, types);
    expect(p.lanes.map((l) => l.label)).toEqual(['Ali', 'Sam Lee', 'No Owner']);
    expect(p.lanes[0]!.person).toEqual(ALI);
    expect(laneDropPatch(p.lanes[1], items[2])).toEqual({ set: { 'f-owner': SAM } });
    expect(laneDropPatch(p.lanes[2], items[0])).toEqual({ clear: ['f-owner'] });
  });

  it('rows a Labels field by its first label', () => {
    const items = [
      item({ title: 'a', status: 'todo', 'f-tags': ['ux', 'api'] }),
      item({ title: 'b', status: 'todo', 'f-tags': ['api'] }),
      item({ title: 'c', status: 'todo' }),
    ];
    const p = projectBoard(board('f-tags'), map(items), undefined, types);
    expect(p.lanes.map((l) => l.label)).toEqual(['api', 'ux', 'No Tags']);
    const ux = p.lanes.find((l) => l.label === 'ux')!;
    expect(laneDropPatch(ux, items[1])).toEqual({ set: { 'f-tags': ['ux', 'api'] } });
  });
});

describe('card colour', () => {
  it('reads the type’s Colour field, else the built-in', () => {
    const tinted = { ...sprintTask, colourField: 'f-tint' };
    const card = item({ color: '#111111', 'f-tint': '#ff0000' });
    expect(colourFieldOf(tinted)).toBe('f-tint');
    expect(itemColourOf(card, tinted)).toBe('#ff0000');
    expect(itemColourOf(card, sprintTask)).toBe('#111111');
    expect(itemColourOf(card)).toBe('#111111');
    // A field the type no longer has reads as the built-in.
    expect(colourFieldOf({ ...tinted, fields: task.fields })).toBe('color');
  });

  it('keeps a colourField only when it names a custom Colour field', () => {
    const read = (colourField: string) =>
      readItemTypeCatalogue({ version: 1, types: [{ ...sprintTask, colourField }] })?.types[0];
    expect(read('f-tint')?.colourField).toBe('f-tint');
    expect(read('f-pts')?.colourField).toBeUndefined();
  });
});
