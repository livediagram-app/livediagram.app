import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, presetSetup, type Item, type ItemTypeDef } from '@livediagram/items';
import { planPalette } from './plan-palette';
import { planCardFace } from './svg-render-plan-card';
import { PLAN_LANE_HEAD_H, planBoardLayout } from './plan-board-layout';
import { svgBoxed } from './svg-render';
import { createShape } from './shape-factory';
import type { BoxedElement } from './index';

// A Plan card face in exports (docs/specs/026-plan/plan-board.md "Both elements everywhere"), drawn from its type's
// Display (docs/specs/026-plan/item-types.md "Card display").

const item = (id: string, fields: Item['fields'], extra: Partial<Item> = {}): Item => ({
  id,
  type: 'task',
  key: 7,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'Sam', color: '#2563eb' },
  updatedBy: { id: 'p', name: 'Sam', color: '#2563eb' },
  ...extra,
});

const palette = planPalette('light');
const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const bug: ItemTypeDef = {
  ...task,
  id: 'bug',
  label: 'Bug',
  custom: [{ id: 'f-sev', label: 'Severity', kind: 'choice', options: ['S1', 'S2'], onCard: true }],
  fields: [...task.fields, 'f-sev'],
  display: { detailed: { body: ['f-sev'], footEnd: ['assignee'] } },
};
const types = [...ITEM_TYPES, bug];

describe('planCardFace', () => {
  it('shows a custom field the Display places, as its name and value', () => {
    const face = planCardFace(
      item('a', { title: 'Crash', 'f-sev': 'S1' }, { type: 'bug' }),
      0,
      0,
      240,
      {
        palette,
        types,
      },
    );
    expect(face.svg).toContain('Severity: S1');
  });

  it('leaves out a field the card has no value for', () => {
    const face = planCardFace(item('a', { title: 'Crash' }, { type: 'bug' }), 0, 0, 240, {
      palette,
      types,
    });
    expect(face.svg).not.toContain('Severity');
  });

  it('wraps a long title onto up to three lines and grows to hold it', () => {
    const short = planCardFace(item('a', { title: 'Short' }), 0, 0, 240, { palette });
    const long = planCardFace(
      item('a', {
        title:
          'A very long card title that runs on well past one line and keeps going further still',
      }),
      0,
      0,
      240,
      { palette },
    );
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.svg.match(/font-size="13"/g)).toHaveLength(3);
  });

  it('measures without drawing, at the height it draws', () => {
    const it0 = item('a', { title: 'Crash', 'f-sev': 'S2' }, { type: 'bug' });
    const measured = planCardFace(it0, 0, 0, 240, { palette, types }, true);
    expect(measured.svg).toBe('');
    expect(measured.height).toBe(planCardFace(it0, 0, 0, 240, { palette, types }).height);
  });

  it("gates a built-in field by the board's card fields", () => {
    const voted = item('a', { title: 'Idea', votes: { p: 2 } }, { type: 'idea' });
    const on = planCardFace(voted, 0, 0, 240, { palette, boardFields: ['votes'], size: 'compact' });
    const off = planCardFace(voted, 0, 0, 240, { palette, boardFields: [], size: 'compact' });
    expect(off.svg).not.toContain('▲');
    expect(on.svg).toContain('▲ 2');
  });

  it('draws every card size, Minimal the shortest', () => {
    const it0 = item('a', { title: 'Ship it', priority: 'high' });
    const min = planCardFace(it0, 0, 0, 240, { palette, size: 'minimal' });
    const compact = planCardFace(it0, 0, 0, 240, { palette, size: 'compact' });
    const detailed = planCardFace(it0, 0, 0, 240, { palette, size: 'detailed' });
    expect(min.height).toBeLessThanOrEqual(compact.height);
    expect(compact.height).toBeLessThanOrEqual(detailed.height);
    for (const f of [min, compact, detailed]) expect(f.svg).toContain('Ship it');
  });

  it('keeps a standalone element its own height', () => {
    const face = planCardFace(item('a', { title: 'Hi' }), 0, 0, 240, { palette, height: 120 });
    expect(face.height).toBe(120);
    expect(face.svg).toContain('height="120"');
  });

  it('escapes its text', () => {
    const face = planCardFace(item('a', { title: '<b>&' }), 0, 0, 240, { palette });
    expect(face.svg).toContain('&lt;b&gt;&amp;');
  });
});

describe('planBoardLayout swimlanes', () => {
  it('draws a header row per lane and stacks cards at their measured heights', () => {
    const items = new Map([
      ['a', item('a', { title: 'One', status: 'todo', priority: 'high' })],
      ['b', item('b', { title: 'Two', status: 'todo', priority: 'low' }, { key: 8 })],
    ]);
    const el = {
      x: 0,
      y: 0,
      width: 1120,
      height: 900,
      planBoard: { ...presetSetup('kanban'), swimlaneBy: 'priority' },
    };
    const layout = planBoardLayout(el, items, ITEM_TYPES, () => 90)!;
    expect(layout.lanes.length).toBeGreaterThanOrEqual(2);
    const [first, second] = layout.lanes;
    expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
    const cards = layout.columns.flatMap((c) => c.cards);
    expect(cards).toHaveLength(2);
    for (const c of cards) expect(c.height).toBe(90);
    const lane = layout.lanes.find((l) => cards.some((c) => c.y === l.y + PLAN_LANE_HEAD_H));
    expect(lane).toBeDefined();
  });

  it('names each lane across the exported board', () => {
    const items = new Map([
      ['a', item('a', { title: 'One', status: 'todo', priority: 'high' })],
      ['b', item('b', { title: 'Two', status: 'todo', priority: 'low' }, { key: 8 })],
    ]);
    const board = {
      ...createShape('plan-board', 0, 0),
      height: 900,
      planBoard: { ...presetSetup('kanban'), swimlaneBy: 'priority' },
    } as BoxedElement;
    const svg = svgBoxed(board, { items });
    expect(svg).toContain('>High</text>');
    expect(svg).toContain('>Low</text>');
    expect(svg).toContain('>One</text>');
    expect(svg).toMatch(/<line [^>]*stroke-width="1"/);
  });

  it('has no lanes without swimlanes', () => {
    const el = {
      x: 0,
      y: 0,
      width: 1120,
      height: 900,
      planBoard: { ...presetSetup('kanban'), swimlaneBy: 'none' },
    };
    expect(planBoardLayout(el, new Map(), ITEM_TYPES)!.lanes).toEqual([]);
  });
});
