import { describe, expect, it } from 'vitest';
import { createShape, type BoxedElement, type Tab, type TabPlanData } from '@livediagram/document';
import { ITEM_TYPES, presetSetup, type Item } from '@livediagram/items';
import { tabToExcalidrawText } from './excalidraw-export';

// Plan boards and cards in the Excalidraw export (docs/specs/020-import-export/excalidraw-import-export.md).

const person = { id: 'p', name: 'Sam', color: '#2563eb' };
const item = (id: string, key: number, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key,
  rank: `i${key}`,
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: person,
  updatedBy: person,
});
const items = new Map([
  ['a', item('a', 3, { title: 'Write spec', status: 'todo' })],
  ['b', item('b', 4, { title: 'Ship', status: 'done' })],
]);
const plan: TabPlanData = { items, types: ITEM_TYPES, catalogue: null };

const board = {
  ...createShape('plan-board', 0, 0),
  id: 'board',
  planBoard: presetSetup('kanban'),
} as BoxedElement;
const card = {
  ...createShape('plan-card', 0, 800),
  id: 'card',
  planCard: { itemId: 'b' },
} as BoxedElement;
const tab = (elements: BoxedElement[]): Tab => ({ id: 't', name: 'Plan', elements });

type Out = { id: string; type: string; text?: string; containerId?: string | null };
const elementsOf = (text: string) => (JSON.parse(text) as { elements: Out[] }).elements;
const texts = (els: Out[]) => els.filter((e) => e.type === 'text').map((e) => e.text);

describe('tabToExcalidrawText, Plan', () => {
  it("draws a board's title, columns with counts and card faces", () => {
    const els = elementsOf(tabToExcalidrawText(tab([board]), plan));
    expect(texts(els)).toEqual(
      expect.arrayContaining([
        'Kanban',
        'To Do · 1',
        'In Progress · 0 / 3',
        '#3 Write spec',
        '#4 Ship',
      ]),
    );
    const face = els.find((e) => e.id === 'board-card-a')!;
    expect(face.type).toBe('rectangle');
    expect(els.find((e) => e.id === 'board-card-a-label')?.containerId).toBe('board-card-a');
    expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
  });

  it('labels a Plan card with its item', () => {
    const els = elementsOf(tabToExcalidrawText(tab([card]), plan));
    expect(texts(els)).toContain('#4 Ship');
  });

  it('keeps the bare frame and columns without the items', () => {
    const els = elementsOf(tabToExcalidrawText(tab([board, card])));
    expect(texts(els)).toContain('To Do · 0');
    expect(els.some((e) => e.id.startsWith('board-card-'))).toBe(false);
    expect(els.find((e) => e.id === 'card')?.type).toBe('rectangle');
  });
});
