import { describe, expect, it } from 'vitest';
import {
  laneDropPatch,
  laneFieldOf,
  laneFieldsOf,
  normaliseBoardSetup,
  projectBoard,
  type PlanBoardSetup,
} from './board';
import { isSwimlaneSettable, type Item } from './item';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { presetSetup } from './presets';
import { item } from './test-items';

// docs/specs/026-plan/plan-board.md "Swimlanes by a field".
const map = (items: Item[]) => new Map(items.map((i) => [i.id, i]));
const project: ItemTypeDef = {
  ...ITEM_TYPES[0]!,
  fields: [
    ...ITEM_TYPES[0]!.fields,
    'f-stage',
    'f-signed',
    'f-seats',
    'f-renewal',
    'f-customer',
    'f-notes',
  ],
  custom: [
    { id: 'f-stage', label: 'Stage', kind: 'choice', options: ['Lead', 'Trial', 'Won'] },
    { id: 'f-signed', label: 'Signed', kind: 'checkbox' },
    { id: 'f-seats', label: 'Seats', kind: 'number' },
    { id: 'f-renewal', label: 'Renewal', kind: 'date' },
    { id: 'f-customer', label: 'Customer', kind: 'text' },
    { id: 'f-notes', label: 'Notes', kind: 'longtext' },
  ],
};
// A second type sharing an id reads as the same field, named by the first.
const other: ItemTypeDef = {
  ...ITEM_TYPES[1]!,
  fields: [...ITEM_TYPES[1]!.fields, 'f-stage'],
  custom: [{ id: 'f-stage', label: 'Phase', kind: 'text' }],
};
const types = [project, other, ...ITEM_TYPES.slice(2)];
const board = (field: string): PlanBoardSetup => ({
  ...presetSetup('kanban'),
  swimlaneBy: 'field',
  swimlaneField: field,
});
const labels = (field: string, items: Item[]) =>
  projectBoard(board(field), map(items), undefined, types).lanes.map((l) => l.label);
const laneOfTitle = (field: string, items: Item[], title: string) => {
  const p = projectBoard(board(field), map(items), undefined, types);
  for (const c of p.columns)
    for (const l of c.lanes)
      if (l.items.some((i) => i.fields['title'] === title))
        return p.lanes.find((h) => h.key === l.laneKey)!.label;
  return undefined;
};

describe('lane fields', () => {
  it('offers the built-ins, then each grouping custom field once, named by the first type', () => {
    expect(laneFieldsOf(types).map((f) => f.label)).toEqual([
      'Labels',
      'Estimate',
      'Start Date',
      'Due Date',
      'Stage',
      'Signed',
      'Seats',
      'Renewal',
      'Customer',
    ]);
    expect(laneFieldOf('f-notes', types)).toBeUndefined();
    expect(laneFieldOf(undefined, types)).toBeUndefined();
  });

  it('leaves out a custom field its type no longer offers', () => {
    const dropped = { ...project, fields: project.fields.filter((f) => f !== 'f-seats') };
    expect(laneFieldOf('f-seats', [dropped])).toBeUndefined();
  });
});

