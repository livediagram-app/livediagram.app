import { describe, expect, it } from 'vitest';
import { presetSetup, type Item } from '@livediagram/items';
import { createShape, SHAPE_DEFAULT_SIZE } from './shape-factory';
import { elementKindLabel } from './element-kind-label';
import { isPlanShape, isSelfDrawingShape } from './data-shapes';
import { SELF_PAINTING_SHAPES } from './colors';
import { elementValidationIssue } from './validate';
import { svgBoxed, renderElementsToSvg } from './svg-render';
import type { BoxedElement, Tab } from './index';

// The Plan board and Plan card kinds (docs/specs/025-plan/blueprints/plan-board.md "Element model").

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

  it('validate their set-up and reference', () => {
    const board = createShape('plan-board', 0, 0);
    expect(elementValidationIssue(board)).toBeNull();
    expect(elementValidationIssue({ ...board, planBoard: { columns: [] } })).toMatchObject({
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
  const board = { ...createShape('plan-board', 0, 0), id: 'b' } as BoxedElement;
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
    ['item0002', item('item0002', { title: 'Ship', status: 'done' }, { key: 8, type: 'bug' })],
  ]);

  it('draws columns and escaped card faces from the items', () => {
    const svg = svgBoxed(board, { items });
    expect(svg).toContain('To do');
    expect(svg).toContain('In progress');
    expect(svg).toContain('Fix &lt;login&gt;');
    expect(svg).toContain('#7 · Task');
    expect(svg).toContain('#8 · Bug');
    expect(svg).toContain('AR');
    expect(svg).toContain('▲ 2');
    expect(svg).toContain('2 items');
    expect(svg).not.toContain('NaN');
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
