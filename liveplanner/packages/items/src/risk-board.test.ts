import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from './board';
import { laneDropPatch, laneFieldOf, laneFieldsOf } from './board-lane-fields';
import { boardLanes, cardsMatchingFilters, laneGroups } from './board-lanes';
import {
  boardSortFieldOf,
  boardSortFieldsOf,
  boardSortLabel,
  defaultBoardSortDir,
  sortCards,
} from './board-sort';
import { searchFilterLabel, searchValues } from './card-search';
import { cardSourceOf } from './card-source';
import { fieldShapeOf, viewsOfField } from './field-widgets';
import { fieldValueOn } from './formula-fields';
import type { Item } from './item';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import { resolveFields } from './plan-names';
import { canBeRequired, missingRequiredFields } from './required-fields';
import { RISK_OPTIONS } from './risk-fields';
import { item } from './test-items';
import { setValueOf, Failed, type SetValueInput } from './automation/set-value';
import { NOW, OUTLINE, ZONE } from './automation/test-fixtures';
import type { TrackerBoard, TrackerCard } from './tracker-import/tracker-model';
import { planTrackerImport } from './tracker-import/tracker-plan';
import { TRACKER_TYPE_IDS } from './tracker-import/tracker-type';

// docs/specs/026-plan/item-types.md "Risk": the board behaviours, each reading a level by its id and naming it.
const RISK: CustomFieldDef = { id: 'f-risk', label: 'Risk', kind: 'risk' };
const TYPE: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'f-risk'],
  custom: [RISK],
};
const TYPES = [TYPE];
const risky = (risk: unknown, title = 'Card') =>
  item({ title, status: 'todo', ...(risk === undefined ? {} : { 'f-risk': risk as string }) });
const mapOf = (cards: readonly Item[]) => new Map(cards.map((c) => [c.id, c]));
const titles = (cards: readonly Item[]) => cards.map((c) => c.fields['title']);

describe('sorting by a Risk', () => {
  it('is offered, named and starts Highest First, Critical first, as Priority does', () => {
    expect(boardSortFieldsOf(TYPES)).toContainEqual({ id: 'f-risk', label: 'Risk', kind: 'risk' });
    expect(boardSortFieldOf('f-risk', TYPES)?.kind).toBe('risk');
    expect(defaultBoardSortDir('risk')).toBe('desc');
    expect(boardSortLabel('risk', 'desc')).toBe('Highest First');
    expect(boardSortLabel('risk', 'asc')).toBe('Lowest First');
  });

  it('orders by level, a card with no level or a stray value last either way', () => {
    const cards = [
      risky('low', 'L'),
      risky(undefined, 'None'),
      risky('critical', 'C'),
      risky('High', 'Stray'),
      risky('medium', 'M'),
      risky('high', 'H'),
    ];
    expect(titles(sortCards(cards, [{ field: 'f-risk', dir: 'desc' }], TYPES))).toEqual([
      'C',
      'H',
      'M',
      'L',
      'None',
      'Stray',
    ]);
    expect(titles(sortCards(cards, [{ field: 'f-risk', dir: 'asc' }], TYPES))).toEqual([
      'L',
      'M',
      'H',
      'C',
      'None',
      'Stray',
    ]);
  });
});

