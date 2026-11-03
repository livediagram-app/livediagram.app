import { describe, expect, it } from 'vitest';
import {
  presetSetup,
  statusColumn,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { MAX_PRESETS, boardCards, boardPresets } from './board-presets';

// docs/specs/026-plan/plan-board.md "Configure": presets from the board's own cards, best fit first, never the columns.
const { addTypes: _all, ...kanban } = presetSetup('kanban');
const setup: PlanBoardSetup = {
  ...kanban,
  swimlaneBy: 'none',
  columns: [statusColumn('todo', 'To Do'), statusColumn('done', 'Done')],
};
const type = (id: string, fields: string[]): ItemTypeDef => ({
  id,
  label: id,
  newTitle: id,
  glyph: 'item',
  color: '#000',
  fields,
});
const task = type('task', ['title', 'status', 'assignee', 'priority', 'due']);
const note = type('note', ['title', 'status']);
const person = { id: 'p', name: 'Ana', color: '#f00' };
let key = 0;
const item = (t: string, fields: Record<string, unknown>): Item =>
  ({
    id: `i${++key}`,
    type: t,
    key,
    rank: 'a',
    fields: { status: 'todo', ...fields },
    rev: 1,
  }) as unknown as Item;

describe('boardCards', () => {
  it('counts the shown types in its columns, not archived', () => {
    const items = [
      item('task', {}),
      item('task', { status: 'gone' }),
      item('task', { archived: true }),
      item('other', {}),
    ];
    expect(boardCards(setup, [task], items)).toHaveLength(1);
    expect(boardCards({ ...setup, allCards: true }, [task], items)).toHaveLength(2);
    expect(boardCards(setup, [task], [item('task', { status: undefined })])).toHaveLength(0);
  });
});

describe('boardPresets', () => {
  it('ranks by how much of the board the preset uses, with a reason', () => {
    const items = [
      item('task', { assignee: person }),
      item('task', { priority: 'high', assignee: person }),
      item('task', { due: '2026-11-04', assignee: person }),
      item('note', {}),
      item('note', {}),
    ];
    const ps = boardPresets(setup, [task, note], items);
    expect(ps.map((p) => p.id)).toEqual([
      'simple',
      'overview',
      'people',
      'types',
      'urgent',
      'deadlines',
      'priority-lanes',
      'newest',
      'recent',
    ]);
    expect(ps[2]?.reason).toBe('3 of 5 cards have someone on them');
    expect(ps[4]?.reason).toBe('1 of 5 cards have a priority');
    expect(ps.find((p) => p.id === 'types')?.reason).toBeUndefined();
  });

  it('leaves out a preset with nothing to show, and those the types cannot show', () => {
    const ps = boardPresets(
      setup,
      [task],
      Array.from({ length: 5 }, () => item('task', {})),
    );
    // With fewer cards there is too little to go on, so all are offered.
    expect(boardPresets(setup, [task], [item('task', {})])).toHaveLength(8);
    expect(ps.map((p) => p.id)).toEqual(['simple', 'overview', 'newest', 'recent']);
    expect(boardPresets(setup, [note], []).map((p) => p.id)).toEqual([
      'simple',
      'overview',
      'newest',
      'recent',
    ]);
    // An All Cards board has no person lanes.
    expect(boardPresets({ ...setup, allCards: true }, [task], []).map((p) => p.id)).not.toContain(
      'people',
    );
  });

  it('offers everything the types can show on an empty board', () => {
    const ps = boardPresets(setup, [task, note], []);
    expect(ps.map((p) => p.id)).toEqual([
      'simple',
      'overview',
      'people',
      'urgent',
      'deadlines',
      'priority-lanes',
      'types',
      'newest',
      'recent',
    ]);
    expect(ps.every((p) => p.reason === undefined)).toBe(true);
  });

  it('sets lanes, sort and size only, and marks the one in use', () => {
    const ps = boardPresets(setup, [task], []);
    const urgent = ps.find((p) => p.id === 'urgent')!;
    const next = urgent.apply({ ...setup, swimlaneField: 'x', cardSize: 'minimal' });
    expect(next.columns).toBe(setup.columns);
    expect(next.sortBy).toEqual([
      { field: 'priority', dir: 'desc' },
      { field: 'due', dir: 'asc' },
    ]);
    expect(next).not.toHaveProperty('cardSize');
    expect(next).not.toHaveProperty('swimlaneField');
    expect(boardPresets(next, [task], []).find((p) => p.id === 'urgent')?.active).toBe(true);
    const overview = ps.find((p) => p.id === 'overview')!.apply(setup);
    expect(overview.cardSize).toBe('minimal');
    expect(overview).not.toHaveProperty('sortBy');
    expect(ps.find((p) => p.id === 'simple')?.active).toBe(true);
    // A board with no due field sorts by priority alone, and lanes people without a sort.
    const plain = type('t', ['title', 'status', 'assignee', 'priority']);
    const pp = boardPresets(setup, [plain], []);
    expect(pp.find((p) => p.id === 'urgent')!.apply(setup).sortBy).toEqual([
      { field: 'priority', dir: 'desc' },
    ]);
    expect(pp.find((p) => p.id === 'people')!.apply(setup)).not.toHaveProperty('sortBy');
  });

  it('suggests the overview for a full board', () => {
    const many = Array.from({ length: 30 }, () => item('note', {}));
    const ps = boardPresets(setup, [note], many);
    expect(ps[1]).toMatchObject({ id: 'overview', reason: '30 cards to take in' });
    expect(boardPresets(setup, [note], [item('note', {})])[0]?.reason).toBeUndefined();
  });

  it('offers the card types’ own fields, and never more than nine', () => {
    const deal = {
      ...type('deal', ['title', 'status', 'f-stage', 'f-seats', 'f-renewal', 'f-signed']),
      label: 'Deal',
      custom: [
        { id: 'f-stage', label: 'Stage', kind: 'choice', options: ['Lead', 'Trial', 'Won'] },
        { id: 'f-seats', label: 'Seats', kind: 'number' },
        { id: 'f-renewal', label: 'Renewal', kind: 'date' },
        { id: 'f-signed', label: 'Signed', kind: 'checkbox' },
      ],
    } as ItemTypeDef;
    const deals = [
      item('deal', { 'f-stage': 'Lead', 'f-seats': 4 }),
      item('deal', { 'f-stage': 'Won', 'f-signed': true }),
      item('deal', { 'f-stage': 'Trial' }),
      item('deal', {}),
      item('deal', {}),
    ];
    const ps = boardPresets(setup, [deal], deals);
    expect(ps.map((p) => p.id)).toEqual([
      'simple',
      'overview',
      'lane:f-stage',
      'lane:f-signed',
      'sort:f-seats',
      'newest',
      'recent',
    ]);
    const stage = ps.find((p) => p.id === 'lane:f-stage')!;
    expect(stage).toMatchObject({
      title: 'By Stage',
      detail: 'A row for each Stage, from Lead to Won.',
      reason: '3 of 5 cards have a Stage',
      art: 'lanes',
    });
    const laned = stage.apply(setup);
    expect(laned).toMatchObject({ swimlaneBy: 'field', swimlaneField: 'f-stage' });
    expect(boardPresets(laned, [deal], deals).find((p) => p.id === 'lane:f-stage')?.active).toBe(
      true,
    );
    expect(ps.find((p) => p.id === 'sort:f-seats')!.apply(setup).sortBy).toEqual([
      { field: 'f-seats', dir: 'desc' },
    ]);
    // On a near-empty board every one is offered, cut to the best nine.
    const few = boardPresets(setup, [task, deal], []);
    expect(few).toHaveLength(MAX_PRESETS);
    expect(few.slice(0, 2).map((p) => p.id)).toEqual(['simple', 'overview']);
    expect(few.find((p) => p.id === 'sort:f-renewal')).toMatchObject({
      title: 'Earliest Renewal First',
      reason: 'From your Deal cards',
    });
  });
});