describe('rows by a field', () => {
  it('Choice: every option a row in order, then others A to Z, then No Stage', () => {
    const items = [
      item({ title: 'a', status: 'todo', 'f-stage': 'Won' }),
      item({ title: 'b', status: 'todo', 'f-stage': 'Zombie' }),
      item({ title: 'c', status: 'todo' }),
    ];
    expect(labels('f-stage', items)).toEqual(['Lead', 'Trial', 'Won', 'Zombie', 'No Stage']);
    expect(laneOfTitle('f-stage', items, 'c')).toBe('No Stage');
  });

  it('Checkbox: Yes then No, an unset box is No, no empty row', () => {
    const items = [
      item({ title: 'a', status: 'todo', 'f-signed': true }),
      item({ title: 'b', status: 'todo' }),
    ];
    expect(labels('f-signed', items)).toEqual(['Yes', 'No']);
    expect(laneOfTitle('f-signed', items, 'b')).toBe('No');
    expect(labels('f-signed', [])).toEqual(['Yes', 'No']);
  });

  it('Number lowest first, Date earliest first, each with its No row last', () => {
    const items = [
      item({ title: 'a', status: 'todo', 'f-seats': 20, due: '2026-12-01' }),
      item({ title: 'b', status: 'todo', 'f-seats': 3, due: '2026-02-01' }),
      item({ title: 'c', status: 'todo' }),
    ];
    expect(labels('f-seats', items)).toEqual(['3', '20', 'No Seats']);
    expect(labels('due', items)).toEqual(['2026-02-01', '2026-12-01', 'No Due Date']);
    expect(labels('estimate', [item({ title: 'x', status: 'todo', estimate: 5 })])).toEqual([
      '5',
      'No Estimate',
    ]);
  });

  it('Text A to Z ignoring case, trimmed, a blank value has none', () => {
    const items = [
      item({ title: 'a', status: 'todo', 'f-customer': 'zeta' }),
      item({ title: 'b', status: 'todo', 'f-customer': '  Acme ' }),
      item({ title: 'c', status: 'todo', 'f-customer': '   ' }),
    ];
    expect(labels('f-customer', items)).toEqual(['Acme', 'zeta', 'No Customer']);
    expect(laneOfTitle('f-customer', items, 'c')).toBe('No Customer');
  });

  it('Labels: a card sits in the row of its first label', () => {
    const items = [
      item({ title: 'a', status: 'todo', labels: ['ui', 'auth'] }),
      item({ title: 'b', status: 'todo', labels: ['auth'] }),
    ];
    expect(labels('labels', items)).toEqual(['auth', 'ui', 'No Labels']);
    expect(laneOfTitle('labels', items, 'a')).toBe('ui');
  });

  it('draws no rows when the field is gone, and keeps the setting', () => {
    const p = projectBoard(
      board('f-gone'),
      map([item({ title: 'a', status: 'todo' })]),
      undefined,
      types,
    );
    expect(p.swimlanes).toBe(false);
    expect(p.lanes).toHaveLength(1);
    expect(normaliseBoardSetup(board('f-gone'))).toMatchObject({
      swimlaneBy: 'field',
      swimlaneField: 'f-gone',
    });
  });
});

describe('dropping into a field row', () => {
  const head = (field: string, items: Item[], label: string) =>
    projectBoard(board(field), map(items), undefined, types).lanes.find((l) => l.label === label)!;

  it('sets the value, clears on No, and puts a label first keeping the others', () => {
    const card = item({ title: 'a', status: 'todo', labels: ['ui', 'auth'] });
    const both = [card, item({ title: 'b', status: 'todo', labels: ['auth'] })];
    expect(laneDropPatch(head('f-stage', [], 'Trial'))).toEqual({ set: { 'f-stage': 'Trial' } });
    expect(laneDropPatch(head('f-stage', [], 'No Stage'))).toEqual({ clear: ['f-stage'] });
    expect(laneDropPatch(head('f-signed', [], 'Yes'))).toEqual({ set: { 'f-signed': true } });
    expect(laneDropPatch(head('f-signed', [], 'No'))).toEqual({ clear: ['f-signed'] });
    expect(laneDropPatch(head('labels', both, 'auth'), card)).toEqual({
      set: { labels: ['auth', 'ui'] },
    });
    expect(laneDropPatch(head('labels', [card], 'ui'))).toEqual({ set: { labels: ['ui'] } });
    expect(laneDropPatch(head('labels', [card], 'No Labels'), card)).toEqual({ clear: ['labels'] });
  });

  it('keeps the other rows as they were', () => {
    expect(laneDropPatch(undefined)).toEqual({});
    expect(laneDropPatch({ key: 's:x', label: 'X', field: 'status', value: 'x' })).toEqual({});
    expect(laneDropPatch({ key: 't:bug', label: 'Bug', field: 'type', value: 'bug' })).toEqual({
      type: 'bug',
    });
    expect(laneDropPatch({ key: '', label: 'No one', field: 'assignee', value: null })).toEqual({
      clear: ['assignee'],
    });
    expect(laneDropPatch({ key: 'f:1', label: '1', field: 'field', value: 1 })).toEqual({});
  });

  it('lets a move set a lane field, and nothing else', () => {
    for (const k of ['assignee', 'labels', 'due', 'f-stage'])
      expect(isSwimlaneSettable(k)).toBe(true);
    for (const k of ['title', 'status', 'votes', 'F-Bad'])
      expect(isSwimlaneSettable(k)).toBe(false);
  });
});

describe('normalising a field lane', () => {
  it('keeps a field a lane could name, and reads any other as no swimlanes', () => {
    expect(normaliseBoardSetup(board('labels'))?.swimlaneField).toBe('labels');
    expect(normaliseBoardSetup(board('title'))).toMatchObject({ swimlaneBy: 'none' });
    expect(normaliseBoardSetup(board('title'))?.swimlaneField).toBeUndefined();
    expect(
      normaliseBoardSetup({
        ...presetSetup('kanban'),
        swimlaneBy: 'assignee',
        swimlaneField: 'f-x',
      })?.swimlaneField,
    ).toBeUndefined();
  });
});