describe('swimlanes by a Risk', () => {
  const setup = (): PlanBoardSetup => ({
    title: 'Risks',
    cardFields: [],
    hideWriting: false,
    columns: [{ id: 'todo', status: 'todo', name: 'To Do' }],
    swimlaneBy: 'field',
    swimlaneField: 'f-risk',
  });

  it('is a lane field of its own kind', () => {
    expect(laneFieldsOf(TYPES).find((f) => f.id === 'f-risk')).toEqual({
      id: 'f-risk',
      label: 'Risk',
      kind: 'risk',
    });
  });

  it('lays a row per level in order, named, cards or not, then No Risk', () => {
    const cards = [risky('low'), risky('critical'), risky(undefined), risky('nope')];
    const groups = boardLanes(setup(), cards, mapOf(cards), TYPES, undefined, () => false);
    expect(groups.lanes.map((l) => [l.key, l.label])).toEqual([
      ['f:"critical"', 'Critical'],
      ['f:"high"', 'High'],
      ['f:"medium"', 'Medium'],
      ['f:"low"', 'Low'],
      ['', 'No Risk'],
    ]);
    // A stray value reads as no level.
    expect(groups.lanesOfItem.get(cards[3]!.id)).toEqual(['']);
  });

  it('groups only the levels cards have, in order, where a chart or a filter reads them', () => {
    const cards = [risky('low'), risky('high'), risky('low')];
    const groups = laneGroups('field', 'f-risk', cards, mapOf(cards), TYPES);
    expect(groups.lanes.map((l) => l.label)).toEqual(['High', 'Low']);
  });

  it('sets the level a card is dropped into, and clears it in No Risk', () => {
    const field = laneFieldOf('f-risk', TYPES)!;
    const cards = [risky('low')];
    const lanes = boardLanes(setup(), cards, mapOf(cards), TYPES, undefined, () => false).lanes;
    const high = lanes.find((l) => l.label === 'High')!;
    expect(field.kind).toBe('risk');
    expect(laneDropPatch(high)).toEqual({ set: { 'f-risk': 'high' } });
    expect(laneDropPatch(lanes.find((l) => l.key === ''))).toEqual({ clear: ['f-risk'] });
  });
});

describe('filtering and searching by a Risk', () => {
  const cards = [risky('high', 'A'), risky('low', 'B'), risky(undefined, 'C'), risky('high', 'D')];

  it('offers the levels the cards have, in order, counted, then No Risk', () => {
    expect(searchValues(cards, { by: 'field', field: 'f-risk' }, TYPES)).toEqual([
      { key: 'f:"high"', label: 'High', count: 2 },
      { key: 'f:"low"', label: 'Low', count: 1 },
      { key: '', label: 'No Risk', count: 1 },
    ]);
  });

  it('matches the cards at a level, and names a filter chip by the level', () => {
    const filter = { by: 'field' as const, field: 'f-risk', key: 'f:"high"' };
    expect(titles(cardsMatchingFilters(cards, [filter], mapOf(cards), TYPES))).toEqual(['A', 'D']);
    expect(searchFilterLabel(filter, cards, TYPES)).toEqual({ field: 'Risk', value: 'High' });
  });

  it('names a level no card has any more by its name, and the empty value No Risk', () => {
    const none = [risky('low')];
    expect(
      searchFilterLabel({ by: 'field', field: 'f-risk', key: 'f:"critical"' }, none, TYPES).value,
    ).toBe('Critical');
    expect(searchFilterLabel({ by: 'field', field: 'f-risk', key: '' }, [], TYPES).value).toBe(
      'No Risk',
    );
    // A key naming no level keeps its text.
    expect(
      searchFilterLabel({ by: 'field', field: 'f-risk', key: 'f:"severe"' }, none, TYPES).value,
    ).toBe('severe');
  });
});

