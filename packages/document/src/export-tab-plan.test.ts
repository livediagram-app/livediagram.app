import { describe, expect, it } from 'vitest';
import {
  builtInCatalogue,
  ITEM_TYPES,
  presetSetup,
  type Item,
  type ItemTypeDef,
} from '@livediagram/items';
import { createShape } from './shape-factory';
import { tabToJsonText, tabToMarkdownText, type ExportedTabEnvelope } from './export-tab-text';
import { tabExportItems, type TabPlanData } from './export-tab-plan';
import { planBoardLayout, PLAN_CARD_H } from './plan-board-layout';
import type { BoxedElement, Tab } from './index';

// A tab's Plan items in its JSON and Markdown exports (docs/specs/026-plan/items.md "Copies and exports").

const person = { id: 'p', name: 'Sam', color: '#2563eb' };
const item = (id: string, key: number, fields: Item['fields'], type = 'task'): Item => ({
  id,
  type,
  key,
  rank: `i${key}`,
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: person,
  updatedBy: person,
});

const board = {
  ...createShape('plan-board', 0, 0),
  id: 'board',
  planBoard: presetSetup('kanban'),
} as BoxedElement;
const card = (itemId: string, y = 700) =>
  ({
    ...createShape('plan-card', 0, y),
    id: `card-${itemId}`,
    planCard: { itemId },
  }) as BoxedElement;
const tabOf = (...elements: BoxedElement[]): Tab => ({ id: 't', name: 'Plan', elements });

const items = new Map<string, Item>([
  [
    'a',
    item('a', 2, {
      title: 'Write spec',
      status: 'todo',
      votes: { x: 1 },
      comments: { comments: [] },
    }),
  ],
  ['b', item('b', 1, { title: 'Ship', status: 'done' }, 'note')],
  ['c', item('c', 3, { title: 'Gone', status: 'trash', trashedFrom: 'todo' })],
]);
const plan: TabPlanData = { items, types: ITEM_TYPES, catalogue: null };

describe('tabExportItems', () => {
  it('carries every item a board shows, the Trash left out, in number order, without votes or comments', () => {
    const out = tabExportItems(tabOf(board), items);
    expect(out.map((i) => i.id)).toEqual(['b', 'a']);
    expect(out[1]!.fields).toEqual({ title: 'Write spec', status: 'todo' });
  });

  it("carries only a Plan card's item when the tab has no board", () => {
    expect(tabExportItems(tabOf(card('b')), items).map((i) => i.id)).toEqual(['b']);
  });

  it('leaves the stored items as they are', () => {
    tabExportItems(tabOf(board), items);
    expect(items.get('a')!.fields['votes']).toEqual({ x: 1 });
  });
});

describe('tabToJsonText with a plan', () => {
  const parse = (text: string) => JSON.parse(text) as ExportedTabEnvelope;

  it('adds the items, and the catalogue once the document stores one', () => {
    expect(parse(tabToJsonText(tabOf(board), plan)).items?.map((i) => i.id)).toEqual(['b', 'a']);
    expect(parse(tabToJsonText(tabOf(board), plan)).itemTypes).toBeUndefined();
    const catalogue = builtInCatalogue();
    expect(parse(tabToJsonText(tabOf(board), { ...plan, catalogue })).itemTypes).toEqual(catalogue);
  });

  it('adds neither field when the tab shows no items', () => {
    const env = parse(tabToJsonText(tabOf(), { ...plan, catalogue: builtInCatalogue() }));
    expect('items' in env).toBe(false);
    expect('itemTypes' in env).toBe(false);
    expect('items' in parse(tabToJsonText(tabOf(board)))).toBe(false);
  });
});

describe('tabToMarkdownText with a plan', () => {
  it('lists each board column with its count and every card', () => {
    const md = tabToMarkdownText(tabOf(board), plan);
    expect(md).toContain('## Plan Boards');
    expect(md).toContain('### Kanban');
    expect(md).toContain('#### To Do · 1');
    expect(md).toContain('- #2 Write spec (Task)');
    expect(md).toContain('#### Done · 1');
    expect(md).toContain('- #1 Ship (Note)');
    expect(md).toContain('#### Backlog · 0\n\n_No cards._');
    expect(md).not.toContain('Gone');
    expect(md).not.toContain('_No labelled content._');
  });

  it('lists Plan cards, top to bottom, naming a missing item', () => {
    const md = tabToMarkdownText(tabOf(card('missing', 900), card('a', 100)), plan);
    expect(md).toContain('## Plan Cards\n\n- #2 Write spec (Task)\n- _Card not found_');
  });

  it("names a custom type by the document's label", () => {
    const custom: ItemTypeDef = { ...ITEM_TYPES[1]!, id: 'bug', label: 'Bug' };
    const bugs = new Map([['x', item('x', 9, { title: 'Crash', status: 'todo' }, 'bug')]]);
    const md = tabToMarkdownText(tabOf(card('x')), {
      items: bugs,
      types: [...ITEM_TYPES, custom],
      catalogue: null,
    });
    expect(md).toContain('- #9 Crash (Bug)');
  });

  it('is unchanged without a plan', () => {
    expect(tabToMarkdownText(tabOf(board))).not.toContain('Plan Boards');
  });
});

describe('planBoardLayout', () => {
  it('is null for a board without a readable set-up', () => {
    expect(planBoardLayout({ ...board, planBoard: { columns: 'none' } }, items)).toBeNull();
  });

  it('places the cards that fit and cuts off the rest, keeping the count', () => {
    const many = new Map(
      Array.from({ length: 20 }, (_, i) => [
        `m${i}`,
        item(`m${i}`, i + 1, { title: `Card ${i}`, status: 'todo' }),
      ]),
    );
    const layout = planBoardLayout(board, many)!;
    const todo = layout.columns.find((c) => c.column.status === 'todo')!;
    expect(todo.count).toBe(20);
    expect(todo.cards.length).toBeGreaterThan(0);
    expect(todo.cards.length).toBeLessThan(20);
    const last = todo.cards[todo.cards.length - 1]!;
    expect(last.y + PLAN_CARD_H).toBeLessThanOrEqual(todo.y + todo.height);
  });
});

describe('a full store', () => {
  // The worst case (2,000 items, the store's cap) measured at about 3 ms for JSON and 2 ms for Markdown; the
  // budget is wide so a loaded CI machine stays green while a quadratic slip still fails.
  it('exports 2,000 cards well within budget', () => {
    const full = new Map<string, Item>();
    for (let i = 0; i < 2000; i++) {
      full.set(`f${i}`, item(`f${i}`, i + 1, { title: `Card ${i}`, status: 'todo' }));
    }
    const fullPlan = { ...plan, items: full };
    const t = performance.now();
    const env = JSON.parse(tabToJsonText(tabOf(board), fullPlan)) as ExportedTabEnvelope;
    tabToMarkdownText(tabOf(board), fullPlan);
    expect(performance.now() - t).toBeLessThan(250);
    expect(env.items).toHaveLength(2000);
  });
});
