import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, presetSetup, type Item, type ItemTypeDef } from '@liveplanner/items';
import { planPalette } from './plan-palette';
import { planCardFace } from './svg-render-plan-card';
import { PLAN_LANE_HEAD_H, planBoardLayout } from './plan-board-layout';
import { svgBoxed } from './svg-render';
import { planBoardFitHeight } from './svg-render-plan';
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

  it('gives the header end a row of its own on a narrow card, so nothing overlaps', () => {
    const it0 = item('a', { title: 'Fix', priority: 'medium' });
    const wide = planCardFace(it0, 0, 0, 260, { palette });
    const narrow = planCardFace(it0, 0, 0, 120, { palette });
    const yOf = (svg: string, text: string) =>
      Number(new RegExp(`y="([\\d.]+)"[^>]*>${text}<`).exec(svg)?.[1]);
    expect(yOf(wide.svg, 'Medium')).toBe(yOf(wide.svg, 'Task'));
    expect(yOf(narrow.svg, 'Medium')).toBeGreaterThan(yOf(narrow.svg, 'Task'));
    expect(narrow.height).toBeGreaterThan(wide.height);
  });

  it('keeps every bit inside a narrow card', () => {
    const it0 = item(
      'a',
      { title: 'Crash', 'f-sev': 'A very long severity value indeed' },
      { type: 'bug' },
    );
    const sev = { ...bug, display: { detailed: { headEnd: ['f-sev' as const] } } };
    const face = planCardFace(it0, 0, 0, 110, { palette, types: [...ITEM_TYPES, sev] });
    for (const m of face.svg.matchAll(/<rect x="([\d.-]+)"[^>]*width="([\d.]+)" height="18"/g))
      expect(Number(m[1]) + Number(m[2])).toBeLessThanOrEqual(110);
    for (const m of face.svg.matchAll(/<rect x="([\d.-]+)"[^>]*height="18"/g))
      expect(Number(m[1])).toBeGreaterThanOrEqual(0);
    expect(face.svg).toContain('…');
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

  it('counts the cards that do not fit at the column foot, never dropping them silently', () => {
    const items = new Map(
      Array.from({ length: 12 }, (_, i) => {
        const id = `c${i}`;
        return [id, item(id, { title: `Card ${i}`, status: 'todo' }, { key: i + 1 })] as const;
      }),
    );
    const board = {
      ...createShape('plan-board', 0, 0),
      height: 420,
      planBoard: { ...presetSetup('kanban'), swimlaneBy: 'none' },
    } as BoxedElement;
    const layout = planBoardLayout(board, items, ITEM_TYPES)!;
    const col = layout.columns.find((c) => c.column.status === 'todo')!;
    expect(col.hidden).toBeGreaterThan(0);
    expect(col.cards.length + col.hidden).toBe(12);
    const last = col.cards[col.cards.length - 1]!;
    expect(last.y + last.height).toBeLessThanOrEqual(col.y + col.height - 20);
    expect(svgBoxed(board, { items })).toContain(`+${col.hidden} more`);
  });

  it('fits a board to every card it holds, never shorter than it is', () => {
    const items = new Map(
      Array.from({ length: 12 }, (_, i) => {
        const id = `c${i}`;
        return [id, item(id, { title: `Card ${i}`, status: 'todo' }, { key: i + 1 })] as const;
      }),
    );
    const board = {
      ...createShape('plan-board', 0, 0),
      height: 420,
      planBoard: { ...presetSetup('kanban'), swimlaneBy: 'none' },
    } as BoxedElement & { type: 'shape' };
    const fit = planBoardFitHeight(board, items, 'light');
    expect(fit).toBeGreaterThan(420);
    const grown = { ...board, height: fit } as BoxedElement;
    expect(svgBoxed(board, { items })).toMatch(/\+\d+ more/);
    expect(svgBoxed(grown, { items })).not.toMatch(/\+\d+ more/);
    expect(planBoardFitHeight(board, new Map(), 'light')).toBe(420);
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

// docs/specs/026-plan/item-types.md "Calculated fields": worked out from the cards in hand.
describe('a Calculated field in an export', () => {
  const epic: ItemTypeDef = {
    ...task,
    id: 'epic',
    label: 'Epic',
    custom: [
      { id: 'f-kids', label: 'Stories', kind: 'calculated', calculation: 'childCount' },
      { id: 'f-done', label: 'Progress', kind: 'calculated', calculation: 'childrenDone' },
    ],
    fields: ['title', 'status', 'f-kids', 'f-done'],
    display: { detailed: { body: ['f-kids', 'f-done'] } },
  };
  const story: ItemTypeDef = {
    ...task,
    id: 'story',
    label: 'Story',
    custom: [{ id: 'f-epic', label: 'Epic', kind: 'card', linkType: 'epic' }],
    fields: ['title', 'status', 'f-epic'],
  };
  const all = [...ITEM_TYPES, epic, story];
  const e = item('epic1', { title: 'Checkout', status: 'todo' }, { type: 'epic' });
  const items = new Map(
    [
      e,
      item('s1', { title: 'Pay', status: 'done', 'f-epic': 'epic1' }, { type: 'story' }),
      item('s2', { title: 'Ship', status: 'todo', 'f-epic': 'epic1' }, { type: 'story' }),
    ].map((i) => [i.id, i]),
  );

  it('draws both with a board’s done columns', () => {
    const face = planCardFace(e, 0, 0, 240, {
      palette,
      types: all,
      items,
      isDone: (s) => s === 'done',
    });
    expect(face.svg).toContain('Stories: 2');
    expect(face.svg).toContain('Progress: 50%');
  });

  it('draws Child Count alone without them, and neither without the cards', () => {
    const lone = planCardFace(e, 0, 0, 240, { palette, types: all, items });
    expect(lone.svg).toContain('Stories: 2');
    expect(lone.svg).not.toContain('Progress');
    const bare = planCardFace(e, 0, 0, 240, { palette, types: all });
    expect(bare.svg).not.toContain('Stories');
  });

  it('reads a board’s own done columns', () => {
    const board = {
      ...createShape('plan-board', 0, 0),
      width: 1600,
      height: 900,
      planBoard: { ...presetSetup('kanban'), addTypes: ['epic', 'story'] },
    } as BoxedElement;
    const svg = svgBoxed(board, { items, itemTypes: all });
    expect(svg).toContain('Stories: 2');
    expect(svg).toContain('Progress: 50%');
  });
});