describe('widgets, formulas and sheets read a Risk', () => {
  it('as a category, counted per level in a Breakdown or a Donut', () => {
    expect(fieldShapeOf(RISK)).toEqual({ kind: 'category', from: 'risk' });
    expect(viewsOfField(RISK)).toEqual(['breakdown', 'donut']);
  });

  it('in a formula as its name, as text', () => {
    expect(fieldValueOn(risky('critical'), TYPE, 'f-risk')).toBe('Critical');
    expect(fieldValueOn(risky(undefined), TYPE, 'f-risk')).toBeNull();
    expect(fieldValueOn(risky('severe'), TYPE, 'f-risk')).toBeNull();
  });

  it('in card tables and card functions as its name', () => {
    const card = risky('medium');
    const none = risky(undefined);
    const source = cardSourceOf([card, none], TYPES);
    expect(source.fieldOf(card, 'Risk')).toBe('Medium');
    expect(source.fieldOf(none, 'Risk')).toBeNull();
  });

  it('written back by name or id, in any case; any other text refused naming the levels', () => {
    const naming = { statuses: [], items: [] };
    expect(resolveFields({ Risk: ' HIGH ' }, TYPE, naming)).toEqual({
      ok: true,
      fields: { 'f-risk': 'high' },
    });
    expect(resolveFields({ 'f-risk': 'critical' }, TYPE, naming)).toMatchObject({
      ok: true,
      fields: { 'f-risk': 'critical' },
    });
    expect(resolveFields({ Risk: 'Severe' }, TYPE, naming)).toMatchObject({
      ok: false,
      code: 'choice_unknown',
      message: '"Severe" is not a Risk level. Pick Critical, High, Medium or Low.',
    });
  });
});

describe('a required Risk', () => {
  it('can be required, and no level is empty', () => {
    expect(canBeRequired('risk')).toBe(true);
    const type = { ...TYPE, custom: [{ ...RISK, required: true }] };
    expect(missingRequiredFields(type, {}).map((f) => f.id)).toEqual(['f-risk']);
    expect(missingRequiredFields(type, { 'f-risk': 'low' })).toEqual([]);
  });
});

describe("automations' Set Field on a Risk", () => {
  const input = (text: string): SetValueInput => {
    const card = risky(undefined);
    return {
      value: { text },
      field: 'f-risk',
      name: 'Risk',
      kind: 'risk',
      card,
      outline: OUTLINE,
      now: NOW,
      timeZone: ZONE,
      values: {
        card,
        type: TYPE,
        outline: OUTLINE,
        url: '',
        person: 'Sam',
        rule: 'Rule',
        now: NOW,
        timeZone: ZONE,
      },
    };
  };

  it('sets a level its text names, in any case', () => {
    expect(setValueOf(input('Critical'))).toBe('critical');
    expect(setValueOf(input(' low '))).toBe('low');
  });

  it('fails the run for any other text', () => {
    expect(() => setValueOf(input('Severe'))).toThrow(Failed);
    expect(() => setValueOf(input('Severe'))).toThrow('Risk has no "Severe"');
  });
});

describe('a tracker import into a plan with a Risk field', () => {
  const card = (title: string, risk: string): TrackerCard => ({
    title,
    column: 'Todo',
    description: '',
    labels: [],
    checklist: [],
    comments: [],
    links: [],
    extras: { risk },
  });
  const board = (kind: 'choice' | 'text'): TrackerBoard => ({
    source: 'linear',
    title: 'Imported',
    columns: ['Todo'],
    cards: [card('A', 'High'), card('B', 'critical'), card('C', 'Unknown')],
    extras: [
      {
        key: 'risk',
        label: 'Risk',
        kind,
        ...(kind === 'choice' ? { options: ['High', 'critical', 'Unknown'] } : {}),
      },
    ],
    skips: {},
  });
  const own: ItemTypeDef = { ...TYPE, id: TRACKER_TYPE_IDS.linear, label: 'Linear Issue' };

  it.each(['choice', 'text'] as const)('fills it from a %s of its name, by level', (kind) => {
    const plan = planTrackerImport(board(kind), {
      types: [own],
      statuses: [],
      people: [],
      members: [],
      room: 100,
      boardId: 'board-1',
    });
    // The plan's Risk is kept as it is, gaining no options, and no second field is made.
    expect(plan.type.custom).toEqual([RISK]);
    expect(plan.creates.map((c) => c.fields['f-risk'])).toEqual(['high', 'critical', undefined]);
  });
});

describe('the four names', () => {
  it('list a Choice of the levels, in order', () => {
    expect(RISK_OPTIONS).toEqual(['Critical', 'High', 'Medium', 'Low']);
  });
});
