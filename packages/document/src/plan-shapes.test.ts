import { describe, expect, it } from 'vitest';
import { presetSetup, type Item } from '@livediagram/items';
import { createShape, SHAPE_DEFAULT_SIZE } from './shape-factory';
import { elementKindLabel } from './element-kind-label';
import { isPlanShape, isSelfDrawingShape } from './data-shapes';
import { SELF_PAINTING_SHAPES } from './colors';
import { elementValidationIssue } from './validate';
import { takesTypedLabel } from './element-types';
import { svgBoxed, renderElementsToSvg } from './svg-render';
import type { BoxedElement, Tab } from './index';

// The Plan board and Plan card kinds (docs/specs/026-plan/blueprints/plan-board.md "Element model").

const item = (id: string, fields: Item['fields'], extra: Partial<Item> = {}): Item => ({
  id,
  type: 'task',
  key: 1,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'Sam', color: '#2563eb' },
  updatedBy: { id: 'p', name: 'Sam', color: '#2563eb' },
  ...extra,
});

describe('plan shapes', () => {
  it('are made with their default size and seed', () => {
    const board = createShape('plan-board', 0, 0);
    expect(board).toMatchObject({ width: 1120, height: 640, planBoard: presetSetup('blank') });
    const card = createShape('plan-card', 0, 0);
    expect(card).toMatchObject({ width: 240, height: 120, planCard: { itemId: '' } });
    expect(SHAPE_DEFAULT_SIZE['plan-card']).toEqual({ width: 240, height: 120 });
  });

  it('are named, self-drawing and self-painting', () => {
    expect(elementKindLabel(createShape('plan-board', 0, 0))).toBe('Plan Board');
    expect(elementKindLabel(createShape('plan-card', 0, 0))).toBe('Plan Card');
    for (const k of ['plan-board', 'plan-card'] as const) {
      expect(isPlanShape(k)).toBe(true);
      expect(isSelfDrawingShape(k)).toBe(true);
      expect(SELF_PAINTING_SHAPES.has(k)).toBe(true);
    }
    expect(isPlanShape('square')).toBe(false);
  });

  it('never open for typing when placed, so a new board moves at once', () => {
    for (const k of ['plan-board', 'plan-card', 'plan-view'] as const) {
      expect(takesTypedLabel(createShape(k, 0, 0))).toBe(false);
    }
    expect(takesTypedLabel(createShape('square', 0, 0))).toBe(true);
  });

  it('validate their set-up and reference', () => {
    const board = createShape('plan-board', 0, 0);
    expect(elementValidationIssue(board)).toBeNull();
    expect(elementValidationIssue({ ...board, planBoard: { columns: 'none' } })).toMatchObject({
      field: 'planBoard',
    });
    const card = createShape('plan-card', 0, 0);
    expect(elementValidationIssue({ ...card, planCard: { itemId: 'abcdef12' } })).toBeNull();
    expect(elementValidationIssue({ ...card, planCard: { itemId: 'no' } })).toMatchObject({
      field: 'planCard',
    });
    expect(elementValidationIssue({ ...card, planCard: 'x' })).toMatchObject({ field: 'planCard' });
  });
});

describe('plan shapes in exports', () => {
  const board = {
    ...createShape('plan-board', 0, 0),
    id: 'b',
    planBoard: presetSetup('kanban'),
  } as BoxedElement;
  const card = {
    ...createShape('plan-card', 1200, 0),
    id: 'c',
    planCard: { itemId: 'item0001' },
  } as BoxedElement;
  const items = new Map([
    [
      'item0001',
      item(
        'item0001',
        {
          title: 'Fix <login>',
          status: 'todo',
          priority: 'high',
          assignee: { id: 'a', name: 'Ali Ray', color: '#dc2626' },
          votes: { x: 2 },
        },
        { key: 7 },
      ),
    ],
    ['item0002', item('item0002', { title: 'Ship', status: 'done' }, { key: 8, type: 'note' })],
  ]);

  it('draws columns and escaped card faces from the items', () => {
    const svg = svgBoxed(board, { items });
    expect(svg).toContain('To Do');
    expect(svg).toContain('In Progress');
    expect(svg).toContain('Fix &lt;login&gt;');
    expect(svg).toContain('#7 · Task');
    expect(svg).toContain('#8 · Note');
    expect(svg).toContain('AR');
    expect(svg).toContain('▲ 2');
    expect(svg).toContain('2 items');
    expect(svg).not.toContain('NaN');
  });

  it('draws a flagged card with its flag (docs/specs/026-plan/items.md "Flags")', () => {
    const flagged = new Map([['item0001', item('item0001', { title: 'Hot', flagged: true })]]);
    expect(svgBoxed(card, { items: flagged })).toContain('⚑');
    expect(svgBoxed(card, { items })).not.toContain('⚑');
  });

  it('counts an open comment thread on a card (docs/specs/026-plan/items.md "Comments")', () => {
    const thread = { comments: [{ id: 'c1' }, { id: 'c2' }] };
    const talked = new Map([['item0001', item('item0001', { title: 'Hot', comments: thread })]]);
    const tall = { ...card, height: 80 } as BoxedElement;
    expect(svgBoxed(tall, { items: talked })).toContain('>2</text>');
    const resolved = new Map([
      ['item0001', item('item0001', { title: 'Hot', comments: { ...thread, resolved: true } })],
    ]);
    expect(svgBoxed(tall, { items: resolved })).not.toContain('>2</text>');
  });

  it("follows a board's card fields for the comment count", () => {
    const thread = { comments: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] };
    const talked = new Map([
      ['item0001', item('item0001', { title: 'Hot', status: 'todo', comments: thread })],
    ]);
    const setup = presetSetup('kanban');
    const on = { ...board, planBoard: { ...setup, cardFields: [...setup.cardFields, 'comments'] } };
    const off = {
      ...board,
      planBoard: { ...setup, cardFields: setup.cardFields.filter((f) => f !== 'comments') },
    };
    expect(svgBoxed(on as BoxedElement, { items: talked })).toContain('>3</text>');
    expect(svgBoxed(off as BoxedElement, { items: talked })).not.toContain('>3</text>');
  });

  it('draws empty columns without items, and a card placeholder', () => {
    const svg = svgBoxed(board);
    expect(svg).toContain('Done');
    expect(svg).not.toContain('items</text>');
    expect(svgBoxed(card)).toContain('>Item<');
    expect(svgBoxed(card, { items: new Map() })).toContain('Item not found');
    expect(svgBoxed(card, { items })).toContain('Fix &lt;login&gt;');
  });

  it('marks a column over its WIP limit, draws a dark surface and survives a broken set-up', () => {
    const kanban = {
      ...board,
      planBoard: {
        ...presetSetup('kanban'),
        columns: [{ id: 'd', status: 'todo', name: 'Doing', wipLimit: 1 }],
      },
    } as BoxedElement;
    const many = new Map([
      ...items,
      ['item0003', item('item0003', { title: 'More', status: 'todo' }, { key: 9 })],
    ]);
    expect(svgBoxed(kanban, { items: many })).toContain('#b45309');
    expect(svgBoxed(board, { items, surface: 'dark' })).toContain('#111827');
    expect(svgBoxed({ ...board, planBoard: undefined } as BoxedElement)).toContain('<rect');
  });

  it('renders a tab with its items', () => {
    const tab = { id: 't', name: 'T', elements: [board, card] } as Tab;
    expect(renderElementsToSvg(tab, { items })).toContain('Fix &lt;login&gt;');
  });
});

// The plan view (docs/specs/026-plan/blueprints/plan-views.md "Element model").
describe('plan view shape', () => {
  it('is made with a view, named, self-drawing and self-painting', () => {
    const view = createShape('plan-view', 0, 0);
    expect(view).toMatchObject({ width: 720, height: 400, planView: { view: 'status-mix' } });
    expect(elementKindLabel(view)).toBe('Plan View');
    expect(isPlanShape('plan-view')).toBe(true);
    expect(isSelfDrawingShape('plan-view')).toBe(true);
    expect(SELF_PAINTING_SHAPES.has('plan-view')).toBe(true);
  });

  it('validates its view', () => {
    const view = createShape('plan-view', 0, 0);
    expect(elementValidationIssue({ ...view, planView: { view: 'gantt' } })).toBeNull();
    expect(elementValidationIssue({ ...view, planView: { view: 'metric:due' } })).toBeNull();
    expect(elementValidationIssue({ ...view, planView: { view: 'metric:filter' } })).toMatchObject({
      field: 'planView',
    });
    expect(elementValidationIssue({ ...view, planView: 'gantt' })).toMatchObject({
      field: 'planView',
    });
  });

  it('validates a Gantt chart’s swimlanes and names width', () => {
    const view = createShape('plan-view', 0, 0);
    const gantt = (extra: Record<string, unknown>) =>
      elementValidationIssue({ ...view, planView: { view: 'gantt', ...extra } });
    expect(gantt({ swimlaneBy: 'assignee', namesWidth: 260 })).toBeNull();
    expect(gantt({ swimlaneBy: 'field', swimlaneField: 'c-size' })).toBeNull();
    expect(gantt({ swimlaneBy: 'colour' })).toMatchObject({ field: 'planView' });
    expect(gantt({ namesWidth: 20 })).toMatchObject({ field: 'planView' });
    expect(gantt({ namesWidth: '300' })).toMatchObject({ field: 'planView' });
  });

  it('exports as a labelled box', () => {
    const gantt = {
      ...createShape('plan-view', 0, 0),
      planView: { view: 'gantt' },
    } as BoxedElement;
    expect(svgBoxed(gantt)).toContain('Gantt Chart');
    const widget = {
      ...createShape('plan-view', 0, 0),
      planView: { view: 'metric:count' },
    } as BoxedElement;
    expect(svgBoxed(widget)).toContain('Metric');
  });
});
